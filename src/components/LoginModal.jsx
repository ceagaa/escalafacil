import { useState } from "react";
import { Modal, Button } from "./UI";

export default function LoginModal({ onLogin, onClose }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onLogin(email.trim(), password);
      onClose();
    } catch (err) {
      setError(err?.message || "Falha ao fazer login. Verifique suas credenciais.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Entrar" onClose={onClose}>
      <p className="text-sm text-slate-500">
        Faça login para realizar esta ação.
      </p>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            autoFocus
            autoComplete="email"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-600">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Sua senha"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            autoComplete="current-password"
          />
        </label>
        {error && (
          <p className="text-sm font-medium text-rose-600">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
