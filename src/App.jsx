import { useState, useEffect, useMemo } from "react";
import { HashRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import {
  initialSchedule,
  initialVolunteers,
  initialItems,
  emptyVolunteer,
  emptyItem,
  sanitizeSchedule,
  mapAppVolunteerToDb,
  mapAppItemToDb,
  mapDbItemToApp,
  makeId,
  formatCurrentDate,
  buildOfflineSnapshot,
  saveOfflineSnapshot,
  loadOfflineSnapshot,
  navigationItems,
} from "./utils/helpers";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useAuth } from "./context/AuthContext";
import { uploadImage } from "./services/storageService";
import {
  createLostItem,
  updateLostItem,
  deleteLostItem,
  updateLostItemStatus,
} from "./services/itemsService";
import {
  createVolunteer,
  updateVolunteer,
  deleteVolunteer,
} from "./services/volunteersService";
import {
  fetchDepartmentData,
  createShift,
  updateShift,
  saveShiftAssignments,
} from "./services/scheduleService";
import { Stat } from "./components/UI";
import ShiftEditorModal from "./components/ShiftEditorModal";
import RequireAuth from "./components/RequireAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Programacao from "./pages/Programacao";
import Voluntarios from "./pages/Voluntarios";
import ItensPerdidos from "./pages/ItensPerdidos";
import GerenciarDepartamentos from "./pages/GerenciarDepartamentos";
import Configuracoes from "./pages/Configuracoes";
import PublicCadastro from "./pages/PublicCadastro";
import PublicEscala from "./pages/PublicEscala";
import logo from "./assets/img/logotipo.png";

const ROUTE_TITLES = {
  "/": "",
  "/programacao": "Escala",
  "/voluntarios": "Voluntários",
  "/itens": "Achados e Perdidos",
  "/departamentos": "Departamentos",
  "/configuracoes": "Configurações",
};

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, activeDepartment, departments, selectDepartment } = useAuth();

  const [activeDay, setActiveDay] = useState("Sexta-feira");
  const [query, setQuery] = useState("");
  const [schedule, setSchedule] = useLocalStorage("ap_schedule_v4_validation", initialSchedule, sanitizeSchedule);
  const [volunteers, setVolunteers] = useLocalStorage("ap_volunteers", initialVolunteers);
  const [items, setItems] = useLocalStorage("ap_items", initialItems);
  const [shiftEditor, setShiftEditor] = useState(null);
  const [volunteerForm, setVolunteerForm] = useState(emptyVolunteer());
  const [itemForm, setItemForm] = useState(emptyItem());
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [hasLoadedRemoteData, setHasLoadedRemoteData] = useState(false);
  const [showDeptSwitcher, setShowDeptSwitcher] = useState(false);

  const departmentId = activeDepartment?.department?.id || activeDepartment?.id || null;
  const departmentName = activeDepartment?.department?.name || "";
  const isCoordinator = activeDepartment?.role === "coordenador";
  const lostItemsEnabled =
    !activeDepartment?.department?.features ||
    activeDepartment.department.features.lostItems !== false;

  const visibleNavigationItems = useMemo(
    () =>
      navigationItems.filter((item) => {
        if (item.path === "/itens" && !lostItemsEnabled) return false;
        if (item.path === "/configuracoes" && !isCoordinator) return false;
        return true;
      }),
    [lostItemsEnabled, isCoordinator]
  );

  const hasMultipleDepts = departments.length > 1;

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    setHasLoadedRemoteData(false);
  }, [departmentId]);

  useEffect(() => {
    async function loadRemoteData() {
      if (!isOnline || hasLoadedRemoteData || !departmentId) return;
      try {
        const data = await fetchDepartmentData(
          departmentId,
          initialSchedule,
          initialVolunteers,
          initialItems,
          mapDbItemToApp
        );
        setSchedule(data.schedule);
        setVolunteers(data.volunteers);
        setItems(data.items);
        setHasLoadedRemoteData(true);
        showToast("Dados sincronizados com Supabase.");
      } catch (error) {
        console.warn("Falha ao buscar dados no Supabase.", error);
        showToast("Falha Supabase: " + (error?.message || "verifique tabelas/RLS"));
        const backup = await loadOfflineSnapshot();
        if (backup) {
          setSchedule(backup.schedule || initialSchedule);
          setVolunteers(backup.volunteers || initialVolunteers);
          setItems(backup.items || initialItems);
        }
      }
    }
    loadRemoteData();
  }, [isOnline, hasLoadedRemoteData, departmentId, setSchedule, setVolunteers, setItems]);

  useEffect(() => {
    const snapshot = buildOfflineSnapshot(schedule, volunteers, items);
    saveOfflineSnapshot(snapshot);
  }, [schedule, volunteers, items]);

  const dayCards = useMemo(() => schedule.filter((item) => item.day === activeDay), [schedule, activeDay]);
  const totalShifts = useMemo(() => schedule.reduce((acc, item) => acc + item.shifts.length, 0), [schedule]);
  const assignedShifts = useMemo(
    () => schedule.flatMap((block) => block.shifts).filter((shift) => shift.volunteerIds.length > 0).length,
    [schedule]
  );
  const pendingItems = useMemo(() => items.filter((item) => item.status !== "Entregue").length, [items]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((item) =>
      (item.person + " " + item.item + " " + item.day + " " + item.status)
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [items, query]);

  function handleEditShift(payload) {
    setShiftEditor(payload);
  }

  function handleCreateShift(blockId) {
    setShiftEditor({ blockId, shiftId: null });
  }

  async function saveShiftFromModal(data) {
    if (!departmentId) return;

    const manualNames = data.manualName ? [data.manualName] : [];
    let localShiftId = null;

    if (data.shiftId) {
      setSchedule((current) =>
        current.map((block) => ({
          ...block,
          shifts: block.shifts.map((shift) =>
            shift.id === data.shiftId
              ? {
                  ...shift,
                  start: data.startTime,
                  end: data.endTime,
                  description: data.description,
                  volunteerIds: data.selectedIds,
                  manualNames,
                }
              : shift
          ),
        }))
      );
    } else {
      localShiftId = makeId("local-shift");
      setSchedule((current) =>
        current.map((block) =>
          block.id === data.blockId
            ? {
                ...block,
                shifts: [
                  ...block.shifts,
                  {
                    id: localShiftId,
                    start: data.startTime,
                    end: data.endTime,
                    description: data.description,
                    volunteerIds: data.selectedIds,
                    manualNames,
                  },
                ],
              }
            : block
        )
      );
    }

    setShiftEditor(null);
    showToast(data.shiftId ? "Turno atualizado." : "Escala criada.");

    if (!isOnline) {
      showToast("Salvo offline. Sincronize quando voltar a internet.");
      return;
    }

    try {
      let targetShiftId = data.shiftId;
      if (targetShiftId) {
        await updateShift(departmentId, targetShiftId, {
          start_time: data.startTime,
          end_time: data.endTime,
          description: data.description,
        });
      } else {
        const created = await createShift(departmentId, data.blockId, {
          start_time: data.startTime,
          end_time: data.endTime,
          description: data.description,
        });
        targetShiftId = created.id;
        setSchedule((current) =>
          current.map((block) =>
            block.id === data.blockId
              ? {
                  ...block,
                  shifts: block.shifts.map((shift) =>
                    shift.id === localShiftId ? { ...shift, id: targetShiftId } : shift
                  ),
                }
              : block
          )
        );
      }

      const assignments = [
        ...data.selectedIds.map((id) => ({ volunteer_id: id, manual_name: null })),
        ...(data.manualName ? [{ volunteer_id: null, manual_name: data.manualName }] : []),
      ];
      await saveShiftAssignments(targetShiftId, assignments, departmentId);
    } catch (error) {
      console.warn("Falha ao salvar escala no Supabase.", error);
      showToast("Escala salva offline. Sincronize quando voltar a internet.");
    }
  }

  async function saveVolunteer(event) {
    event.preventDefault();
    const name = volunteerForm.name.trim();
    if (!name || !departmentId) return;

    const payload = {
      ...volunteerForm,
      name,
      congregation: volunteerForm.congregation.trim(),
      phone: volunteerForm.phone.trim(),
    };

    if (!isOnline) {
      if (payload.id) {
        setVolunteers((current) => current.map((volunteer) => (volunteer.id === payload.id ? payload : volunteer)));
        showToast("Voluntário atualizado offline.");
      } else {
        setVolunteers((current) => [{ ...payload, id: makeId("local-v"), active: true }, ...current]);
        showToast("Voluntário cadastrado offline.");
      }
      setVolunteerForm(emptyVolunteer());
      return;
    }

    try {
      const dbData = mapAppVolunteerToDb(payload);
      if (payload.id && !String(payload.id).startsWith("local-")) {
        const updated = await updateVolunteer(payload.id, departmentId, dbData);
        setVolunteers((current) => current.map((volunteer) => (volunteer.id === payload.id ? updated : volunteer)));
        showToast("Voluntário atualizado.");
      } else {
        const created = await createVolunteer(departmentId, dbData);
        setVolunteers((current) => [created, ...current]);
        showToast("Voluntário cadastrado.");
      }
      setVolunteerForm(emptyVolunteer());
    } catch (error) {
      console.warn("Falha ao salvar voluntário no Supabase.", error);
      showToast("Não foi possível salvar no Supabase.");
    }
  }

  async function removeVolunteer(id) {
    setVolunteers((current) => current.filter((volunteer) => volunteer.id !== id));
    setSchedule((current) =>
      current.map((block) => ({
        ...block,
        shifts: block.shifts.map((shift) => ({
          ...shift,
          volunteerIds: shift.volunteerIds.filter((volunteerId) => volunteerId !== id),
        })),
      }))
    );
    showToast("Voluntário removido da lista e da escala.");

    if (!isOnline || String(id).startsWith("local-") || !departmentId) return;

    try {
      await deleteVolunteer(id, departmentId);
    } catch (error) {
      console.warn("Falha ao excluir voluntário no Supabase.", error);
    }
  }

  async function approveVolunteer(id) {
    if (!departmentId) return;

    if (!isOnline) {
      setVolunteers((current) =>
        current.map((volunteer) => (volunteer.id === id ? { ...volunteer, active: true } : volunteer))
      );
      showToast("Voluntário aprovado offline.");
      return;
    }

    try {
      await updateVolunteer(id, departmentId, { active: true });
      setVolunteers((current) =>
        current.map((volunteer) => (volunteer.id === id ? { ...volunteer, active: true } : volunteer))
      );
      showToast("Voluntário aprovado!");
    } catch (error) {
      console.warn("Falha ao aprovar voluntário.", error);
      showToast("Não foi possível aprovar o voluntário.");
    }
  }

  async function rejectVolunteer(id) {
    setVolunteers((current) => current.filter((volunteer) => volunteer.id !== id));
    showToast("Cadastro recusado.");

    if (!isOnline || String(id).startsWith("local-") || !departmentId) return;

    try {
      await deleteVolunteer(id, departmentId);
    } catch (error) {
      console.warn("Falha ao recusar voluntário.", error);
    }
  }

  async function saveItem(event) {
    event.preventDefault();
    const itemName = itemForm.item.trim();
    if (!itemName || !departmentId) return;

    let photoUrl = itemForm.photo || "";

    if (itemForm.imageFile && isOnline) {
      try {
        photoUrl = await uploadImage(itemForm.imageFile);
      } catch (uploadError) {
        console.warn("Falha ao fazer upload da imagem.", uploadError);
        showToast("Falha no upload da imagem. Salvando sem foto.");
        photoUrl = "";
      }
    }

    const payload = {
      id: itemForm.id,
      person: itemForm.person.trim(),
      item: itemName,
      day: itemForm.day,
      status: itemForm.status,
      photo: photoUrl,
    };

    if (!isOnline) {
      if (payload.id) {
        setItems((current) => current.map((item) => (item.id === payload.id ? payload : item)));
        showToast("Item atualizado offline.");
      } else {
        setItems((current) => [{ ...payload, id: makeId("local-i") }, ...current]);
        showToast("Item cadastrado offline.");
      }
      setItemForm(emptyItem());
      return;
    }

    try {
      const dbData = mapAppItemToDb(payload);
      if (payload.id && !String(payload.id).startsWith("local-")) {
        if (itemForm.imageFile) {
          dbData.oldPhotoUrl = items.find((i) => i.id === payload.id)?.photo || "";
        }
        const updated = await updateLostItem(payload.id, departmentId, dbData);
        setItems((current) => current.map((item) => (item.id === payload.id ? mapDbItemToApp(updated) : item)));
        showToast("Item atualizado.");
      } else {
        const created = await createLostItem(departmentId, dbData);
        setItems((current) => [mapDbItemToApp(created), ...current]);
        showToast("Item cadastrado.");
      }
      setItemForm(emptyItem());
    } catch (error) {
      console.warn("Falha ao salvar item no Supabase.", error);
      showToast("Não foi possível salvar no Supabase.");
    }
  }

  async function removeItem(id) {
    setItems((current) => current.filter((item) => item.id !== id));
    showToast("Item removido do checklist.");

    if (!isOnline || String(id).startsWith("local-") || !departmentId) return;

    try {
      await deleteLostItem(id, departmentId);
    } catch (error) {
      console.warn("Falha ao excluir item no Supabase.", error);
    }
  }

  async function updateItemStatus(id, status) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));

    if (!isOnline || String(id).startsWith("local-") || !departmentId) return;

    try {
      await updateLostItemStatus(id, departmentId, status);
    } catch (error) {
      console.warn("Falha ao atualizar status no Supabase.", error);
    }
  }

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  const activeView = location.pathname;
  const routeTitle = ROUTE_TITLES[activeView] || "";

  function navTo(path) {
    navigate(path);
    setShowDeptSwitcher(false);
  }

  return (
    <div className="ap-app min-h-screen bg-[#f6f6f6] text-slate-900">
      {toast && (
        <div className="app-toast fixed left-1/2 -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      <aside className="fixed left-0 top-0 hidden h-full w-72 border-r border-[#172233] bg-[#172233] p-5 backdrop-blur-xl lg:block">
        <div>
          <img src={logo} alt="" className="mx-auto mb-8 h-[120px] w-[120px] object-contain" />
          {hasMultipleDepts && departmentId ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDeptSwitcher(!showDeptSwitcher)}
                className="flex w-full items-center gap-2 text-left transition hover:opacity-80"
              >
                <h1 className="font-semibold leading-tight text-[#42d27b] truncate">
                  {departmentName || "Selecionar departamento"}
                </h1>
                <i className={`fi fi-rr-angle-small-down text-sm text-[#42d27b] transition-transform ${showDeptSwitcher ? "rotate-180" : ""}`} />
              </button>
              {showDeptSwitcher && (
                <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-[#2a3a4f] bg-[#1e2d40] p-2 shadow-2xl">
                  {departments.map((dept) => {
                    const deptName = dept.department?.name || "Departamento";
                    const isActive = dept.department?.id === departmentId;
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => { selectDepartment(dept); setShowDeptSwitcher(false); }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          isActive
                            ? "bg-[#42d27b]/15 text-[#42d27b]"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <i className={`fi fi-rr-building text-base ${isActive ? "text-[#42d27b]" : "text-slate-500"}`} />
                        <span className="truncate">{deptName}</span>
                        {isActive && <i className="fi fi-rr-check ml-auto text-xs text-[#42d27b]" />}
                      </button>
                    );
                  })}
                  <div className="my-1 border-t border-[#2a3a4f]" />
                  <button
                    type="button"
                    onClick={() => { selectDepartment(null); setShowDeptSwitcher(false); }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
                  >
                    <i className="fi fi-rr-apps text-base text-slate-500" />
                    Ver todos os departamentos
                  </button>
                </div>
              )}
            </div>
          ) : (
            <h1 className="font-semibold leading-tight text-[#42d27b]">
              {departmentName || "Achados Perdidos & Guarda Volumes"}
            </h1>
          )}
        </div>

        <div className="mt-10 flex items-center gap-4 px-2">
          <span className="text-base font-semibold text-[#d8ff56]">Menu</span>
          <span className="h-px flex-1 border-t border-dashed border-[#d8ff56]/35" />
        </div>

        <nav className="mt-5 space-y-2">
          {visibleNavigationItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navTo(item.path)}
              className={`app-nav-button flex w-full items-center gap-3 text-sm transition ${
                activeView === item.path ? "is-active" : ""
              }`}
            >
              <i className={item.iconClass} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-72">
        {departmentId && (
          <div className="mobile-department-brand px-4 pb-2 pt-5 lg:hidden">
            <h1 className="font-semibold leading-tight text-[#42d27b]">
              {departmentName}
            </h1>
          </div>
        )}

        <header className="ap-header">
          <div className="w-full bg-white px-5 py-5 shadow-sm md:px-8 md:py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight text-[#172233] md:text-3xl">
                {activeView === "/" ? (departmentName || "Dashboard") : routeTitle}
              </h1>
              {user && (
                <button
                  onClick={() => logout()}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
                >
                  Sair
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="ap-main-content space-y-6 p-4 md:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
          </Routes>

          {departmentId && activeView !== "/" && (
            <>
              <p className="text-sm font-medium capitalize text-slate-500 md:text-base">
                {formatCurrentDate(now)}
              </p>

              <div className="ap-stats-scroll -mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
                <div className="ap-stats-row flex min-w-max gap-3 md:grid md:min-w-0 md:grid-cols-3 md:gap-4">
                  <Stat
                    icon="clock"
                    label="Turnos"
                    value={totalShifts}
                    detail={assignedShifts + "/" + totalShifts + " designado"}
                    day={activeDay}
                  />
                  <Stat
                    icon="users"
                    label="Voluntários"
                    value={volunteers.filter((volunteer) => volunteer.active !== false).length}
                    detail="cadastros ativos"
                    day={activeDay}
                  />
                  <Stat
                    icon="checklist"
                    label="Checklist"
                    value={pendingItems}
                    detail="itens perdidos"
                    day={activeDay}
                  />
                </div>
              </div>
            </>
          )}

          <Routes>
            {activeView !== "/" && (
              <>
                <Route
                  path="/programacao"
                  element={
                    <Programacao
                      activeDay={activeDay}
                      setActiveDay={setActiveDay}
                      dayCards={dayCards}
                      volunteers={volunteers}
                      now={now}
                      onEditShift={handleEditShift}
                      onCreateShift={handleCreateShift}
                      departmentName={departmentName}
                    />
                  }
                />
                <Route
                  path="/voluntarios"
                  element={
                    <Voluntarios
                      volunteers={volunteers}
                      volunteerForm={volunteerForm}
                      setVolunteerForm={setVolunteerForm}
                      onSave={saveVolunteer}
                      onEdit={setVolunteerForm}
                      onDelete={removeVolunteer}
                      onApprove={approveVolunteer}
                      onReject={rejectVolunteer}
                      departmentName={departmentName}
                    />
                  }
                />
                <Route
                  path="/itens"
                  element={
                    <ItensPerdidos
                      query={query}
                      setQuery={setQuery}
                      items={filteredItems}
                      itemForm={itemForm}
                      setItemForm={setItemForm}
                      onSave={saveItem}
                      onEdit={setItemForm}
                      onDelete={removeItem}
                      onStatusChange={updateItemStatus}
                    />
                  }
                />
                <Route
                  path="/departamentos"
                  element={<GerenciarDepartamentos />}
                />
                <Route
                  path="/configuracoes"
                  element={<Configuracoes />}
                />
              </>
            )}
          </Routes>
        </section>
      </main>

      <div className="ap-mobile-nav lg:hidden">
        {visibleNavigationItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navTo(item.path)}
            className={`app-mobile-nav-button ${activeView === item.path ? "is-active" : ""}`}
          >
            <i className={item.iconClass} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {shiftEditor && (
        <ShiftEditorModal
          shiftEditor={shiftEditor}
          volunteers={volunteers}
          schedule={schedule}
          onClose={() => setShiftEditor(null)}
          onSave={saveShiftFromModal}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/p/:slug/cadastro" element={<PublicCadastro />} />
        <Route path="/p/:slug/escala" element={<PublicEscala />} />
        <Route
          path="*"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        />
      </Routes>
    </HashRouter>
  );
}
