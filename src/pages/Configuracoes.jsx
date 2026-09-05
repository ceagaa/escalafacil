import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  updateDepartmentFeatures,
  findProfileByEmail,
  addDepartmentMember,
  listDepartmentMembers,
  removeDepartmentMember,
} from "../services/departmentService";

export default function Configuracoes() {
  const { activeDepartment, refreshDepartments, user } = useAuth();
  const departmentId = activeDepartment?.department?.id || activeDepartment?.id || null;
  const role = activeDepartment?.role;
  const features = activeDepartment?.department?.features || {};
  const isCoordinator = role === "coordenador";

  const [members, setMembers] = useState([]);
  const [email, setEmail] = useState("");
  const [teamError, setTeamError] = useState("");
  const [teamNotice, setTeamNotice] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [savingFlag, setSavingFlag] = useState(false);
  const [flagError, setFlagError] = useState("");
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

  const lostItemsEnabled = features.lostItems !== false;

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

  async function handleToggleLostItems() {
    if (!departmentId) return;
    setSavingFlag(true);
    setFlagError("");
    try {
      await updateDepartmentFeatures(departmentId, { ...features, lostItems: !lostItemsEnabled });
      await refreshDepartments();
    } catch (err) {
      setFlagError(err.message || "Erro ao atualizar configurações.");
    } finally {
      setSavingFlag(false);
    }
  }

  async function handleAddMember(event) {
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
      setTeamError(err.message || "Erro ao adicionar membro.");
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(membershipId) {
    setTeamError("");
    setTeamNotice("");
    try {
      await removeDepartmentMember(membershipId);
      setMembers((current) => current.filter((member) => member.id !== membershipId));
      setTeamNotice("Membro removido.");
    } catch (err) {
      setTeamError(err.message || "Erro ao remover membro.");
    }
  }

  if (!isCoordinator) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
          <i className="fi fi-rr-lock" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-[#172233]">Acesso restrito a coordenadores</h2>
        <p className="mt-2 text-sm text-slate-500">
          Somente o coordenador do departamento pode gerenciar a equipe e as configurações.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#128C4A]"
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
        <h2 className="text-lg font-bold text-[#172233]">Módulos do departamento</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ative ou desative os módulos disponíveis para a sua equipe.
        </p>

        <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4">
          <div>
            <p className="font-semibold text-[#172233]">Módulo de Achados e Perdidos</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Exibe a aba de Itens Perdidos na navegação do painel.
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleLostItems}
            disabled={savingFlag}
            aria-label="Alternar módulo de achados e perdidos"
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${
              lostItemsEnabled ? "bg-[#42d27b]" : "bg-slate-300"
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${
                lostItemsEnabled ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {flagError && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {flagError}
          </p>
        )}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-lg font-bold text-[#172233]">Gestão de Equipe</h2>
        <p className="mt-1 text-sm text-slate-500">
          Adicione assistentes pelo e-mail cadastrado no sistema.
        </p>

        <form onSubmit={handleAddMember} className="mt-5 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="email@exemplo.com"
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
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
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {teamError}
          </p>
        )}
        {teamNotice && (
          <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
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
