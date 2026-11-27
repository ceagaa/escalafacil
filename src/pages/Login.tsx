import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleLoginButton from "../components/GoogleLoginButton";
import LGPDModal from "../components/LGPDModal";
import BrandLogo from "../components/BrandLogo";

type Mode = "login" | "signup";

function readErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

export default function Login() {
  const { user, loading, login, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [showLGPD, setShowLGPD] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#172233]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--ef-accent)] border-t-transparent" />
          <p className="text-sm text-[#c7cad1]">Carregando...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setShowPassword(false);
    setError("");
    setNotice("");
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
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
      setError(readErrorMessage(err, "Falha ao fazer login. Verifique suas credenciais."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignUpSubmit(event: FormEvent<HTMLFormElement>) {
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
      const data = await signUp(email.trim(), password, name.trim()) as { session?: unknown } | undefined;
      if (data?.session) {
        navigate("/", { replace: true });
        return;
      }
      switchMode("login");
      setNotice("Conta criada! Verifique seu e-mail para confirmar o cadastro e depois faça login.");
    } catch (err) {
      setError(readErrorMessage(err, "Falha ao criar conta. Tente novamente."));
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
      setError(readErrorMessage(err, "Não foi possível enviar o e-mail de recuperação."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="order-1 flex items-center justify-center bg-white px-5 py-8 sm:px-12 sm:py-12 lg:px-16">
        <div className="w-full max-w-md">
          <div className="mb-6 sm:mb-8">
            <BrandLogo className="mx-auto h-auto w-48 sm:w-56" />
          </div>

          <div className="ef-tabs mb-6">
            <button type="button" onClick={() => switchMode("login")} className={`ef-tab ${mode === "login" ? "is-active" : ""}`}>
              Login
            </button>
            <button type="button" onClick={() => switchMode("signup")} className={`ef-tab ${mode === "signup" ? "is-active" : ""}`}>
              Cadastro
            </button>
          </div>

          <GoogleLoginButton disabled={submitting} />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
            <div className="relative flex justify-center text-sm"><span className="bg-white px-3 text-[var(--ef-faint)]">ou</span></div>
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLoginSubmit}>
              <div className="space-y-4">
                <label className="block">
                  <span className="ef-label">E-mail</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" className="ef-input" autoComplete="email" />
                </label>
                <label className="block">
                  <span className="ef-label">Senha</span>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" className="ef-input pr-12" autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex items-center px-4 text-[var(--ef-faint)] transition hover:text-[var(--ef-text-2)]">
                      <i className={`fi ${showPassword ? "fi-rr-eye-crossed" : "fi-rr-eye"}`} aria-hidden="true" />
                    </button>
                  </div>
                </label>
              </div>

              {error && <p role="alert" className="ef-alert ef-alert-danger mt-4">{error}</p>}
              {notice && <p className="ef-alert ef-alert-ok mt-4">{notice}</p>}

              <button type="submit" disabled={submitting} className="ef-btn ef-btn-primary ef-btn-block ef-btn-lg mt-6">
                {submitting && <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#172233] border-t-transparent" />}
                {submitting ? "Entrando..." : "Entrar"}
              </button>

              <button type="button" onClick={handleForgotPassword} disabled={submitting} className="mt-4 w-full text-center text-sm font-medium text-[var(--ef-muted)] transition hover:text-[var(--ef-accent-strong)] disabled:opacity-50">
                Esqueci minha senha
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUpSubmit}>
              <div className="space-y-4">
                <label className="block">
                  <span className="ef-label">Nome completo</span>
                  <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" className="ef-input" autoComplete="name" />
                </label>
                <label className="block">
                  <span className="ef-label">E-mail</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" className="ef-input" autoComplete="email" />
                </label>
                <label className="block">
                  <span className="ef-label">Senha</span>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" className="ef-input pr-12" autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} className="absolute inset-y-0 right-0 flex items-center px-4 text-[var(--ef-faint)] transition hover:text-[var(--ef-text-2)]">
                      <i className={`fi ${showPassword ? "fi-rr-eye-crossed" : "fi-rr-eye"}`} aria-hidden="true" />
                    </button>
                  </div>
                </label>
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3">
                <input type="checkbox" checked={lgpdAccepted} onChange={(e) => setLgpdAccepted(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-[var(--ef-accent)] focus:ring-[var(--ef-accent)]" />
                <span className="text-sm text-[var(--ef-text-2)]">
                  Aceito as{" "}
                  <button type="button" onClick={(e) => { e.preventDefault(); setShowLGPD(true); }} className="font-semibold text-[var(--ef-accent-strong)] underline hover:underline">
                    Políticas de Privacidade e LGPD
                  </button>
                </span>
              </label>

              {error && <p role="alert" className="ef-alert ef-alert-danger mt-4">{error}</p>}
              {notice && <p className="ef-alert ef-alert-ok mt-4">{notice}</p>}

              <button type="submit" disabled={submitting} className="ef-btn ef-btn-primary ef-btn-block ef-btn-lg mt-6">
                {submitting && <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#172233] border-t-transparent" />}
                {submitting ? "Criando conta..." : "Criar conta"}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="hidden items-center bg-[#172233] px-6 py-14 sm:px-12 lg:order-2 lg:flex lg:px-20">
        <div className="max-w-lg">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--ef-accent)]">Organização simples</span>
          <h2 className="mt-4 text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-[40px]">
            Tudo o que sua equipe precisa para cuidar do dia.
          </h2>
          <p className="mt-5 text-base leading-7 text-slate-300">
            Centralize a programação de escalas, acompanhe voluntários e mantenha a boa organização em um só lugar,
            com informações claras para todo o departamento.
          </p>
          <div className="mt-8 space-y-3">
            {[
              "Feito para organizar o trabalho dos departamentos",
              "Escala compartilhada com um link só",
              "Voluntários confirmam presença pelo celular",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-semibold text-white">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--ef-accent-soft)] text-[var(--ef-accent)]">
                  <i className="fi fi-rr-check" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {showLGPD && <LGPDModal onClose={() => setShowLGPD(false)} />}
    </div>
  );
}
