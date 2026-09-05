import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";
import {
  STANDARD_DEPARTMENTS,
  createDepartment,
  linkUserAsCoordinator,
  getDepartmentOwnerBySlugRpc,
} from "../services/departmentService";

async function fetchDeptStats(departmentId) {
  const [volunteers, shifts, pending] = await Promise.all([
    supabase.from("volunteers").select("id", { count: "exact", head: true }).eq("department_id", departmentId).eq("active", true),
    supabase.from("shifts").select("id", { count: "exact", head: true }).eq("department_id", departmentId),
    supabase.from("lost_items").select("id", { count: "exact", head: true }).eq("department_id", departmentId).neq("status", "Entregue"),
  ]);
  return {
    volunteers: volunteers.count ?? 0,
    shifts: shifts.count ?? 0,
    pending: pending.count ?? 0,
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, departments, activeDepartment, selectDepartment, refreshSession } = useAuth();

  const [deptRecords, setDeptRecords] = useState([]);
  const [toast, setToast] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [deptStats, setDeptStats] = useState(null);

  const departmentId = activeDepartment?.department?.id || activeDepartment?.id || null;
  const departmentSlug = activeDepartment?.department?.slug || "";
  const departmentName = activeDepartment?.department?.name || "";
  const isCoordinator = activeDepartment?.role === "coordenador";
  const lostItemsEnabled =
    !activeDepartment?.department?.features ||
    activeDepartment.department.features.lostItems !== false;

  useEffect(() => {
    let cancelled = false;
    async function loadDepartments() {
      const { data } = await supabase.from("departments").select("id, name, slug");
      const list = Array.isArray(data) ? data : [];
      const rows = await Promise.all(
        list.map(async (dept) => ({
          ...dept,
          ownerName: await getDepartmentOwnerBySlugRpc(dept.slug),
        }))
      );
      if (!cancelled) setDeptRecords(rows);
    }
    loadDepartments().catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!departmentId) { setDeptStats(null); return; }
    let cancelled = false;
    fetchDeptStats(departmentId).then((s) => { if (!cancelled) setDeptStats(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [departmentId]);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }

  function isMine(record) {
    return record
      ? departments.some((m) => m?.department?.id === record.id)
      : false;
  }

  async function handleCardClick(standardDept) {
    const record = deptRecords.find((d) => d.slug === standardDept.slug);

    if (record && isMine(record)) {
      const membership = departments.find((m) => m?.department?.id === record.id);
      selectDepartment(membership || { id: record.id, department: record, role: "coordenador" });
      return;
    }

    if (record && record.ownerName) {
      showToast("Departamento já criado. Responsável: " + record.ownerName);
      return;
    }

    setClaiming(true);
    try {
      const department = await createDepartment(standardDept.name, standardDept.slug);
      await linkUserAsCoordinator(department.id, user.id);
      const depts = await refreshSession();
      const membership = depts.find((m) => m?.department?.id === department.id);
      selectDepartment(
        membership || {
          id: department.id,
          department: { id: department.id, name: department.name, slug: standardDept.slug },
          role: "coordenador",
        }
      );
      setDeptRecords((prev) =>
        prev.some((d) => d.slug === standardDept.slug)
          ? prev.map((d) => d.slug === standardDept.slug ? { ...d, id: department.id } : d)
          : [...prev, { ...department, slug: standardDept.slug }]
      );
    } catch (err) {
      showToast(err?.message || "Erro ao reivindicar departamento.");
    } finally {
      setClaiming(false);
    }
  }

  const shareBase = window.location.origin;
  const signupLink = departmentSlug ? `${shareBase}/${departmentSlug}/cadastro` : "";
  const scaleLink = departmentSlug ? `${shareBase}/${departmentSlug}/escala` : "";

  const hasMultipleDepts = departments.length > 1;

  if (!departmentId) {
    return (
      <div className="space-y-6">
        {toast && (
          <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">
            {toast}
          </div>
        )}

        <div>
          <h2 className="text-xl font-bold text-[#172233]">Bem-vindo!</h2>
          <p className="mt-1 text-sm text-slate-500">
            Escolha o departamento da sua equipe para começar.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {STANDARD_DEPARTMENTS.map((dept) => {
            const record = deptRecords.find((item) => item.slug === dept.slug);
            const mine = record ? isMine(record) : false;
            const taken = record ? Boolean(record.ownerName) : false;

            return (
              <button
                key={dept.slug}
                type="button"
                onClick={() => handleCardClick(dept)}
                disabled={claiming}
                className={`group rounded-2xl border-2 border-transparent bg-white p-6 text-left shadow-sm transition hover:border-[#42d27b]/40 hover:shadow-md disabled:opacity-60`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#345C3F]/10">
                    <i className="fi fi-rr-building text-xl text-[#345C3F]" />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      mine
                        ? "bg-[#42d27b]/15 text-[#2a9d5c]"
                        : taken
                          ? "bg-red-50 text-red-600"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {mine ? "Seu departamento" : taken ? "Ocupado" : "Disponível"}
                  </span>
                </div>
                <p className="mt-4 font-semibold text-[#172233]">{dept.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {mine
                    ? "Clique para acessar o painel deste departamento."
                    : taken
                      ? `Responsável: ${record.ownerName}.`
                      : "Ao reivindicar, você será o coordenador deste departamento."}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-[#172233]">{departmentName}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {isCoordinator ? "Painel do coordenador" : "Painel do voluntário"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Voluntários</p>
            <i className="fi fi-rr-users text-lg text-[#42d27b]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#172233]">{deptStats?.volunteers ?? "—"}</p>
          <p className="text-xs text-slate-400">ativos</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Turnos</p>
            <i className="fi fi-rr-calendar-lines text-lg text-[#42d27b]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#172233]">{deptStats?.shifts ?? "—"}</p>
          <p className="text-xs text-slate-400">na escala</p>
        </div>
        {lostItemsEnabled && (
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Pendentes</p>
              <i className="fi fi-rr-ballot-check text-lg text-[#42d27b]" />
            </div>
            <p className="mt-2 text-2xl font-bold text-[#172233]">{deptStats?.pending ?? "—"}</p>
            <p className="text-xs text-slate-400">itens perdidos</p>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-[#42d27b]/5 to-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#42d27b]/15">
              <i className="fi fi-rr-user-add text-lg text-[#2a9d5c]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#172233]">Cadastro de Voluntários</p>
              <p className="text-xs text-slate-400">Link público para novos voluntários</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={signupLink}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500 outline-none"
            />
            <a
              href={`https://wa.me/?text=${encodeURIComponent("Link de cadastro de voluntários — " + departmentName + ":\n" + signupLink)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#25d366] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1da855]"
            >
              <i className="fi fi-brands-whatsapp text-sm" />
              WhatsApp
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-[#345C3F]/5 to-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#345C3F]/15">
              <i className="fi fi-rr-calendar text-lg text-[#345C3F]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#172233]">Escala Pública</p>
              <p className="text-xs text-slate-400">Acesso somente leitura da escala</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={scaleLink}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-500 outline-none"
            />
            <a
              href={`https://wa.me/?text=${encodeURIComponent("Confira a escala — " + departmentName + ":\n" + scaleLink)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-[#25d366] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#1da855]"
            >
              <i className="fi fi-brands-whatsapp text-sm" />
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate("/programacao")}
          className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left transition hover:border-slate-200 hover:bg-white"
        >
          <i className="fi fi-rr-calendar-lines text-2xl text-[#345C3F]" />
          <span>
            <span className="block font-semibold text-[#172233]">Gestão de Escalas</span>
            <span className="block text-xs text-slate-400">Criar e editar turnos da escala</span>
          </span>
        </button>

        {lostItemsEnabled && (
          <button
            type="button"
            onClick={() => navigate("/itens")}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left transition hover:border-slate-200 hover:bg-white"
          >
            <i className="fi fi-rr-ballot-check text-2xl text-[#345C3F]" />
            <span>
              <span className="block font-semibold text-[#172233]">Achados e Perdidos</span>
              <span className="block text-xs text-slate-400">Checklist de itens perdidos</span>
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => navigate("/voluntarios")}
          className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left transition hover:border-slate-200 hover:bg-white"
        >
          <i className="fi fi-rr-users text-2xl text-[#345C3F]" />
          <span>
            <span className="block font-semibold text-[#172233]">Equipe e Aprovação</span>
            <span className="block text-xs text-slate-400">Aprovar cadastros de voluntários</span>
          </span>
        </button>

        {isCoordinator && (
          <button
            type="button"
            onClick={() => navigate("/configuracoes")}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-left transition hover:border-slate-200 hover:bg-white"
          >
            <i className="fi fi-rr-settings text-2xl text-[#345C3F]" />
            <span>
              <span className="block font-semibold text-[#172233]">Configurações</span>
              <span className="block text-xs text-slate-400">Módulos e gestão de equipe</span>
            </span>
          </button>
        )}
      </div>

      {hasMultipleDepts && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center">
          <p className="text-sm text-slate-500">
            Você coordena {departments.length} departamentos.
          </p>
          <button
            type="button"
            onClick={() => selectDepartment(null)}
            className="mt-2 text-sm font-semibold text-[#2a9d5c] transition hover:text-[#1f7a44]"
          >
            Trocar de departamento
          </button>
        </div>
      )}
    </div>
  );
}
