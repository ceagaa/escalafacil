import { useState, useEffect, useMemo, lazy, Suspense, Component } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import {
  initialSchedule,
  initialVolunteers,
  emptyVolunteer,
  sanitizeLoadedSchedule,
  mapAppVolunteerToDb,
  makeId,
  buildOfflineSnapshot,
  saveOfflineSnapshot,
  loadOfflineSnapshot,
  navigationItems,
} from "./utils/helpers";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useAuth } from "./context/AuthContext";
import { useEvent } from "./context/EventContext";
import {
  createVolunteer,
  updateVolunteer,
  deleteVolunteer,
} from "./services/volunteersService";
import {
  fetchDepartmentData,
  createShift,
  updateShift,
  deleteShift,
  saveShiftAssignments,
} from "./services/scheduleService";
import ShiftEditorModal from "./components/ShiftEditorModal";
import RequireAuth from "./components/RequireAuth";

const Login = lazy(() => import("./pages/Login"));
const EventSelector = lazy(() => import("./pages/EventSelector"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Programacao = lazy(() => import("./pages/Programacao"));
const Voluntarios = lazy(() => import("./pages/Voluntarios"));
const MeusDepartamentos = lazy(() => import("./pages/MeusDepartamentos"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const PublicCadastro = lazy(() => import("./pages/PublicCadastro"));
const PublicEscala = lazy(() => import("./pages/PublicEscala"));
const AllocateVolunteersModal = lazy(() => import("./components/AllocateVolunteersModal"));
import logo from "./assets/img/logotipo.webp";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface-50">
          <div className="text-center">
            <p className="text-sm text-slate-500">Erro ao carregar. Recarregue a página.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-brand-400 px-4 py-2 text-sm font-medium text-navy-800"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const CONGRESSO_DAYS = ["Sexta-feira", "Sábado", "Domingo"];

/** Retorna o rótulo do primeiro dia da escala para o tipo de evento. */
function getDefaultDay(eventType) {
  if (eventType === "congresso_regional") return CONGRESSO_DAYS[0];
  return "Dia do Evento";
}

/** Localiza um turno no estado local da escala. */
function findShift(schedule, blockId, shiftId) {
  return schedule.find((block) => block.id === blockId)
    ?.shifts.find((shift) => shift.id === shiftId) || null;
}

/** Converte os nomes avulsos do turno em linhas de shift_volunteers. */
function buildManualAssignments(shift) {
  return (shift?.manualNames || []).map((name) => ({ volunteer_id: null, manual_name: name }));
}

const ROUTE_TITLES = {
  "/": "Resumo",
  "/programacao": "Escala",
  "/voluntarios": "Voluntários",
  "/meus-departamentos": "Meus departamentos",
  "/departamentos": "Departamentos",
  "/configuracoes": "Configurações",
};

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, activeDepartment, departments, selectDepartment } = useAuth();
  const { activeEvent, eventoId, eventLoading, clearEvent } = useEvent();

  const [activeDay, setActiveDay] = useState(() => getDefaultDay(activeEvent?.tipo));
  const [schedule, setSchedule] = useLocalStorage("ap_schedule_v4_validation", initialSchedule, sanitizeLoadedSchedule);
  const [volunteers, setVolunteers] = useLocalStorage("ap_volunteers", initialVolunteers);
  const [shiftEditor, setShiftEditor] = useState(null);
  const [volunteerForm, setVolunteerForm] = useState(emptyVolunteer());
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [hasLoadedRemoteData, setHasLoadedRemoteData] = useState(false);
  const [showDeptSwitcher, setShowDeptSwitcher] = useState(false);
  const [allocateModal, setAllocateModal] = useState(null);

  const departmentId = activeDepartment?.department?.id || activeDepartment?.id || null;
  const departmentName = activeDepartment?.department?.name || "";
  const isCoordinator = activeDepartment?.role === "coordenador";
  const hasDepartment = Boolean(departmentId);

  const visibleNavigationItems = useMemo(
    () => navigationItems.filter((item) => {
      if (item.requiresDepartment && !hasDepartment) return false;
      if (item.coordinatorOnly && !isCoordinator) return false;
      return true;
    }),
    [isCoordinator, hasDepartment]
  );

  const hasMultipleDepts = departments.length > 1;

  // Mantém o dia ativo coerente com o evento selecionado (assembleia tem um dia só).
  useEffect(() => {
    setActiveDay(getDefaultDay(activeEvent?.tipo));
  }, [eventoId, activeEvent?.tipo]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    setHasLoadedRemoteData(false);
  }, [departmentId, eventoId]);

  useEffect(() => {
    async function loadRemoteData() {
      if (!isOnline || hasLoadedRemoteData || !departmentId || !eventoId) return;
      try {
        const data = await fetchDepartmentData(departmentId, initialVolunteers);
        setSchedule(data.schedule);
        setVolunteers(data.volunteers);
        setHasLoadedRemoteData(true);
        showToast("Dados sincronizados com Supabase.");
      } catch (error) {
        console.warn("Falha ao buscar dados no Supabase.", error);
        showToast("Falha Supabase: " + (error?.message || "verifique tabelas/RLS"));
        const backup = await loadOfflineSnapshot();
        if (backup) {
          setSchedule(backup.schedule || initialSchedule);
          setVolunteers(backup.volunteers || initialVolunteers);
        }
      }
    }
    loadRemoteData();
  }, [isOnline, hasLoadedRemoteData, departmentId, eventoId, setSchedule, setVolunteers]);

  useEffect(() => {
    const snapshot = buildOfflineSnapshot(schedule, volunteers);
    saveOfflineSnapshot(snapshot);
  }, [schedule, volunteers]);

  const dayCards = useMemo(() => schedule.filter((item) => item.day === activeDay), [schedule, activeDay]);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  /** Persiste as designações de um turno preservando os nomes avulsos. */
  function persistAssignments(shiftId, volunteerIds, manualAssignments, actionLabel) {
    if (!departmentId || String(shiftId).startsWith("local-")) return;
    const assignments = [
      ...volunteerIds.map((id) => ({ volunteer_id: id, manual_name: null })),
      ...manualAssignments,
    ];
    saveShiftAssignments(shiftId, assignments, departmentId).catch((err) => {
      console.warn("Falha ao salvar " + actionLabel + ".", err);
      showToast("Não foi possível salvar a " + actionLabel + " no servidor.");
    });
  }

  function handleEditShift(payload) { setShiftEditor(payload); }
  function handleCreateShift(blockId) { setShiftEditor({ blockId, shiftId: null }); }

  async function handleDeleteShift(blockId, shiftId) {
    if (!departmentId) return;
    setSchedule((current) =>
      current.map((block) =>
        block.id === blockId
          ? { ...block, shifts: block.shifts.filter((s) => s.id !== shiftId) }
          : block
      )
    );
    if (String(shiftId).startsWith("local-")) {
      showToast("Turno excluído.");
      return;
    }
    if (!isOnline) {
      showToast("Turno excluído offline. Sincronize quando voltar a internet.");
      return;
    }
    try {
      await deleteShift(departmentId, shiftId);
      showToast("Turno excluído.");
    } catch (error) {
      console.warn("Falha ao excluir turno no Supabase.", error);
      showToast("Não foi possível excluir o turno. Recarregue a página.");
      setHasLoadedRemoteData(false);
    }
  }

  function handleOpenAllocate(payload) {
    setAllocateModal(payload);
  }

  function handleAllocateVolunteer(volunteerId) {
    if (!allocateModal) return;
    const { blockId, shiftId } = allocateModal;
    const currentShift = findShift(schedule, blockId, shiftId);
    const currentIds = currentShift?.volunteerIds || [];
    if (currentIds.includes(volunteerId)) return;
    const newIds = [...currentIds, volunteerId];
    const manualAssignments = buildManualAssignments(currentShift);
    setSchedule((current) =>
      current.map((block) =>
        block.id === blockId
          ? { ...block, shifts: block.shifts.map((s) => s.id === shiftId ? { ...s, volunteerIds: newIds } : s) }
          : block
      )
    );
    setAllocateModal((prev) => prev ? { ...prev, shift: { ...prev.shift, volunteerIds: newIds } } : null);
    persistAssignments(shiftId, newIds, manualAssignments, "alocação");
  }

  function handleDeallocateVolunteer(volunteerId) {
    if (!allocateModal) return;
    const { blockId, shiftId } = allocateModal;
    const currentShift = findShift(schedule, blockId, shiftId);
    const currentIds = currentShift?.volunteerIds || [];
    const newIds = currentIds.filter((id) => id !== volunteerId);
    const manualAssignments = buildManualAssignments(currentShift);
    setSchedule((current) =>
      current.map((block) =>
        block.id === blockId
          ? { ...block, shifts: block.shifts.map((s) => s.id === shiftId ? { ...s, volunteerIds: newIds } : s) }
          : block
      )
    );
    setAllocateModal((prev) => prev ? { ...prev, shift: { ...prev.shift, volunteerIds: newIds } } : null);
    persistAssignments(shiftId, newIds, manualAssignments, "desalocação");
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
              ? { ...shift, start: data.startTime, end: data.endTime, description: data.description, vagas: data.vagas, volunteerIds: data.selectedIds, manualNames }
              : shift
          ),
        }))
      );
    } else {
      localShiftId = makeId("local-shift");
      setSchedule((current) =>
        current.map((block) =>
          block.id === data.blockId
            ? { ...block, shifts: [...block.shifts, { id: localShiftId, start: data.startTime, end: data.endTime, description: data.description, vagas: data.vagas, volunteerIds: data.selectedIds, manualNames }] }
            : block
        )
      );
    }

    setShiftEditor(null);

    if (!isOnline) {
      showToast("Salvo offline. Sincronize quando voltar a internet.");
      return;
    }

    showToast(data.shiftId ? "Salvando turno..." : "Criando turno...");

    try {
      let targetShiftId = data.shiftId;
      if (targetShiftId) {
        await updateShift(departmentId, targetShiftId, { start_time: data.startTime, end_time: data.endTime, description: data.description, vagas: data.vagas });
      } else {
        const created = await createShift(departmentId, data.blockId, { start_time: data.startTime, end_time: data.endTime, description: data.description, vagas: data.vagas });
        targetShiftId = created.id;
        setSchedule((current) =>
          current.map((block) =>
            block.id === data.blockId
              ? { ...block, shifts: block.shifts.map((shift) => shift.id === localShiftId ? { ...shift, id: targetShiftId } : shift) }
              : block
          )
        );
      }
      const assignments = [
        ...data.selectedIds.map((id) => ({ volunteer_id: id, manual_name: null })),
        ...(data.manualName ? [{ volunteer_id: null, manual_name: data.manualName }] : []),
      ];
      await saveShiftAssignments(targetShiftId, assignments, departmentId);
      showToast(data.shiftId ? "Turno atualizado." : "Turno criado.");
    } catch (error) {
      console.warn("Falha ao salvar escala no Supabase.", error);
      showToast("Não foi possível salvar no servidor. Recarregue a página.");
      setHasLoadedRemoteData(false);
    }
  }

  async function saveVolunteer(event) {
    event.preventDefault();
    const name = volunteerForm.name.trim();
    if (!name || !departmentId) return;
    const payload = { ...volunteerForm, name, congregation: volunteerForm.congregation.trim(), phone: volunteerForm.phone.trim() };

    if (!isOnline) {
      if (payload.id) {
        setVolunteers((current) => current.map((v) => (v.id === payload.id ? payload : v)));
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
        setVolunteers((current) => current.map((v) => (v.id === payload.id ? updated : v)));
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
    setVolunteers((current) => current.filter((v) => v.id !== id));
    setSchedule((current) =>
      current.map((block) => ({
        ...block,
        shifts: block.shifts.map((shift) => ({
          ...shift,
          volunteerIds: shift.volunteerIds.filter((vid) => vid !== id),
        })),
      }))
    );
    if (!isOnline || String(id).startsWith("local-") || !departmentId) {
      showToast("Voluntário removido da lista e da escala.");
      return;
    }
    try {
      await deleteVolunteer(id, departmentId);
      showToast("Voluntário removido da lista e da escala.");
    } catch (error) {
      console.warn("Falha ao excluir voluntário no Supabase.", error);
      showToast("Não foi possível excluir no servidor. Recarregue a página.");
      setHasLoadedRemoteData(false);
    }
  }

  async function approveVolunteer(id) {
    if (!departmentId) return;
    if (!isOnline) {
      setVolunteers((current) => current.map((v) => (v.id === id ? { ...v, active: true } : v)));
      showToast("Voluntário aprovado offline.");
      return;
    }
    try {
      await updateVolunteer(id, departmentId, { active: true });
      setVolunteers((current) => current.map((v) => (v.id === id ? { ...v, active: true } : v)));
      showToast("Voluntário aprovado.");
    } catch (error) {
      console.warn("Falha ao aprovar voluntário.", error);
      showToast("Não foi possível aprovar o voluntário.");
    }
  }

  async function rejectVolunteer(id) {
    setVolunteers((current) => current.filter((v) => v.id !== id));
    if (!isOnline || String(id).startsWith("local-") || !departmentId) {
      showToast("Cadastro recusado.");
      return;
    }
    try {
      await deleteVolunteer(id, departmentId);
      showToast("Cadastro recusado.");
    } catch (error) {
      console.warn("Falha ao recusar voluntário.", error);
      showToast("Não foi possível recusar no servidor. Recarregue a página.");
      setHasLoadedRemoteData(false);
    }
  }

  function handleLogout() {
    selectDepartment(null);
    clearEvent();
    logout();
  }

  useEffect(() => {
    if (!eventoId && activeDepartment) {
      selectDepartment(null);
    }
  }, [eventoId, activeDepartment, selectDepartment]);

  const activeView = location.pathname;
  const routeTitle = ROUTE_TITLES[activeView] || "";

  function navTo(path) {
    navigate(path);
    setShowDeptSwitcher(false);
  }

  if (eventLoading) {
    return (
      <div className="ap-app min-h-screen bg-surface-50 text-slate-900">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-slate-400">Carregando evento...</p>
        </div>
      </div>
    );
  }

  if (!eventoId) {
    return (
      <div className="ap-app min-h-screen bg-surface-50 text-slate-900">
        <header className="ap-header">
          <div className="w-full bg-white px-5 py-5 shadow-sm md:px-8 md:py-6">
            <div className="flex items-center justify-between">
              <img src={logo} alt="EscalaFácil" className="h-8 w-auto" />
              {user && (
                <button onClick={handleLogout} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200">Sair</button>
              )}
            </div>
          </div>
        </header>
        <section className="ap-main-content space-y-6 p-4 md:p-8">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><p className="text-sm text-slate-400">Carregando...</p></div>}>
            <EventSelector />
          </Suspense>
        </section>
      </div>
    );
  }

  return (
    <div className="ap-app min-h-screen bg-surface-50 text-slate-900">
      <a href="#main" className="skip-link">Pular para o conteúdo</a>

      {toast && (
        <div role="alert" className="app-toast fixed left-1/2 -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      <aside className="fixed left-0 top-0 hidden h-full w-72 border-r border-navy-800 bg-navy-800 p-5 backdrop-blur-xl lg:block" aria-label="Menu principal">
        <div>
          <img src={logo} alt="EscalaFácil" className="mx-auto mb-6 h-[100px] w-[100px] object-contain" />

          {hasDepartment ? (
            <div className="relative mt-4">
              {hasMultipleDepts ? (
                <>
                  <button type="button" onClick={() => setShowDeptSwitcher(!showDeptSwitcher)} className="flex w-full items-center gap-2 text-left transition hover:opacity-80">
                    <h1 className="font-semibold leading-tight text-brand-400 truncate">{departmentName}</h1>
                    <i className={`fi fi-rr-angle-small-down text-sm text-brand-400 transition-transform ${showDeptSwitcher ? "rotate-180" : ""}`} />
                  </button>
                  {showDeptSwitcher && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-2xl border border-navy-800 bg-navy-800 p-2 shadow-2xl">
                      {departments.map((dept) => {
                        const deptName = dept.department?.name || "Departamento";
                        const isActive = dept.department?.id === departmentId;
                        return (
                          <button key={dept.id} type="button" onClick={() => { selectDepartment(dept); setShowDeptSwitcher(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${isActive ? "bg-brand-400/15 text-brand-400" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
                            <i className={`fi fi-rr-building text-base ${isActive ? "text-brand-400" : "text-slate-500"}`} />
                            <span className="truncate">{deptName}</span>
                            {isActive && <i className="fi fi-rr-check ml-auto text-xs text-brand-400" />}
                          </button>
                        );
                      })}
                      <div className="my-1 border-t border-navy-800" />
                      <button type="button" onClick={() => { selectDepartment(null); setShowDeptSwitcher(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-white">
                        <i className="fi fi-rr-apps text-base text-slate-500" />
                        Ver todos os departamentos
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <h1 className="font-semibold leading-tight text-brand-400">{departmentName}</h1>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-xs text-slate-400">Nenhum departamento selecionado</p>
              <p className="mt-1 text-xs text-slate-500">Acesse o Dashboard para escolher um departamento.</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center gap-4 px-2">
          <span className="text-base font-semibold text-[#d8ff56]">Menu</span>
          <span className="h-px flex-1 border-t border-dashed border-[#d8ff56]/35" />
        </div>

        <nav className="mt-5 space-y-2" aria-label="Navegação principal">
          {visibleNavigationItems.map((item) => (
            <button key={item.path} onClick={() => navTo(item.path)} className={`app-nav-button flex w-full items-center gap-3 text-sm transition ${activeView === item.path ? "is-active" : ""}`}>
              <i className={item.iconClass} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-5 left-5 right-5">
          <button
            type="button"
            onClick={() => { clearEvent(); selectDepartment(null); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <i className="fi fi-rr-arrow-left text-base text-slate-500" />
            Trocar Evento
          </button>
        </div>
      </aside>

      <main id="main" tabIndex={-1} className="lg:pl-72">
        {hasDepartment && (
          <div className="mobile-department-brand px-4 pb-2 pt-5 lg:hidden">
            <h1 className="font-semibold leading-tight text-brand-400">{departmentName}</h1>
          </div>
        )}

        <header className="ap-header">
          <div className="w-full bg-white px-5 py-5 shadow-sm md:px-8 md:py-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-bold tracking-tight text-navy-800 md:text-3xl">
                  {activeView === "/"
                    ? (hasDepartment ? departmentName : "Dashboard")
                    : routeTitle}
                </h1>
              </div>
              <div className="hidden items-center gap-3 md:flex">
                {user && (
                  <button onClick={handleLogout} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-200">Sair</button>
                )}
              </div>
            </div>
          </div>
        </header>

        <section className="ap-main-content space-y-6 p-4 md:p-8">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><p className="text-sm text-slate-400">Carregando...</p></div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/departamentos" element={<Dashboard forcePicker />} />
              <Route path="/meus-departamentos" element={<MeusDepartamentos />} />
              {hasDepartment && (
                <>
                  <Route path="/programacao" element={<Programacao activeDay={activeDay} setActiveDay={setActiveDay} dayCards={dayCards} volunteers={volunteers} now={now} onEditShift={handleEditShift} onCreateShift={handleCreateShift} onDeleteShift={handleDeleteShift} onAllocateVolunteers={handleOpenAllocate} departmentName={departmentName} eventType={activeEvent?.tipo} dataEvento={activeEvent?.data_evento} />} />
                  <Route path="/voluntarios" element={<Voluntarios volunteers={volunteers} volunteerForm={volunteerForm} setVolunteerForm={setVolunteerForm} onSave={saveVolunteer} onEdit={setVolunteerForm} onDelete={removeVolunteer} onApprove={approveVolunteer} onReject={rejectVolunteer} departmentName={departmentName} />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                </>
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </section>
      </main>

      <div className="ap-mobile-nav lg:hidden">
        {visibleNavigationItems.map((item) => (
          <button key={item.path} onClick={() => navTo(item.path)} className={`app-mobile-nav-button ${activeView === item.path ? "is-active" : ""}`}>
            <i className={item.iconClass} />
            <span>{item.label}</span>
          </button>
        ))}
        <button onClick={handleLogout} className="app-mobile-nav-button">
          <i className="fi fi-rr-sign-out" />
          <span>Sair</span>
        </button>
      </div>

      {shiftEditor && (
        <ShiftEditorModal shiftEditor={shiftEditor} volunteers={volunteers} schedule={schedule} onClose={() => setShiftEditor(null)} onSave={saveShiftFromModal} />
      )}

      {allocateModal && (
        <AllocateVolunteersModal
          block={allocateModal.block}
          shift={allocateModal.shift}
          volunteers={volunteers.filter((v) => v.active !== false)}
          assignedVolunteerIds={allocateModal.shift?.volunteerIds || []}
          onAllocate={handleAllocateVolunteer}
          onDeallocate={handleDeallocateVolunteer}
          onClose={() => setAllocateModal(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-surface-50"><p className="text-sm text-slate-400">Carregando...</p></div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/:slug/cadastro" element={<PublicCadastro />} />
            <Route path="/:slug/escala" element={<PublicEscala />} />
            <Route path="*" element={<RequireAuth><AppLayout /></RequireAuth>} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
