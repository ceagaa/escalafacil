import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, loading, login, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#172233]">
        <p className="text-sm text-slate-400">Carregando...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err?.message || "Falha ao fazer login. Verifique suas credenciais.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUpSubmit(event) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError("Preencha nome, e-mail e senha.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const data = await signUp(email.trim(), password, name.trim());
      if (data?.session) {
        navigate("/", { replace: true });
        return;
      }
      switchMode("login");
      setNotice("Conta criada! Confirme seu e-mail e faça login.");
    } catch (err) {
      setError(err?.message || "Falha ao criar conta. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Informe seu e-mail acima para recuperar a senha.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(email.trim());
      setNotice("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (err) {
      setError(err?.message || "Não foi possível enviar o e-mail de recuperação.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#172233] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#42d27b]/15 text-3xl text-[#42d27b]">
            <i className="fi fi-rr-calendar-lines" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">Achados & Perdidos</h1>
          <p className="mt-1 text-sm text-slate-400">Gestão de Escalas e Guarda Volumes</p>
        </div>

        <div className="rounded-3xl bg-white p-8 shadow-2xl">
          <div className="flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                mode === "login" ? "bg-white text-[#172233] shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                mode === "signup" ? "bg-white text-[#172233] shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Cadastro
            </button>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit}>
              <h2 className="mt-6 text-lg font-bold text-[#172233]">Entrar</h2>
              <p className="mt-1 text-sm text-slate-500">Acesse o painel do seu departamento.</p>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">E-mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seu@email.com"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
                    autoComplete="email"
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">Senha</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Sua senha"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
                    autoComplete="current-password"
                  />
                </label>
              </div>

              {error && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}
              {notice && (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 w-full rounded-2xl bg-[#42d27b] px-4 py-3 text-sm font-semibold text-[#172233] transition hover:bg-[#36b868] disabled:opacity-50"
              >
                {submitting ? "Entrando..." : "Entrar"}
              </button>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={submitting}
                className="mt-3 w-full text-center text-sm font-medium text-slate-500 transition hover:text-[#2a9d5c] disabled:opacity-50"
              >
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUpSubmit}>
              <h2 className="mt-6 text-lg font-bold text-[#172233]">Criar conta</h2>
              <p className="mt-1 text-sm text-slate-500">
                Cadastre-se como coordenador e reivindique o departamento da sua equipe.
              </p>

              <div className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">Nome completo</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Seu nome"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
                    autoComplete="name"
                    autoFocus
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">E-mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="seu@email.com"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
                    autoComplete="email"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">Senha</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
                    autoComplete="new-password"
                  />
                </label>
              </div>

              {error && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </p>
              )}
              {notice && (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-6 w-full rounded-2xl bg-[#42d27b] px-4 py-3 text-sm font-semibold text-[#172233] transition hover:bg-[#36b868] disabled:opacity-50"
              >
                {submitting ? "Criando conta..." : "Criar conta"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
