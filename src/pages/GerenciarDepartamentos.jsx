import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { createDepartment, linkUserAsCoordinator } from "../services/departmentService";

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function GerenciarDepartamentos() {
  const { user, refreshSession, selectDepartment, departments } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const previewSlug = name ? slugify(name) : "";

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !user) return;

    setLoading(true);
    setError("");

    try {
      const department = await createDepartment(trimmed);
      await linkUserAsCoordinator(department.id, user.id);
      await refreshSession();
      selectDepartment({
        id: department.id,
        department: { id: department.id, name: department.name },
      });
      setName("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-lg font-bold text-[#172233]">Criar Departamento</h2>
        <p className="mt-1 text-sm text-slate-500">
          Crie um novo departamento e se torne automaticamente o coordenador.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Nome do Departamento
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="Ex: Achados e Perdidos"
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
              disabled={loading}
            />
            {previewSlug && (
              <p className="mt-1.5 text-xs text-slate-400">
                Slug: <span className="font-mono text-slate-500">{previewSlug}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full rounded-xl bg-[#42d27b] px-4 py-3 text-sm font-semibold text-[#172233] transition hover:bg-[#36b868] disabled:opacity-50"
          >
            {loading ? "Criando..." : "Criar e Vincular"}
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
