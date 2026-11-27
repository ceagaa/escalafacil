import { useState, useEffect, useMemo, lazy, Suspense, Component, type ReactNode, type FormEvent } from "react";
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
import UserMenu from "./components/UserMenu";
import RequireAuth from "./components/RequireAuth";
import type {
  AllocateModalState,
  EventoTipo,
  ScheduleBlock,
  Shift,
  ShiftAssignment,
  ShiftEditorPayload,
  ShiftEditorState,
  Volunteer,
  VolunteerForm,
} from "./types";

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
import BrandLogo from "./components/BrandLogo";

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--ef-bg)]">
          <div className="text-center">
            <p className="text-sm text-[var(--ef-muted)]">Erro ao carregar. Recarregue a página.</p>
            <button
              onClick={() => window.location.reload()}
              className="ef-btn ef-btn-primary mt-4"
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
function getDefaultDay(eventType?: EventoTipo | null): string {
  if (eventType === "congresso_regional") return CONGRESSO_DAYS[0];
  return "Dia do Evento";
}

/** Localiza um turno no estado local da escala. */
function findShift(schedule: ScheduleBlock[], blockId: string, shiftId: string): Shift | null {
  return schedule.find((block) => block.id === blockId)
    ?.shifts.find((shift) => shift.id === shiftId) || null;
}

/** Converte os nomes avulsos do turno em linhas de shift_volunteers. */
function buildManualAssignments(shift: Shift | null | undefined): ShiftAssignment[] {
  return (shift?.manualNames || []).map((name) => ({ volunteer_id: null, manual_name: name }));
}

function readErrMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}

const ROUTE_TITLES: Record<string, string> = {
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
  const [schedule, setSchedule] = useLocalStorage<ScheduleBlock[]>("ap_schedule_v4_validation", initialSchedule, sanitizeLoadedSchedule);
  const [volunteers, setVolunteers] = useLocalStorage<Volunteer[]>("ap_volunteers", initialVolunteers);
  const [shiftEditor, setShiftEditor] = useState<ShiftEditorState | null>(null);
  const [volunteerForm, setVolunteerForm] = useState<VolunteerForm>(emptyVolunteer());
  const [toast, setToast] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [hasLoadedRemoteData, setHasLoadedRemoteData] = useState(false);
  const [showDeptSwitcher, setShowDeptSwitcher] = useState(false);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [allocateModal, setAllocateModal] = useState<AllocateModalState | null>(null);

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
        const data = await fetchDepartmentData(departmentId, initialVolunteers, activeEvent?.tipo);
        setSchedule(data.schedule);
        setVolunteers(data.volunteers);
        setHasLoadedRemoteData(true);
        showToast("Dados sincronizados.");
      } catch (error) {
        console.warn("Falha ao buscar dados.", error);
        showToast("Falha ao sincronizar: " + (readErrMessage(error, "verifique a conexão com o servidor")));
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

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  /** Persiste as designações de um turno preservando os nomes avulsos. */
  function persistAssignments(shiftId: string, volunteerIds: string[], manualAssignments: ShiftAssignment[], actionLabel: string) {
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

  function handleEditShift(payload: ShiftEditorState) { setShiftEditor(payload); }
  function handleCreateShift(blockId?: string) { setShiftEditor({ blockId, shiftId: null }); }

  async function handleDeleteShift(blockId: string, shiftId: string) {
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
      console.warn("Falha ao excluir turno no servidor.", error);
      showToast("Não foi possível excluir o turno. Recarregue a página.");
      setHasLoadedRemoteData(false);
    }
  }

  function handleOpenAllocate(payload: AllocateModalState) {
    setAllocateModal(payload);
  }

  function handleAllocateVolunteer(volunteerId: string) {
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

  function handleDeallocateVolunteer(volunteerId: string) {
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

  async function saveShiftFromModal(data: ShiftEditorPayload) {
    if (!departmentId) return;
    const manualNames = data.manualName ? [data.manualName] : [];
    let localShiftId: string | null = null;

    if (data.shiftId) {
      setSchedule((current) =>
        current.map((block) => ({
          ...block,
          shifts: block.shifts.map((shift) =>
            shift.id === data.shiftId
              ? { ...shift, start: data.startTime, end: data.endTime, description: data.description, vagas: data.vagas, responsible: data.responsible, volunteerIds: data.selectedIds, manualNames }
              : shift
          ),
        }))
      );
    } else {
      localShiftId = makeId("local-shift");
      setSchedule((current) =>
        current.map((block) =>
          block.id === data.blockId
            ? { ...block, shifts: [...block.shifts, { id: localShiftId!, start: data.startTime, end: data.endTime, description: data.description, vagas: data.vagas, responsible: data.responsible, volunteerIds: data.selectedIds, manualNames }] }
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
      let targetShiftId: string | null = data.shiftId;
      if (targetShiftId) {
        await updateShift(departmentId, targetShiftId, { start_time: data.startTime, end_time: data.endTime, description: data.description, vagas: data.vagas, responsible: data.responsible });
      } else {
        const created = await createShift(departmentId, data.blockId, { start_time: data.startTime, end_time: data.endTime, description: data.description, vagas: data.vagas, responsible: data.responsible });
        targetShiftId = created.id;
        const createdShiftId = created.id;
        const replacedLocalId = localShiftId;
        setSchedule((current) =>
          current.map((block) =>
            block.id === data.blockId
              ? { ...block, shifts: block.shifts.map((shift) => shift.id === replacedLocalId ? { ...shift, id: createdShiftId } : shift) }
              : block
          )
        );
      }
      const assignments: ShiftAssignment[] = [
        ...data.selectedIds.map((id) => ({ volunteer_id: id, manual_name: null })),
        ...(data.manualName ? [{ volunteer_id: null, manual_name: data.manualName }] : []),
      ];
      await saveShiftAssignments(targetShiftId, assignments, departmentId);
      showToast(data.shiftId ? "Turno atualizado." : "Turno criado.");
    } catch (error) {
      console.warn("Falha ao salvar escala no servidor.", error);
      showToast("Não foi possível salvar no servidor. Recarregue a página.");
      setHasLoadedRemoteData(false);
    }
  }

  async function saveVolunteer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = volunteerForm.name.trim();
    if (!name || !departmentId) return;
    const payload: VolunteerForm = { ...volunteerForm, name, congregation: volunteerForm.congregation.trim(), phone: volunteerForm.phone.trim() };
    const payloadId = payload.id;

    if (!isOnline) {
      if (payloadId) {
        setVolunteers((current) => current.map((v) => (v.id === payloadId ? { ...v, ...payload, id: payloadId, active: v.active !== false } : v)));
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
      if (payloadId && !String(payloadId).startsWith("local-")) {
        const updated = await updateVolunteer(payloadId, departmentId, dbData);
        setVolunteers((current) => current.map((v) => (v.id === payloadId ? updated : v)));
        showToast("Voluntário atualizado.");
      } else {
        const created = await createVolunteer(departmentId, dbData);
        setVolunteers((current) => [created, ...current]);
        showToast("Voluntário cadastrado.");
      }
      setVolunteerForm(emptyVolunteer());
    } catch (error) {
      console.warn("Falha ao salvar voluntário no servidor.", error);
      showToast("Não foi possível salvar no servidor.");
    }
  }

  async function removeVolunteer(id: string) {
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
      console.warn("Falha ao excluir voluntário no servidor.", error);
      showToast("Não foi possível excluir no servidor. Recarregue a página.");
      setHasLoadedRemoteData(false);
    }
  }

  async function approveVolunteer(id: string) {
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

  async function rejectVolunteer(id: string) {
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

  function navTo(path: string) {
    navigate(path);
    setShowDeptSwitcher(false);
    setShowMobileMore(false);
  }

  const mobilePrimaryItems = visibleNavigationItems.slice(0, 3);
  const hasActiveMoreItem = visibleNavigationItems.slice(3).some((item) => item.path === activeView);

  if (eventLoading) {
    return (
      <div className="ap-app min-h-screen">
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-[var(--ef-muted)]">Carregando evento...</p>
        </div>
      </div>
    );
  }

  if (!eventoId) {
    return (
      <div className="ap-app min-h-screen">
        <header className="ap-header">
          <div className="w-full px-5 py-4 md:px-8 md:py-5">
            <div className="flex items-center justify-between">
              <BrandLogo className="h-9 w-[149px]" />
              <div className="flex items-center gap-2">
                {user && <UserMenu user={user} onLogout={handleLogout} />}
              </div>
            </div>
          </div>
        </header>
        <section className="ap-main-content space-y-6 p-4 pt-6 md:p-8">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><p className="text-sm text-[var(--ef-muted)]">Carregando...</p></div>}>
            <EventSelector />
          </Suspense>
        </section>
      </div>
    );
  }

  return (
    <div className="ap-app min-h-screen">
      <a href="#main" className="skip-link">Pular para o conteúdo</a>

      {toast && (
        <div role="alert" className="app-toast fixed left-1/2 -translate-x-1/2 rounded-full bg-navy-800 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      <aside className="fixed left-0 top-0 hidden h-full w-72 border-r border-[var(--ef-border)] bg-[var(--ef-sidebar)] p-5 lg:block" aria-label="Menu principal">
        <div>
          <BrandLogo className="ap-brand-logo mx-auto mb-6 h-14 w-[134px]" />

          {hasDepartment ? (
            <div className="relative mt-4">
              {hasMultipleDepts ? (
                <>
                  <button type="button" onClick={() => setShowDeptSwitcher(!showDeptSwitcher)} className="flex w-full items-center gap-2 text-left transition hover:opacity-80">
                    <h1 className="truncate text-[15px] font-semibold leading-tight text-[var(--ef-accent-strong)]">{departmentName}</h1>
                    <i className={`fi fi-rr-angle-small-down text-sm text-[var(--ef-accent-strong)] transition-transform ${showDeptSwitcher ? "rotate-180" : ""}`} />
                  </button>
                  {showDeptSwitcher && (
                    <div className="ef-menu absolute left-0 top-full z-50 mt-2 w-64 p-2">
                      {departments.map((dept) => {
                        const deptName = dept.department?.name || "Departamento";
                        const isActive = dept.department?.id === departmentId;
                        return (
                          <button key={dept.id} type="button" onClick={() => { selectDepartment(dept); setShowDeptSwitcher(false); }} className={`ef-menu-item ${isActive ? "bg-[var(--ef-accent-soft)] text-[var(--ef-accent-strong)]" : ""}`}>
                            <i className={`fi fi-rr-building text-base ${isActive ? "text-[var(--ef-accent-strong)]" : "text-[var(--ef-faint)]"}`} />
                            <span className="truncate">{deptName}</span>
                            {isActive && <i className="fi fi-rr-check ml-auto text-xs text-[var(--ef-accent-strong)]" />}
                          </button>
                        );
                      })}
                      <div className="my-1 border-t border-slate-200" />
                      <button type="button" onClick={() => { selectDepartment(null); setShowDeptSwitcher(false); }} className="ef-menu-item">
                        <i className="fi fi-rr-apps text-base text-[var(--ef-faint)]" />
                        Ver todos os departamentos
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <h1 className="text-[15px] font-semibold leading-tight text-[var(--ef-accent-strong)]">{departmentName}</h1>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <p className="text-xs text-[var(--ef-faint)]">Nenhum departamento selecionado</p>
              <p className="mt-1 text-xs text-[var(--ef-muted)]">Acesse o Dashboard para escolher um departamento.</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center gap-3 px-2">
          <span className="ef-eyebrow">Menu</span>
          <span className="h-px flex-1 border-t border-slate-200" />
        </div>

        <nav className="mt-4 space-y-1.5" aria-label="Navegação principal">
          {visibleNavigationItems.map((item) => (
            <button key={item.path} onClick={() => navTo(item.path)} aria-current={activeView === item.path ? "page" : undefined} className={`app-nav-button flex w-full items-center gap-3 transition ${activeView === item.path ? "is-active" : ""}`}>
              <i className={item.iconClass} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-5 left-5 right-5">
          <button
            type="button"
            onClick={() => { clearEvent(); selectDepartment(null); }}
            className="ef-menu-item"
          >
            <i className="fi fi-rr-arrow-left text-base text-[var(--ef-faint)]" />
            Trocar Evento
          </button>
        </div>
      </aside>

      <main id="main" tabIndex={-1} className="lg:pl-72">
        {hasDepartment && (
          <div className="mobile-department-brand px-4 pb-2 pt-5 lg:hidden">
            <h1 className="text-[15px] font-semibold leading-tight text-[var(--ef-accent-strong)]">{departmentName}</h1>
          </div>
        )}

        <header className="ap-header">
          <div className="w-full px-5 py-4 md:px-8 md:py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="ef-h1 truncate">
                  {activeView === "/"
                    ? (hasDepartment ? departmentName : "Dashboard")
                    : routeTitle}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {user && <UserMenu user={user} onLogout={handleLogout} />}
              </div>
            </div>
          </div>
        </header>

        <section className="ap-main-content space-y-5 p-4 pt-6 md:p-8">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><p className="text-sm text-[var(--ef-muted)]">Carregando...</p></div>}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/departamentos" element={<Dashboard forcePicker />} />
              <Route path="/meus-departamentos" element={<MeusDepartamentos />} />
              {hasDepartment && (
                <>
                  <Route path="/programacao" element={<Programacao activeDay={activeDay} setActiveDay={setActiveDay} dayCards={dayCards} volunteers={volunteers} now={now} onEditShift={handleEditShift} onCreateShift={handleCreateShift} onDeleteShift={handleDeleteShift} onAllocateVolunteers={handleOpenAllocate} departmentName={departmentName} eventType={activeEvent?.tipo} dataEvento={activeEvent?.data_evento} />} />
                  <Route path="/voluntarios" element={<Voluntarios volunteers={volunteers} volunteerForm={volunteerForm} setVolunteerForm={setVolunteerForm} onSave={saveVolunteer} onEdit={(v) => setVolunteerForm({ id: v.id, name: v.name, congregation: v.congregation || "", phone: v.phone || "" })} onDelete={removeVolunteer} onApprove={approveVolunteer} onReject={rejectVolunteer} departmentName={departmentName} />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                </>
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </section>
      </main>

      {showMobileMore && (
        <div id="mobile-more-menu" className="ap-mobile-more-menu lg:hidden">
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <p className="text-sm font-semibold">Mais opções</p>
            <button type="button" className="text-sm font-semibold text-[var(--ef-muted)]" onClick={() => setShowMobileMore(false)}>Fechar</button>
          </div>
          {visibleNavigationItems.slice(3).map((item) => (
            <button key={item.path} type="button" onClick={() => navTo(item.path)} aria-current={activeView === item.path ? "page" : undefined} className="ap-mobile-more-item">
              <i className={item.iconClass} />
              <span>{item.label}</span>
              {activeView === item.path && <i className="fi fi-rr-check ml-auto" aria-hidden="true" />}
            </button>
          ))}
          <button type="button" className="ap-mobile-more-item" onClick={() => { clearEvent(); selectDepartment(null); setShowMobileMore(false); }}>
            <i className="fi fi-rr-arrow-left" />
            <span>Trocar evento</span>
          </button>
          <button type="button" className="ap-mobile-more-item" onClick={handleLogout}>
            <i className="fi fi-rr-sign-out-alt" />
            <span>Sair</span>
          </button>
        </div>
      )}

      <div className="ap-mobile-nav lg:hidden">
        {mobilePrimaryItems.map((item) => (
          <button key={item.path} onClick={() => navTo(item.path)} aria-current={activeView === item.path ? "page" : undefined} className={`app-mobile-nav-button ${activeView === item.path ? "is-active" : ""}`}>
            <i className={item.iconClass} />
            <span>{item.label}</span>
          </button>
        ))}
        <button type="button" onClick={() => setShowMobileMore((current) => !current)} aria-expanded={showMobileMore} aria-controls={showMobileMore ? "mobile-more-menu" : undefined} className={`app-mobile-nav-button ${hasActiveMoreItem || showMobileMore ? "is-active" : ""}`}>
          <i className="fi fi-rr-apps" />
          <span>Mais</span>
        </button>
      </div>

      {shiftEditor && (
        <ShiftEditorModal shiftEditor={shiftEditor} volunteers={volunteers} schedule={schedule} departmentId={departmentId} coordinatorName={isCoordinator ? user?.name || null : null} onClose={() => setShiftEditor(null)} onSave={saveShiftFromModal} />
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
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-sm text-[var(--ef-muted)]">Carregando...</p></div>}>
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
