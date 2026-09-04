import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  createDepartment,
  linkUserAsCoordinator,
  STANDARD_DEPARTMENTS,
} from "../services/departmentService";

export default function GerenciarDepartamentos() {
  const { user, refreshSession, selectDepartment, departments } = useAuth();
  const [selectedSlug, setSelectedSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    const option = STANDARD_DEPARTMENTS.find((dept) => dept.slug === selectedSlug);
    if (!option || !user) return;

    setLoading(true);
    setError("");

    try {
      const department = await createDepartment(option.name, option.slug);
      await linkUserAsCoordinator(department.id, user.id);
      const depts = await refreshSession();
      const membership = (depts || []).find((member) => member?.department?.id === department.id);
      selectDepartment(
        membership || {
          id: department.id,
          department: { id: department.id, name: department.name, features: {} },
          role: "coordenador",
        }
      );
      setSelectedSlug("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-lg font-bold text-[#172233]">Reivindicar Departamento</h2>
        <p className="mt-1 text-sm text-slate-500">
          Escolha o departamento da sua equipe e se torne automaticamente o coordenador.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Departamento
            </label>
            <select
              value={selectedSlug}
              onChange={(e) => {
                setSelectedSlug(e.target.value);
                setError("");
              }}
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
            >
              <option value="">Selecione o departamento</option>
              {STANDARD_DEPARTMENTS.map((dept) => (
                <option key={dept.slug} value={dept.slug}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !selectedSlug}
            className="w-full rounded-xl bg-[#42d27b] px-4 py-3 text-sm font-semibold text-[#172233] transition hover:bg-[#36b868] disabled:opacity-50"
          >
            {loading ? "Criando..." : "Reivindicar Departamento"}
          </button>
        </form>

        {departments.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-medium text-slate-700">Seus departamentos</h3>
            <ul className="mt-3 space-y-2">
              {departments.map((dept) => (
                <li
                  key={dept.id}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-[#172233]">
                    {dept.department?.name || "Departamento"}
                  </span>
                  <span className="rounded-full bg-[#42d27b]/10 px-2.5 py-0.5 text-xs font-medium text-[#2a9d5c]">
                    {dept.role}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
