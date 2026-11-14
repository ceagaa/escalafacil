import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../hooks/useTheme";
import { apiPut, type AuthUser } from "../services/api";
import { sanitizeError } from "../utils/errors";
import { Modal } from "./UI";

interface UserMenuProps {
  user: AuthUser;
  onLogout: () => void;
}

/** Iniciais do avatar: primeiro + último nome (ou as 2 primeiras do e-mail). */
export function getUserInitials(user: Pick<AuthUser, "name" | "email">): string {
  const name = (user.name || "").trim();
  if (!name) return (user.email || "?").slice(0, 2).toUpperCase();
  const parts = name.split(/\s+/);
  const initials =
    parts[0].charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : "");
  return initials.toUpperCase();
}

/** Modal "Meu perfil" — mostra e permite editar o nome (PUT /api/profiles/me). */
function ProfileModal({ user, onClose }: { user: AuthUser; onClose: () => void }) {
  const { profile, refreshSession } = useAuth();
  const [name, setName] = useState(profile?.name ?? user.name ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Informe o seu nome.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiPut("/api/profiles/me", { name: trimmed });
      await refreshSession();
      setNotice("Perfil atualizado.");
    } catch (err) {
      setError(sanitizeError(err, "update"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Meu perfil" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-400 text-lg font-bold text-white"
          >
            {getUserInitials(user)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#172233]">{name.trim() || user.email}</p>
            <p className="truncate text-sm text-slate-500">{user.email}</p>
          </div>
        </div>

        <div>
          <label htmlFor="profile-name" className="block text-sm font-medium text-slate-600">
            Nome
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
          />
        </div>

        <div>
          <label htmlFor="profile-email" className="block text-sm font-medium text-slate-600">
            E-mail
          </label>
          <input
            id="profile-email"
            type="email"
            value={user.email}
            readOnly
            disabled
            className="mt-1 w-full cursor-not-allowed rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-base text-slate-500"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {notice}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Fechar
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Avatar no header → menu com Perfil, Tema e Sair. */
export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { profile } = useAuth();
  const { preference, theme, setPreference } = useTheme();

  // Fecha ao clicar fora ou pressionar Escape.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const displayName = profile?.name || user.name || user.email;
  const themeLabel =
    preference === "system" ? "Automático" : preference === "dark" ? "Escuro" : "Claro";
  // Ciclo: automático → claro/escuro (conforme resolvido) → escuro → automático.
  const nextPreference =
    preference === "system"
      ? theme === "dark"
        ? "light"
        : "dark"
      : preference === "dark"
        ? "light"
        : "system";
  const nextThemeLabel =
    nextPreference === "system" ? "Automático" : nextPreference === "dark" ? "Escuro" : "Claro";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Abrir menu de ${displayName}`}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-400 text-sm font-bold text-white shadow-sm transition hover:bg-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        {getUserInitials(user)}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu do usuário"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl"
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-400 text-xs font-bold text-white"
            >
              {getUserInitials(user)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{displayName}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="my-1 border-t border-slate-200" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setShowProfile(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
              <circle cx="12" cy="8" r="4" />
              <path strokeLinecap="round" d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
            </svg>
            Perfil
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => setPreference(nextPreference)}
            title={`Tema ${themeLabel}. Alterar para ${nextThemeLabel}`}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {theme === "dark" ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
                <circle cx="12" cy="12" r="4" />
                <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.2 15.2A8.4 8.4 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z" />
              </svg>
            )}
            Tema
            <span className="ml-auto text-xs text-slate-400">{themeLabel}</span>
          </button>

          <div className="my-1 border-t border-slate-200" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <i className="fi fi-rr-sign-out-alt text-base" aria-hidden="true" />
            Sair
          </button>
        </div>
      )}

      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
    </div>
  );
}
