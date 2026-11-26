import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import type { DepartmentMembership } from "../types";

const ROLE_LABEL: Record<string, string> = {
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

  function handleSelect(membership: DepartmentMembership) {
    selectDepartment(membership);
    navigate("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="ef-h1">Meus departamentos</h2>
        <p className="ef-lead mt-2">
          Departamentos que você assumiu{eventoId ? " neste evento" : ""}. Clique para abrir o painel.
        </p>
      </div>

      {myMemberships.length === 0 ? (
        <div className="ef-card p-8 text-center md:p-10">
          <div className="ef-empty-icon mx-auto !bg-[var(--ef-hover)] text-2xl">
            <i className="fi fi-rr-building" />
          </div>
          <p className="mt-4 font-semibold text-[var(--ef-text)]">Nenhum departamento assumido ainda</p>
          <p className="mt-1 text-sm text-[var(--ef-muted)]">
            Assuma a coordenação de um departamento disponível para ele aparecer aqui.
          </p>
          <button
            type="button"
            onClick={() => navigate("/departamentos")}
            className="ef-btn ef-btn-primary mt-5"
          >
            Ver departamentos disponíveis
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          {myMemberships.map((membership) => {
            const deptId = membership?.department?.id || membership?.department_id;
            const name = membership?.department?.name || "Departamento";
            const roleLabel = ROLE_LABEL[membership?.role || ""] || "Membro";
            const isActive = deptId === activeDeptId;
            return (
              <button
                key={membership?.id || deptId}
                type="button"
                onClick={() => handleSelect(membership)}
                aria-label={name}
                aria-current={isActive ? "page" : undefined}
                className={
                  "group ef-card ef-card-hover p-5 text-left transition " +
                  (isActive ? "!bg-[var(--ef-accent-soft)]" : "")
                }
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="ef-icon-tile">
                    <i className="fi fi-rr-building text-lg" />
                  </div>
                  <span className={`ef-badge ${isActive ? "ef-badge-accent" : "ef-badge-neutral"}`}>
                    {isActive ? "Ativo agora" : roleLabel}
                  </span>
                </div>
                <p className="mt-4 text-[15px] font-semibold text-[var(--ef-text)]">{name}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--ef-muted)]">
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
          className="flex items-center gap-2 text-sm font-semibold text-[var(--ef-accent-strong)] transition hover:underline"
        >
          <i className="fi fi-rr-apps" />
          Ver todos os departamentos
        </button>
      )}
    </div>
  );
}
