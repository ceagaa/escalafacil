import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import {
  findProfileByEmail,
  addDepartmentMember,
  listDepartmentMembers,
  removeDepartmentMember,
} from "../services/departmentService";
import type { DepartmentMemberRow } from "../types";
import LGPDModal from "../components/LGPDModal";
import type { ThemePreference } from "../context/theme";
import { useTheme } from "../hooks/useTheme";

const APP_VERSION = "1.2.1";

const THEME_OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
  { value: "system", label: "Automático", description: "Segue o tema do seu dispositivo" },
  { value: "light", label: "Claro", description: "Fundo claro e alto contraste" },
  { value: "dark", label: "Escuro", description: "Confortável em ambientes com pouca luz" },
];

function AppearanceSettings() {
  const { preference, setPreference } = useTheme();
  return (
    <section className="ef-card p-6 md:p-7">
      <h2 className="ef-h2">Aparência</h2>
      <p className="mt-1 text-sm text-[var(--ef-muted)]">
        Escolha como o EscalaFácil aparece neste dispositivo.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3" role="group" aria-label="Tema do aplicativo">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreference(option.value)}
            aria-pressed={preference === option.value}
            className={`appearance-option ${preference === option.value ? "is-selected" : ""}`}
          >
            <span className="font-semibold">{option.label}</span>
            <span className="text-xs font-normal">{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AppInformationSettings() {
  const [showPolicy, setShowPolicy] = useState(false);

  return (
    <>
      <section className="ef-card p-6 md:p-7">
        <h2 className="ef-h2">Aplicativo</h2>
        <button
          type="button"
          onClick={() => setShowPolicy(true)}
          className="mt-4 flex min-h-14 w-full items-center gap-3 rounded-tile bg-[var(--ef-tile)] px-4 py-3 text-left transition hover:bg-[var(--ef-hover)]"
        >
          <i className="fi fi-rr-shield-check text-lg text-[var(--ef-accent-strong)]" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-semibold text-[var(--ef-text)]">Política de Privacidade</span>
            <span className="mt-0.5 block text-xs text-[var(--ef-muted)]">Leia como seus dados são utilizados</span>
          </span>
          <i className="fi fi-rr-angle-small-right text-[var(--ef-faint)]" aria-hidden="true" />
        </button>
        <div className="mt-4 flex items-center justify-between border-t border-[var(--ef-border)] pt-4 text-sm">
          <span className="text-[var(--ef-muted)]">Versão do aplicativo</span>
          <span className="font-semibold text-[var(--ef-text)]">{APP_VERSION}</span>
        </div>
      </section>
      {showPolicy && <LGPDModal onClose={() => setShowPolicy(false)} />}
    </>
  );
}

function readErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

export default function Configuracoes() {
  const { activeDepartment, user } = useAuth();
  const departmentId = activeDepartment?.department?.id || activeDepartment?.id || null;
  const role = activeDepartment?.role;
  const isCoordinator = role === "coordenador";

  const [members, setMembers] = useState<DepartmentMemberRow[]>([]);
  const [email, setEmail] = useState("");
  const [teamError, setTeamError] = useState("");
  const [teamNotice, setTeamNotice] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const departmentSlug = activeDepartment?.department?.slug || "";
  const publicScaleLink = departmentSlug
    ? window.location.origin + "/" + departmentSlug + "/escala"
    : "";

  useEffect(() => {
    if (!departmentId || !isCoordinator) return;
    listDepartmentMembers(departmentId)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [departmentId, isCoordinator]);

  async function handleCopyScaleLink() {
    if (!publicScaleLink) return;
    try {
      await navigator.clipboard.writeText(publicScaleLink);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2200);
    } catch (error) {
      console.warn("Falha ao copiar link da escala.", error);
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !departmentId) return;
    setAddingMember(true);
    setTeamError("");
    setTeamNotice("");
    try {
      const profile = await findProfileByEmail(trimmed);
      if (!profile) {
        setTeamError("Nenhum usuário encontrado com este e-mail.");
        return;
      }
      if (profile.id === user?.id) {
        setTeamError("Você já é membro deste departamento.");
        return;
      }
      await addDepartmentMember(departmentId, profile.id, "assistente");
      setEmail("");
      setTeamNotice("Assistente adicionado com sucesso!");
      const refreshed = await listDepartmentMembers(departmentId);
      setMembers(refreshed);
    } catch (err) {
      setTeamError(readErrorMessage(err, "Erro ao adicionar membro."));
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(membershipId: string) {
    setTeamError("");
    setTeamNotice("");
    try {
      await removeDepartmentMember(membershipId);
      setMembers((current) => current.filter((member) => member.id !== membershipId));
      setTeamNotice("Membro removido.");
    } catch (err) {
      setTeamError(readErrorMessage(err, "Erro ao remover membro."));
    }
  }

  if (!isCoordinator) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <AppearanceSettings />
        <AppInformationSettings />
        <div className="ef-card p-6 text-center md:p-7">
          <div className="ef-empty-icon mx-auto !bg-[var(--ef-hover)] text-2xl">
            <i className="fi fi-rr-lock" />
          </div>
          <h2 className="ef-h2 mt-4">Acesso restrito a coordenadores</h2>
          <p className="mt-2 text-sm text-[var(--ef-muted)]">
            Somente o coordenador do departamento pode gerenciar a equipe e as configurações.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AppearanceSettings />
      <AppInformationSettings />
      <section className="ef-card p-6 md:p-7">
        <h2 className="ef-h2">Link público da escala</h2>
        <p className="mt-1 text-sm text-[var(--ef-muted)]">
          Compartilhe a escala geral do departamento com os voluntários via WhatsApp.
        </p>

        {publicScaleLink ? (
          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-tile bg-[var(--ef-tile)] px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm text-[var(--ef-text-2)]">{publicScaleLink}</span>
              <button
                type="button"
                onClick={handleCopyScaleLink}
                className="ef-btn ef-btn-sm ef-btn-dark shrink-0"
              >
                {copiedLink ? "Copiado!" : "Copiar"}
              </button>
            </div>
            <a
              href={
                "https://api.whatsapp.com/send?text=" +
                encodeURIComponent(
                  "Confira a escala do departamento " +
                    (activeDepartment?.department?.name || "") +
                    ": " +
                    publicScaleLink
                )
              }
              target="_blank"
              rel="noopener noreferrer"
              className="ef-btn mt-3 bg-whatsapp !text-white hover:bg-whatsapp-dark"
            >
              Compartilhar no WhatsApp
            </a>
          </div>
        ) : (
          <p className="ef-alert ef-alert-warn mt-4">
            Este departamento ainda não possui um link público.
          </p>
        )}
      </section>

      <section className="ef-card p-6 md:p-7">
        <h2 className="ef-h2">Gestão de Equipe</h2>
        <p className="mt-1 text-sm text-[var(--ef-muted)]">
          Adicione assistentes pelo e-mail cadastrado no sistema.
        </p>

        <form onSubmit={handleAddMember} className="mt-5 flex gap-2">
          <label htmlFor="team-email" className="sr-only">Email do assistente</label>
          <input
            id="team-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@exemplo.com"
            className="ef-input min-w-0 flex-1"
          />
          <button
            type="submit"
            disabled={addingMember || !email.trim()}
            className="ef-btn ef-btn-primary shrink-0 disabled:opacity-50"
          >
            {addingMember ? "Adicionando..." : "Adicionar"}
          </button>
        </form>

        {teamError && (
          <p role="alert" className="ef-alert ef-alert-danger mt-3">
            {teamError}
          </p>
        )}
        {teamNotice && (
          <p role="status" className="ef-alert ef-alert-ok mt-3">
            {teamNotice}
          </p>
        )}

        <div className="mt-5 divide-y divide-[var(--ef-border)]">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-[var(--ef-text)]">
                  {member.profiles?.email || "Usuário"}
                </p>
                <span className="ef-badge ef-badge-neutral mt-1 !text-[11px]">
                  {member.role}
                </span>
              </div>
              {member.role !== "coordenador" && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.id)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--ef-danger)] transition hover:bg-[var(--ef-danger-soft)]"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--ef-muted)]">Nenhum membro encontrado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
