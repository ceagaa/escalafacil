import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../services/supabase";
import {
  STANDARD_DEPARTMENTS,
  createDepartment,
  linkUserAsCoordinator,
  getDashboardStats,
  getDepartmentOwnerBySlugRpc,
} from "../services/departmentService";

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error("clipboard indisponível"));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, departments, selectDepartment, refreshSession } = useAuth();

  const [stats, setStats] = useState(null);
  const [deptRecords, setDeptRecords] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [toast, setToast] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [copiedField, setCopiedField] = useState("");

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

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
    return () => {
      cancelled = true;
    };
  }, []);

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3500);
  }

  function isMine(record) {
    return record
      ? departments.some((member) => member?.department?.id === record.id)
      : false;
  }

  async function handleCardClick(standardDept) {
    const record = deptRecords.find((dept) => dept.slug === standardDept.slug);

    if (record && isMine(record)) {
      const membership = departments.find((member) => member?.department?.id === record.id);
      selectDepartment(membership || { id: record.id, department: record, role: "coordenador" });
      setSelectedSlug(record.slug);
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
      const membership = depts.find((member) => member?.department?.id === department.id);
      selectDepartment(
        membership || {
          id: department.id,
          department: { id: department.id, name: department.name },
          role: "coordenador",
        }
      );
      setDeptRecords((prev) =>
        prev.some((dept) => dept.slug === standardDept.slug)
          ? prev.map((dept) =>
              dept.slug === standardDept.slug ? { ...dept, id: department.id } : dept
            )
          : [...prev, { ...department }]
      );
      setSelectedSlug(standardDept.slug);
    } catch (err) {
      showToast(err?.message || "Erro ao reivindicar departamento.");
    } finally {
      setClaiming(false);
    }
  }

  async function handleCopy(field, text) {
    try {
      await copyText(text);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField(""), 2000);
    } catch {
      showToast("Não foi possível copiar o link.");
    }
  }

  const selectedRecord = deptRecords.find((dept) => dept.slug === selectedSlug);
  const selectedName =
    selectedRecord?.name ||
    STANDARD_DEPARTMENTS.find((dept) => dept.slug === selectedSlug)?.name ||
    "";
  const shareBase = window.location.origin + window.location.pathname;
  const signupLink = selectedSlug ? `${shareBase}#/p/${selectedSlug}/cadastro` : "";
  const scaleLink = selectedSlug ? `${shareBase}#/p/${selectedSlug}/escala` : "";

  const statCards = [
    { icon: "fi fi-rr-building", label: "Total de Departamentos", value: stats?.total_departments ?? "—" },
    { icon: "fi fi-rr-users", label: "Total de Voluntários", value: stats?.total_volunteers ?? "—" },
    { icon: "fi fi-rr-crown", label: "Total de Coordenadores", value: stats?.total_coordinators ?? "—" },
    { icon: "fi fi-rr-trophy", label: "Maior Departamento", value: stats?.top_department || "—" },
  ];

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      <div>
        <h2 className="text-xl font-bold text-[#172233]">Dashboard</h2>
        <p className="mt-1 text-sm text-slate-500">
          Visão geral e acesso aos departamentos da sua região.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {card.label}
              </p>
              <i className={`${card.icon} text-lg text-[#42d27b]`} />
            </div>
            <p className="mt-2 truncate text-2xl font-bold text-[#172233]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {STANDARD_DEPARTMENTS.map((dept) => {
          const record = deptRecords.find((item) => item.slug === dept.slug);
          const mine = record ? isMine(record) : false;
          const taken = record ? Boolean(record.ownerName) : false;
          const active = selectedSlug === dept.slug;

          return (
            <button
              key={dept.slug}
              type="button"
              onClick={() => handleCardClick(dept)}
              disabled={claiming}
              className={`rounded-2xl border-2 p-6 text-left shadow-sm transition ${
                active
                  ? "border-[#42d27b] bg-[#42d27b]/10"
                  : "border-transparent bg-white hover:border-slate-200"
              } disabled:opacity-60`}
            >
              <div className="flex items-center justify-between gap-3">
                <i className="fi fi-rr-building text-2xl text-[#345C3F]" />
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    mine
                      ? "bg-[#42d27b]/15 text-[#2a9d5c]"
                      : taken
                        ? "bg-red-50 text-red-600"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {mine ? "Meu departamento" : taken ? "Ocupado" : "Disponível"}
                </span>
              </div>
              <p className="mt-3 font-semibold text-[#172233]">{dept.name}</p>
              <p className="mt-1 text-xs text-slate-400">
                {record?.ownerName
                  ? "Responsável: " + record.ownerName
                  : mine
                    ? "Clique para gerenciar"
                    : "Clique para reivindicar"}
              </p>
            </button>
          );
        })}
      </div>

      {selectedSlug && (
        <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <h3 className="text-lg font-bold text-[#172233]">Painel de Controle — {selectedName}</h3>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600">
                Link de Cadastro de Voluntários
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  readOnly
                  value={signupLink}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopy("signup", signupLink)}
                  className="shrink-0 rounded-xl bg-[#172233] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#101827]"
                >
                  {copiedField === "signup" ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600">
                Link Público da Escala
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  readOnly
                  value={scaleLink}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleCopy("scale", scaleLink)}
                  className="shrink-0 rounded-xl bg-[#172233] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#101827]"
                >
                  {copiedField === "scale" ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
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

            {selectedSlug === "achados-perdidos-guarda-volumes" && (
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
          </div>
        </div>
      )}
    </div>
  );
}
