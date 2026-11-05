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
    <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-lg font-bold text-[#172233]">Aparência</h2>
      <p className="mt-1 text-sm text-slate-500">
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
      <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-lg font-bold text-[#172233]">Aplicativo</h2>
        <button
          type="button"
          onClick={() => setShowPolicy(true)}
          className="mt-4 flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:bg-slate-50"
        >
          <i className="fi fi-rr-shield-check text-lg text-brand-500" aria-hidden="true" />
          <span className="flex-1">
            <span className="block font-semibold text-[#172233]">Política de Privacidade</span>
            <span className="mt-0.5 block text-xs text-slate-500">Leia como seus dados são utilizados</span>
          </span>
          <i className="fi fi-rr-angle-small-right text-slate-400" aria-hidden="true" />
        </button>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
          <span className="text-slate-500">Versão do aplicativo</span>
          <span className="font-semibold text-[#172233]">{APP_VERSION}</span>
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
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
            <i className="fi fi-rr-lock" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#172233]">Acesso restrito a coordenadores</h2>
          <p className="mt-2 text-sm text-slate-500">
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
      <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-lg font-bold text-[#172233]">Link público da escala</h2>
        <p className="mt-1 text-sm text-slate-500">
          Compartilhe a escala geral do departamento com os voluntários via WhatsApp.
        </p>

        {publicScaleLink ? (
          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{publicScaleLink}</span>
              <button
                type="button"
                onClick={handleCopyScaleLink}
                className="shrink-0 rounded-xl bg-[#172233] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#101827]"
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
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-whatsapp px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-whatsapp-dark"
            >
              Compartilhar no WhatsApp
            </a>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Este departamento ainda não possui um link público.
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-lg font-bold text-[#172233]">Gestão de Equipe</h2>
        <p className="mt-1 text-sm text-slate-500">
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
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
          />
          <button
            type="submit"
            disabled={addingMember || !email.trim()}
            className="shrink-0 rounded-xl bg-[#172233] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#101827] disabled:opacity-50"
          >
            {addingMember ? "Adicionando..." : "Adicionar"}
          </button>
        </form>

        {teamError && (
          <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {teamError}
          </p>
        )}
        {teamNotice && (
          <p role="status" className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {teamNotice}
          </p>
        )}

        <div className="mt-5 divide-y divide-slate-100">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[#172233]">
                  {member.profiles?.email || "Usuário"}
                </p>
                <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {member.role}
                </span>
              </div>
              {member.role !== "coordenador" && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.id)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Remover
                </button>
              )}
            </div>
          ))}
          {members.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">Nenhum membro encontrado.</p>
          )}
        </div>
      </section>
    </div>
  );
}
