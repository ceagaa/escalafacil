import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { supabase } from "../services/supabase";
import {
  createDepartment,
  claimDepartmentForEvento,
  getEventoDepartmentOwner,
  revokeDepartmentCoordinator,
} from "../services/departmentService";
import { linkDepartmentToEvento } from "../services/eventService";
import { getEventoTipoLabel, formatEventoNome, formatEventoDate } from "../utils/helpers";
import ConfirmModal from "../components/ConfirmModal";
import { Skeleton, SkeletonStat } from "../components/Skeleton";
import {
  fetchEventDepartments,
  groupDepartments,
  ownerLabel,
} from "../services/dashboardDepartments";

async function fetchDeptStats(departmentId) {
  const [volunteers, shifts] = await Promise.all([
    supabase.from("volunteers").select("id", { count: "exact", head: true }).eq("department_id", departmentId).eq("active", true),
    supabase.from("shifts").select("id", { count: "exact", head: true }).eq("department_id", departmentId),
  ]);
  return {
    volunteers: volunteers.count ?? 0,
    shifts: shifts.count ?? 0,
  };
}


/** Monta a membership otimista que a Navbar lê (`activeDepartment.department.*`). */
function buildOptimisticMembership(dept, eventoId, userId) {
  const departmentId = dept.id || dept.department_id;
  return {
    id: departmentId,
    department_id: departmentId,
    evento_id: eventoId,
    user_id: userId,
    role: "coordenador",
    departments: dept,
    department: dept,
  };
}


/**
 * Garante que os departamentos coordenados pelo usuário estejam na lista,
 * marcando-os mesmo quando a consulta principal não os trouxe (ou não trouxe
 * o coordenador). Preserva os registros já existentes.
 */
export function mergeCoordinated(list, coordinatedIds, userId) {
  if (!coordinatedIds || coordinatedIds.length === 0) return list;
  const byId = new Map(list.map((dept) => [dept.id, dept]));
  for (const id of coordinatedIds) {
    const existing = byId.get(id);
    if (existing) {
      byId.set(id, { ...existing, coordenador_id: existing.coordenador_id || userId, ownerId: existing.ownerId || userId });
    } else {
      byId.set(id, { id, name: "Departamento", slug: "", coordenador_id: userId, ownerId: userId, ownerName: null });
    }
  }
  return [...byId.values()];
}

const CARD_BADGE_CLASS = {
  mine: "bg-brand-400/15 text-brand-400",
  taken: "bg-amber-50 text-amber-700",
  available: "bg-slate-100 text-slate-500",
};

const CARD_BADGE_LABEL = {
  mine: "Coordenando",
  taken: "Ocupado",
  available: "Disponível",
};

const CARD_ICON_CLASS = {
  mine: "bg-brand-400/10 text-brand-400",
  taken: "bg-amber-50 text-amber-600",
  available: "bg-brand-400/10 text-brand-400",
};

/**
 * Card de departamento na tela de escolha.
 *
 * - mine      -> entra no painel direto, sem confirmação.
 * - available -> abre a confirmação de assumir.
 * - taken     -> fica inerte e mostra QUEM coordena, para o usuário não
 *                descobrir a ocupação só depois de tentar assumir.
 */
function DepartmentCard({ name, variant, ownerName, disabled, onSelect }) {
  const interactive = variant !== "taken";
  const hasOwnerName = ownerName && ownerName !== "Coordenador";
  const hint = {
    mine: "Você já está coordenando este departamento.",
    taken: hasOwnerName ? "Coordenador: " + ownerName + "." : "Já possui um coordenador neste evento.",
    available: "Ao assumir, você será o coordenador deste departamento.",
  }[variant];
  const cardClass = interactive
    ? "border-transparent hover:border-brand-400/40 hover:shadow-md"
    : "cursor-not-allowed border-transparent opacity-80";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled || !interactive}
      aria-label={name}
      title={variant === "taken" ? "Já coordenado por " + ownerName : undefined}
      className={"group rounded-2xl border-2 bg-white p-6 text-left shadow-card transition disabled:opacity-60 " + cardClass}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={"flex h-12 w-12 items-center justify-center rounded-2xl " + CARD_ICON_CLASS[variant]}>
          <i className="fi fi-rr-building text-xl" />
        </div>
        <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-semibold " + CARD_BADGE_CLASS[variant]}>
          {CARD_BADGE_LABEL[variant]}
        </span>
      </div>
      <p className="mt-4 font-semibold text-navy-800">{name}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{hint}</p>
    </button>
  );
}

function DepartmentSection({ title, description, departments, variant, disabled, onSelect }) {
  if (departments.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {title} <span className="ml-1 font-semibold text-slate-400">({departments.length})</span>
        </h3>
        {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {departments.map((dept) => (
          <DepartmentCard
            key={dept.id}
            name={dept.name}
            variant={variant}
            ownerName={ownerLabel(dept)}
            disabled={disabled}
            onSelect={() => onSelect(dept)}
          />
        ))}
      </div>
    </section>
  );
}
export default function Dashboard({ forcePicker = false }) {
  const navigate = useNavigate();
  const { user, profile, departments, activeDepartment, selectDepartment, refreshSession, fetchCoordinatedDepartmentIds } = useAuth();
  const { activeEvent, eventoId } = useEvent();

  const [deptRecords, setDeptRecords] = useState([]);
  const [toast, setToast] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [deptStats, setDeptStats] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [revokeStep, setRevokeStep] = useState(0);
  const [revokeInput, setRevokeInput] = useState("");
  const [showNewDeptModal, setShowNewDeptModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [creatingDept, setCreatingDept] = useState(false);
  const [loading, setLoading] = useState(true);

  const departmentId = activeDepartment?.department?.id || activeDepartment?.id || null;
  const grouped = useMemo(() => groupDepartments(deptRecords, user?.id), [deptRecords, user?.id]);
  const departmentSlug = activeDepartment?.department?.slug || "";
  const departmentName = activeDepartment?.department?.name || "";
  const isCoordinator = activeDepartment?.role === "coordenador";

  const activeDepartmentRef = useRef(activeDepartment);
  const userRef = useRef(user);
  const selectDepartmentRef = useRef(selectDepartment);
  useEffect(() => {
    activeDepartmentRef.current = activeDepartment;
    userRef.current = user;
    selectDepartmentRef.current = selectDepartment;
  }, [activeDepartment, user, selectDepartment]);

  useEffect(() => {
    if (!eventoId) {
      setDeptRecords([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function loadDepartments() {
      let list = [];
      try {
        list = await fetchEventDepartments(eventoId);
      } catch (error) {
        console.warn("Falha ao carregar os departamentos do evento:", error);
      }

      if (cancelled) return;

      // Rede de segurança: lê direto de department_members quem o usuário
      // coordena neste evento. Se o join de departments falhar (RLS/cache de
      // schema), o departamento ainda é reconhecido — sem isso a tela e a
      // navbar ficavam vazias.
      const atualUser = userRef.current;
      if (atualUser?.id) {
        try {
          const coordenados = await fetchCoordinatedDepartmentIds(atualUser.id, eventoId);
          if (cancelled) return;
          list = mergeCoordinated(list, coordenados, atualUser.id);
        } catch (error) {
          console.warn("Falha ao verificar os departamentos coordenados:", error);
        }
      }

      if (cancelled) return;
      setDeptRecords(list);
      setLoading(false);

      // Auto-restore do departamento ativo, derivado do banco (department_members).
      // É o que garante que voltar ao MESMO evento caia direto no painel.
      // Na grade forçada (/departamentos) o auto-restore fica de fora para não
      // trocar o departamento ativo enquanto o usuário está só navegando.
      if (!atualUser?.id || forcePicker) return;
      const { mine } = groupDepartments(list, atualUser.id);
      const atual = activeDepartmentRef.current;
      const atualId = atual?.department?.id || atual?.department_id || atual?.id || null;
      if (mine.length === 1 && atualId !== mine[0].id) {
        selectDepartmentRef.current(buildOptimisticMembership(mine[0], eventoId, atualUser.id));
      }
    }
    loadDepartments().catch(() => {});
    return () => { cancelled = true; };
  }, [eventoId, forcePicker, fetchCoordinatedDepartmentIds]);

  const refreshDeptRecords = useCallback(async () => {
    if (!eventoId) return;
    try {
      let list = await fetchEventDepartments(eventoId);
      // O refresh em background precisa reaplicar o "meu departamento":
      // sem isto, um refresh posterior apagava o status "Coordenando" e o
      // card voltava a mostrar "Disponível" (bug de reabrir o mesmo evento).
      const atualUser = userRef.current;
      if (atualUser?.id) {
        try {
          const coordenados = await fetchCoordinatedDepartmentIds(atualUser.id, eventoId);
          list = mergeCoordinated(list, coordenados, atualUser.id);
        } catch (error) {
          console.warn("Falha ao verificar os departamentos coordenados:", error);
        }
      }
      setDeptRecords(list);
    } catch (error) {
      console.warn("Falha ao recarregar os departamentos do evento:", error);
    }
  }, [eventoId, fetchCoordinatedDepartmentIds]);

  useEffect(() => {
    if (!departmentId) { setDeptStats(null); return; }
    let cancelled = false;
    fetchDeptStats(departmentId).then((s) => { if (!cancelled) setDeptStats(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [departmentId]);

  // Sem evento ativo a tela de cards não existe: limpa o estado para não
  // reaproveitar registros do evento anterior ao trocar de evento.
  useEffect(() => {
    if (eventoId) return;
    setDeptRecords([]);
    setDeptStats(null);
    setLoading(false);
  }, [eventoId]);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }

  function handleCardClick(record) {
    if (!record) return;

    // Já é meu: entra direto no painel, sem perguntar.
    // (Não existe rota /dashboard/departamento/:id — o "painel" é o activeDepartment.)
    if (record.coordenador_id === user?.id) {
      const membership = departments.find(
        (m) => m?.department?.id === record.id && m?.user_id === user?.id
      );
      selectDepartment(membership || buildOptimisticMembership(record, eventoId, user.id));
      if (forcePicker) navigate("/");
      return;
    }

    // Ocupado por outra pessoa: o card já vem inerte, isto é só um guard.
    if (record.coordenador_id) {
      showToast("Este departamento já possui um coordenador." + (record.ownerName ? " " + record.ownerName : "") + ".");
      return;
    }

    // Disponível: abre a confirmação de assumir
    setConfirmModal({
      type: "claim",
      title: "Assumir Departamento",
      message: `Certeza que deseja coordenar o departamento ${record.name}?`,
      onConfirm: () => doClaim(record),
    });
  }

  async function doClaim(record) {
    setConfirmModal(null);
    setClaiming(true);
    try {
      // O departamento já vem identificado pelo id (mesmo quando o slug não
      // está disponível na listagem).
      const dept = record?.id
        ? { id: record.id, name: record.name, slug: record.slug || "" }
        : null;
      if (!dept) {
        showToast("Departamento não encontrado no banco de dados.");
        return;
      }

      const existingOwner = await getEventoDepartmentOwner(dept.id, eventoId || null);
      if (existingOwner) {
        if (existingOwner.userId === user.id) {
          const depts = await refreshSession();
          const membership = depts.find((m) => m?.department?.id === dept?.id && m?.user_id === user?.id);
          selectDepartment(membership || { id: dept.id, department: dept, role: "coordenador" });
        } else {
          showToast("Departamento já possui coordenador para este evento: " + existingOwner.name);
        }
        return;
      }

      // Garante o vínculo do departamento com o evento. Se o registro ainda
      // não existir (ou o retorno vier vazio), criamos e vinculamos.
      if (eventoId) {
        try {
          await linkDepartmentToEvento(eventoId, dept.id);
        } catch (linkErr) {
          console.warn("Departamento já vinculado ou falha ao vincular:", linkErr);
          showToast("Aviso: o departamento assumiu, mas o vínculo com o evento falhou.");
        }
      }

      // Registro do grid correspondente (pode ainda não existir se o dept acabou de ser criado)
      const target = deptRecords.find((d) => d.id === dept.id) || dept;

      // 1. Persiste a relação event-scoped (fonte de verdade do coordenador)
      if (eventoId) {
        await claimDepartmentForEvento(target.id, eventoId, user.id);
      } else {
        const { linkUserAsCoordinator } = await import("../services/departmentService");
        await linkUserAsCoordinator(target.id, user.id, null);
      }

      // 2. OPTIMISTIC UPDATE: Injeta na Navbar IMEDIATAMENTE
      const optimisticMembership = buildOptimisticMembership(target, eventoId, user.id);

      // Envia direto pro AuthContext
      selectDepartment(optimisticMembership);
      // Assumiu a partir da grade (/departamentos): vai direto para o Resumo.
      if (forcePicker) navigate("/");

      // 3. OPTIMISTIC UPDATE: Atualiza o Grid IMEDIATAMENTE
      setDeptRecords((prev) => prev.map((dept) =>
        (dept.id === target.id)
          ? { ...dept, coordenador_id: user.id, ownerId: user.id, ownerName: profile?.name || dept.ownerName || null }
          : dept
      ));

      // 4. Sincroniza em background silenciosamente
      refreshDeptRecords();
      refreshSession();
    } catch (err) {
      console.error("Erro no doClaim:", err);
      showToast(err?.message || "Erro ao reivindicar departamento.");
    } finally {
      setClaiming(false);
    }
  }

  function handleRevoke() {
    setRevokeStep(1);
    setRevokeInput("");
  }

  function confirmRevokeStep1() {
    setRevokeStep(2);
    setRevokeInput("");
  }

  async function doRevoke() {
    setRevokeStep(0);
    if (!departmentId) return;
    try {
      await revokeDepartmentCoordinator(departmentId, user.id);
      selectDepartment(null);
      await refreshSession();
      await refreshDeptRecords();
      showToast("Coordenação revogada. Voltando ao Dashboard...");
    } catch (err) {
      console.error("Erro ao revogar coordenação:", err);
      showToast(err?.message || "Erro ao revogar coordenação.");
    }
  }

  async function handleCreateDepartment() {
    const name = newDeptName.trim();
    if (!name) return;
    setCreatingDept(true);
    try {
      const department = await createDepartment(name, undefined, eventoId || null);
      if (eventoId) {
        try {
          await linkDepartmentToEvento(eventoId, department.id);
        } catch (linkErr) {
          console.error("Erro ao vincular departamento ao evento:", linkErr);
          showToast("Aviso: o departamento foi criado, mas o vínculo com o evento falhou.");
        }
        await claimDepartmentForEvento(department.id, eventoId, user.id);
      } else {
        const { linkUserAsCoordinator } = await import("../services/departmentService");
        await linkUserAsCoordinator(department.id, user.id, null);
      }
      const depts = await refreshSession();
      await refreshDeptRecords();
      const membership = depts.find(
        (m) => m?.department?.id === department.id && m?.user_id === user?.id
      );
      selectDepartment(
        membership || buildOptimisticMembership(department, eventoId, user.id)
      );
      setShowNewDeptModal(false);
      setNewDeptName("");
      showToast("Departamento criado.");
    } catch (err) {
      console.error("Erro ao criar departamento:", err);
      showToast(err?.message || "Erro ao criar departamento.");
    } finally {
      setCreatingDept(false);
    }
  }

  const shareBase = window.location.origin;
  const signupLink = departmentSlug ? `${shareBase}/${departmentSlug}/cadastro` : "";
  const scaleLink = departmentSlug ? `${shareBase}/${departmentSlug}/escala` : "";
  const eventLabel = activeEvent ? formatEventoNome(activeEvent) : "";
  const eventDate = activeEvent ? formatEventoDate(activeEvent) : "";
  // Sem nome de departamento a confirmação em duas etapas perde o sentido:
  // exigimos que o usuário digite um nome real antes de liberar a revogação.
  const canConfirmRevoke = departmentName.trim().length > 0 && revokeInput.trim() === departmentName;

  if (!departmentId || forcePicker) {
    return (
      <div className="space-y-6">
        {toast && (
          <div role="alert" className="app-toast fixed left-1/2 top-6 -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>
        )}

        <div>
          <h2 className="text-xl font-bold text-navy-800">{forcePicker ? "Departamentos" : "Bem-vindo!"}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {activeEvent
              ? `Escolha o departamento para o evento: ${getEventoTipoLabel(activeEvent.tipo)}.`
              : "Escolha o departamento da sua equipe para começar."}
          </p>
          {eventLabel && (
            <>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{eventLabel}</p>
              {eventDate && <p className="mt-0.5 text-xs text-slate-400">{eventDate}</p>}
            </>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-8">
            <DepartmentSection
              title="Meus departamentos"
              description="Departamentos que você coordena neste evento."
              departments={grouped.mine}
              variant="mine"
              disabled={claiming}
              onSelect={(dept) => handleCardClick(dept)}
            />

            <DepartmentSection
              title="Disponíveis"
              description="Ninguém assumiu ainda — clique para assumir a coordenação."
              departments={grouped.available}
              variant="available"
              disabled={claiming}
              onSelect={(dept) => handleCardClick(dept)}
            />

            <DepartmentSection
              title="Ocupados"
              description="Estes departamentos já têm coordenador neste evento."
              departments={grouped.takenByOthers}
              variant="taken"
              disabled={claiming}
              onSelect={() => {}}
            />

            <section className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Criar</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => { setShowNewDeptModal(true); setNewDeptName(""); }}
                  className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-left shadow-card transition hover:border-brand-400/40 hover:bg-brand-400/5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 transition group-hover:bg-brand-400/15">
                    <i className="fi fi-rr-plus text-xl text-slate-400 transition group-hover:text-brand-400" />
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-500 transition group-hover:text-navy-800">Novo Departamento</p>
                  <p className="text-xs text-slate-400">Criar departamento personalizado</p>
                </button>
              </div>
            </section>
          </div>
        )}
        {confirmModal && (
          <ConfirmModal
            title={confirmModal.title}
            message={confirmModal.message}
            confirmLabel={confirmModal.type === "select" ? "Sim" : "Assumir"}
            cancelLabel={confirmModal.type === "select" ? "Não" : "Cancelar"}
            danger={false}
            onConfirm={confirmModal.onConfirm}
            onCancel={() => setConfirmModal(null)}
          />
        )}

        {showNewDeptModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
            <div role="dialog" aria-modal="true" aria-labelledby="new-dept-title" className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
              <h3 id="new-dept-title" className="text-lg font-bold text-navy-800">Novo Departamento</h3>
              <label htmlFor="new-dept-name" className="mt-2 block text-sm leading-relaxed text-slate-500">
                Digite o nome do departamento que deseja criar:
              </label>
              <input
                id="new-dept-name"
                type="text"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="Ex: Limpeza, Estacionamento..."
                className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && newDeptName.trim()) handleCreateDepartment(); }}
              />
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setShowNewDeptModal(false)} disabled={creatingDept} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateDepartment}
                  disabled={!newDeptName.trim() || creatingDept}
                  className="flex-1 rounded-xl bg-brand-400 px-4 py-3 text-sm font-semibold text-navy-800 transition hover:bg-brand-400/80 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {creatingDept ? "Criando..." : "Criar e Assumir"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div role="alert" className="app-toast fixed left-1/2 top-6 -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">{toast}</div>
      )}

      <div>
        <h2 className="text-xl font-bold text-navy-800">Painel do Coordenador</h2>
        <p className="mt-1 text-sm text-slate-500">{departmentName}</p>
        {eventDate && <p className="mt-0.5 text-xs text-slate-400">{eventDate}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
        {loading ? (
          <>
            <SkeletonStat />
            <SkeletonStat />
          </>
        ) : (
          <>
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Voluntários</p>
                <i className="fi fi-rr-users text-lg text-brand-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-navy-800">{deptStats?.volunteers ?? "—"}</p>
              <p className="text-xs text-slate-400">ativos</p>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Turnos</p>
                <i className="fi fi-rr-calendar-lines text-lg text-brand-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-navy-800">{deptStats?.shifts ?? "—"}</p>
              <p className="text-xs text-slate-400">na escala</p>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-brand-400/5 to-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/15">
              <i className="fi fi-rr-user-add text-lg text-brand-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-navy-800">Cadastro de Voluntários</p>
              <p className="text-xs text-slate-400">Link público para novos voluntários</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input readOnly value={signupLink} aria-label="Link de cadastro de voluntários" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500 outline-none" />
            <a href={`https://wa.me/?text=${encodeURIComponent("Link de cadastro de voluntários — " + departmentName + ":\n" + signupLink)}`} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center gap-1.5 rounded-xl bg-whatsapp px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-whatsapp-dark">
              <i className="fi fi-brands-whatsapp text-sm" />
              WhatsApp
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-brand-400/5 to-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/15">
              <i className="fi fi-rr-calendar text-lg text-brand-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-navy-800">Escala Pública</p>
              <p className="text-xs text-slate-400">Acesso somente leitura da escala</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input readOnly value={scaleLink} aria-label="Link da escala pública" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500 outline-none" />
            <a href={`https://wa.me/?text=${encodeURIComponent("Confira a escala — " + departmentName + ":\n" + scaleLink)}`} target="_blank" rel="noopener noreferrer" className="shrink-0 flex items-center gap-1.5 rounded-xl bg-whatsapp px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-whatsapp-dark">
              <i className="fi fi-brands-whatsapp text-sm" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button type="button" onClick={() => navigate("/programacao")} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left transition hover:border-slate-200 hover:bg-white">
          <i className="fi fi-rr-calendar-lines text-2xl text-brand-400" />
          <span>
            <span className="block font-semibold text-navy-800">Gestão de Escalas</span>
            <span className="block text-xs text-slate-400">Criar e editar turnos da escala</span>
          </span>
        </button>

        <button type="button" onClick={() => navigate("/voluntarios")} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left transition hover:border-slate-200 hover:bg-white">
          <i className="fi fi-rr-users text-2xl text-brand-400" />
          <span>
            <span className="block font-semibold text-navy-800">Equipe e Aprovação</span>
            <span className="block text-xs text-slate-400">Aprovar cadastros de voluntários</span>
          </span>
        </button>

        {isCoordinator && (
          <button type="button" onClick={() => navigate("/configuracoes")} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left transition hover:border-slate-200 hover:bg-white">
            <i className="fi fi-rr-settings text-2xl text-brand-400" />
            <span>
              <span className="block font-semibold text-navy-800">Configurações</span>
              <span className="block text-xs text-slate-400">Módulos e gestão de equipe</span>
            </span>
          </button>
        )}
      </div>

      {isCoordinator && (
        <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/50 p-5">
          <div className="text-center">
            <h3 className="text-sm font-semibold text-red-600">Revogar coordenação deste departamento</h3>
            <p className="mt-1 text-xs text-red-500/70">
              Você não é o coordenador desse departamento ou não está mais responsável? Clique aqui e revogue o acesso.
            </p>
            <button type="button" onClick={handleRevoke} className="mt-3 text-sm font-semibold text-red-600 transition hover:text-red-700 hover:underline">
              Revogar Acesso
            </button>
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.type === "select" ? "Sim" : "Assumir"}
          cancelLabel={confirmModal.type === "select" ? "Não" : "Cancelar"}
          danger={false}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {revokeStep === 1 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="revoke-step1-title" className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 id="revoke-step1-title" className="text-lg font-bold text-navy-800">Revogar Coordenação</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Tem certeza que deseja desistir da coordenação do departamento <strong>{departmentName}</strong>? Você perderá acesso ao painel.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setRevokeStep(0)} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                Cancelar
              </button>
              <button type="button" onClick={confirmRevokeStep1} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700">
                Prosseguir
              </button>
            </div>
          </div>
        </div>
      )}

      {revokeStep === 2 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="revoke-step2-title" className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 id="revoke-step2-title" className="text-lg font-bold text-navy-800">Confirmação Final</h3>
            <label htmlFor="revoke-dept-name" className="mt-2 block text-sm leading-relaxed text-slate-500">
              Digite o nome do departamento <strong>{departmentName}</strong> para confirmar a revogação:
            </label>
            <input
              id="revoke-dept-name"
              type="text"
              value={revokeInput}
              onChange={(e) => setRevokeInput(e.target.value)}
              placeholder={departmentName}
              className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition placeholder:text-slate-300 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              autoFocus
            />
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setRevokeStep(0)} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                Cancelar
              </button>
              <button
                type="button"
                onClick={doRevoke}
                disabled={!canConfirmRevoke}
                className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Revogar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
