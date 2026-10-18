import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";

const ROLE_LABEL = {
  coordenador: "Coordenador",
  assistente: "Assistente",
};

/**
 * Lista dos departamentos que o usuário assumiu no evento ativo.
 * Clique troca o departamento ativo e vai direto para o Resumo,
 * sem modal de confirmação (ele já é membro/coordenador).
 */
export default function MeusDepartamentos() {
  const navigate = useNavigate();
  const { departments, activeDepartment, selectDepartment } = useAuth();
  const { eventoId } = useEvent();

  const activeDeptId = activeDepartment?.department?.id || activeDepartment?.id || null;

  const myMemberships = (Array.isArray(departments) ? departments : []).filter((membership) => {
    const deptId = membership?.department?.id || membership?.department_id;
    return Boolean(deptId);
  });

  function handleSelect(membership) {
    selectDepartment(membership);
    navigate("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-navy-800">Meus departamentos</h2>
        <p className="mt-1 text-sm text-slate-500">
          Departamentos que você assumiu{eventoId ? " neste evento" : ""}. Clique para abrir o painel.
        </p>
      </div>

      {myMemberships.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
            <i className="fi fi-rr-building text-slate-400" />
          </div>
          <p className="mt-4 font-semibold text-navy-800">Nenhum departamento assumido ainda</p>
          <p className="mt-1 text-sm text-slate-400">
            Assuma a coordenação de um departamento disponível para ele aparecer aqui.
          </p>
          <button
            type="button"
            onClick={() => navigate("/departamentos")}
            className="mt-5 rounded-xl bg-brand-400 px-5 py-2.5 text-sm font-semibold text-navy-800 transition hover:bg-brand-400/80"
          >
            Ver departamentos disponíveis
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {myMemberships.map((membership) => {
            const deptId = membership?.department?.id || membership?.department_id;
            const name = membership?.department?.name || "Departamento";
            const roleLabel = ROLE_LABEL[membership?.role] || "Membro";
            const isActive = deptId === activeDeptId;
            return (
              <button
                key={membership?.id || deptId}
                type="button"
                onClick={() => handleSelect(membership)}
                aria-label={name}
                aria-current={isActive ? "page" : undefined}
                className={
                  "group rounded-2xl border-2 bg-white p-6 text-left shadow-card transition hover:border-brand-400/40 hover:shadow-md " +
                  (isActive ? "border-brand-400/60" : "border-transparent")
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-400/10 text-brand-400">
                    <i className="fi fi-rr-building text-xl" />
                  </div>
                  <span className="rounded-full bg-brand-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-brand-400">
                    {isActive ? "Ativo agora" : roleLabel}
                  </span>
                </div>
                <p className="mt-4 font-semibold text-navy-800">{name}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {membership?.role === "coordenador"
                    ? "Você coordena este departamento."
                    : "Função: " + roleLabel + "."}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {myMemberships.length > 0 && (
        <button
          type="button"
          onClick={() => navigate("/departamentos")}
          className="flex items-center gap-2 text-sm font-semibold text-brand-400 transition hover:text-brand-400/80"
        >
          <i className="fi fi-rr-apps" />
          Ver todos os departamentos
        </button>
      )}
    </div>
  );
}
