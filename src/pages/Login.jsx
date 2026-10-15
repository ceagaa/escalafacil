import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleLoginButton from "../components/GoogleLoginButton";
import LGPDModal from "../components/LGPDModal";
import logo from "../assets/img/logotipo.webp";

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
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [showLGPD, setShowLGPD] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#172233]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#42d27b] border-t-transparent" />
          <p className="text-sm text-slate-400">Carregando...</p>
        </div>
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
    if (!lgpdAccepted) {
      setError("Você precisa aceitar as Políticas de Privacidade e LGPD.");
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
      setNotice("Conta criada! Verifique seu e-mail para confirmar o cadastro e depois faça login.");
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
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="flex items-center justify-center bg-white px-6 py-12 sm:px-12 lg:px-16">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <img src={logo} alt="EscalaFácil" className="mx-auto h-[120px] w-[120px] object-contain" />
          </div>

          <div className="flex rounded-2xl bg-slate-100 p-1">
            <button type="button" onClick={() => switchMode("login")} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mode === "login" ? "bg-white text-[#172233] shadow-sm" : "text-slate-700 hover:text-slate-900"}`}>
              Login
            </button>
            <button type="button" onClick={() => switchMode("signup")} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${mode === "signup" ? "bg-white text-[#172233] shadow-sm" : "text-slate-700 hover:text-slate-900"}`}>
              Cadastro
            </button>
          </div>

          <GoogleLoginButton disabled={submitting} />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-sm"><span className="bg-white px-3 text-slate-400">ou</span></div>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit}>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-[#172233]">E-mail</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" className="mt-1 w-full border-0 border-b border-slate-300 bg-transparent px-0 py-3 text-base text-[#172233] outline-none transition placeholder:text-slate-400 focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/40" autoComplete="email" autoFocus />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#172233]">Senha</span>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" className="mt-1 w-full border-0 border-b border-slate-300 bg-transparent px-0 py-3 text-base text-[#172233] outline-none transition placeholder:text-slate-400 focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/40" autoComplete="current-password" />
                </label>
              </div>

              {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
              {notice && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</p>}

              <button type="submit" disabled={submitting} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#42d27b] px-4 py-3 text-sm font-semibold text-[#172233] transition hover:bg-[#36b868] disabled:opacity-50">
                {submitting && <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#172233] border-t-transparent" />}
                {submitting ? "Entrando..." : "Entrar"}
              </button>

              <button type="button" onClick={handleForgotPassword} disabled={submitting} className="mt-3 w-full text-center text-sm font-medium text-slate-500 transition hover:text-[#2a9d5c] disabled:opacity-50">
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUpSubmit}>
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-[#172233]">Nome completo</span>
                  <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" className="mt-1 w-full border-0 border-b border-slate-300 bg-transparent px-0 py-3 text-base text-[#172233] outline-none transition placeholder:text-slate-400 focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/40" autoComplete="name" autoFocus />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#172233]">E-mail</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" className="mt-1 w-full border-0 border-b border-slate-300 bg-transparent px-0 py-3 text-base text-[#172233] outline-none transition placeholder:text-slate-400 focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/40" autoComplete="email" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#172233]">Senha</span>
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" className="mt-1 w-full border-0 border-b border-slate-300 bg-transparent px-0 py-3 text-base text-[#172233] outline-none transition placeholder:text-slate-400 focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/40" autoComplete="new-password" />
                </label>
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={lgpdAccepted} onChange={(e) => setLgpdAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[#42d27b] focus:ring-[#42d27b]" />
                <span className="text-sm text-slate-600">
                  Aceito as{" "}
                  <button type="button" onClick={(e) => { e.preventDefault(); setShowLGPD(true); }} className="font-semibold text-[#2a9d5c] underline hover:text-[#1f7a44]">
                    Políticas de Privacidade e LGPD
                  </button>
                </span>
              </label>

              {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
              {notice && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{notice}</p>}

              <button type="submit" disabled={submitting} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#42d27b] px-4 py-3 text-sm font-semibold text-[#172233] transition hover:bg-[#36b868] disabled:opacity-50">
                {submitting && <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#172233] border-t-transparent" />}
                {submitting ? "Criando conta..." : "Criar conta"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="flex items-center bg-[#172233] px-6 py-12 sm:px-12 lg:px-20">
        <div className="max-w-lg">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#42d27b]">Organização simples</span>
          <h2 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl">
            Tudo o que sua equipe precisa para cuidar do dia.
          </h2>
          <p className="mt-5 text-base leading-7 text-slate-300">
            Centralize a programação de escalas, acompanhe voluntários e mantenha a boa organização em um só lugar,
            com informações claras para todo o departamento.
          </p>
          <div className="mt-8 flex items-center gap-3 text-sm font-semibold text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#42d27b]/15 text-[#42d27b]">
              <i className="fi fi-rr-check" />
            </span>
            Feito para organizar o trabalho dos departamentos
          </div>
        </div>
      </section>

      {showLGPD && <LGPDModal onClose={() => setShowLGPD(false)} />}
    </div>
  );
}
