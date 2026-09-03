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
  getLostItems,
  createLostItem,
  updateLostItem,
  deleteLostItem,
  updateLostItemStatus,
} from "./services/itemsService";
import {
  getVolunteers,
  createVolunteer,
  updateVolunteer,
  deleteVolunteer,
} from "./services/volunteersService";
import {
  fetchDepartmentData,
  assignVolunteersToShift,
} from "./services/scheduleService";
import { Stat, Button } from "./components/UI";
import ShiftEditorModal from "./components/ShiftEditorModal";
import LoginModal from "./components/LoginModal";
import Programacao from "./pages/Programacao";
import Voluntarios from "./pages/Voluntarios";
import ItensPerdidos from "./pages/ItensPerdidos";
import GerenciarDepartamentos from "./pages/GerenciarDepartamentos";
import PublicCadastro from "./pages/PublicCadastro";

function EmptyDepartment() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-4xl">
        <i className="fi fi-rr-building" />
      </div>
      <h2 className="mt-6 text-2xl font-bold text-[#172233]">Nenhum departamento selecionado</h2>
      <p className="mt-3 max-w-md text-sm text-slate-500">
        Para acessar o painel, faça login e selecione um departamento ao qual você pertence.
      </p>
    </div>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, activeDepartment } = useAuth();

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
  const [loginModal, setLoginModal] = useState(null);

  const departmentId = activeDepartment?.id || activeDepartment?.department?.id || null;

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
        const backup = loadOfflineSnapshot();
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

  async function handleLoginFromModal(email, password) {
    await login(email, password);
    if (loginModal?.callback) {
      loginModal.callback(...(loginModal.args || []));
    }
    setLoginModal(null);
  }

  function handleEditShift(payload) {
    if (user) {
      setShiftEditor(payload);
    } else {
      setLoginModal({ callback: (p) => setShiftEditor(p), args: [payload] });
    }
  }

  async function saveShiftVolunteers(selectedIds) {
    if (!shiftEditor || !departmentId) return;
    const targetShiftId = shiftEditor.shiftId;
    const nextSchedule = schedule.map((block) => ({
      ...block,
      shifts: block.shifts.map((shift) =>
        shift.id === targetShiftId ? { ...shift, volunteerIds: selectedIds } : shift
      ),
    }));

    setSchedule(nextSchedule);
    setShiftEditor(null);
    showToast("Voluntários atualizados no turno.");

    if (!isOnline) return;

    try {
      await assignVolunteersToShift(targetShiftId, selectedIds, departmentId);
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

  function navTo(path) {
    navigate(path);
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
          <p className="text-sm text-slate-400">Departamento</p>
          <h1 className="font-semibold leading-tight text-[#42d27b]">Achados Perdidos & Guarda Volumes</h1>
        </div>

        <div className="mt-10 flex items-center gap-4 px-2">
          <span className="text-base font-semibold text-[#d8ff56]">Menu</span>
          <span className="h-px flex-1 border-t border-dashed border-[#d8ff56]/35" />
        </div>

        <nav className="mt-5 space-y-2">
          {navigationItems.map((item) => (
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
        <div className="mobile-department-brand px-4 pb-2 pt-5">
          <p className="text-sm text-slate-400">Departamento</p>
          <h1 className="font-semibold leading-tight text-[#42d27b]">Achados Perdidos & Guarda Volumes</h1>
        </div>

        <header className="ap-header">
          <div className="w-full bg-white px-5 py-5 shadow-sm md:px-8 md:py-6">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold tracking-tight text-[#172233] md:text-3xl">Dashboard</h1>
              {user ? (
                <button
                  onClick={() => useAuth().logout()}
                  className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
                >
                  Sair
                </button>
              ) : (
                <button
                  onClick={() => setLoginModal({ callback: null, args: [] })}
                  className="rounded-full bg-[#172233] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#101827]"
                >
                  Entrar
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="ap-main-content space-y-6 p-4 md:p-8">
          {!departmentId ? (
            <EmptyDepartment />
          ) : (
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
                    value={volunteers.length}
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

              <Routes>
                <Route
                  path="/"
                  element={
                    <Programacao
                      activeDay={activeDay}
                      setActiveDay={setActiveDay}
                      dayCards={dayCards}
                      volunteers={volunteers}
                      now={now}
                      onEditShift={handleEditShift}
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
              </Routes>
            </>
          )}
        </section>
      </main>

      <div className="ap-mobile-nav lg:hidden">
        {navigationItems.map((item) => (
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

      {loginModal && (
        <LoginModal
          onLogin={handleLoginFromModal}
          onClose={() => setLoginModal(null)}
        />
      )}

      {shiftEditor && (
        <ShiftEditorModal
          shiftEditor={shiftEditor}
          volunteers={volunteers}
          schedule={schedule}
          onClose={() => setShiftEditor(null)}
          onSave={saveShiftVolunteers}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/p/:slug/cadastro" element={<PublicCadastro />} />
        <Route path="*" element={<AppLayout />} />
      </Routes>
    </HashRouter>
  );
}
