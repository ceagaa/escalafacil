import { useState, useEffect, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { apiGet, apiPost, ApiError } from "../services/api";
import { getAvailabilitySlots, isAssembleiaType } from "../utils/helpers";
import type { DepartmentRef, EventoTipo } from "../types";

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

function sanitizeInput(value: string): string {
  return String(value || "").trim().replace(/[<>]/g, "");
}

const SUBMISSION_KEY = "ap_public_submission_ts";
const RATE_LIMIT_MS = 30000;

function setMetaTag(property: string, content: string) {
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

interface DeptRef extends Pick<DepartmentRef, "id" | "name"> {}

export default function PublicCadastro() {
  const { slug } = useParams<{ slug: string }>();
  const [department, setDepartment] = useState<DeptRef | null>(null);
  const [eventoTipo, setEventoTipo] = useState<EventoTipo | null>(null);
  const [loadingDept, setLoadingDept] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [congregation, setCongregation] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const slots = getAvailabilitySlots(eventoTipo);
  const assembleia = isAssembleiaType(eventoTipo);

  useEffect(() => {
    let cancelled = false;

    async function fetchDept() {
      try {
        const data = await apiGet<DeptRef>(
          `/api/public/departments/${encodeURIComponent(slug || "")}`
        );

        if (cancelled) return;

        if (!data) {
          setNotFound(true);
          return;
        }

        setDepartment(data);
        document.title = `Seja Voluntário — ${data.name}`;
        setMetaTag("og:title", `Seja Voluntário — ${data.name}`);
        setMetaTag("og:description", `Cadastre-se como voluntário no departamento ${data.name}. Participação em escalas de eventos sazonais.`);
        setMetaTag("og:image", window.location.origin + "/favicon.png");
        setMetaTag("og:url", window.location.href);

        // Evento mais recente vinculado ao departamento (para as opções de
        // disponibilidade); erros aqui não bloqueiam o cadastro.
        try {
          const eventoId = await apiGet<string | null>(
            `/api/public/departments/${encodeURIComponent(data.id)}/links`
          );
          if (!cancelled && eventoId) {
            const evento = await apiGet<{ tipo?: EventoTipo } | null>(
              `/api/public/eventos?id=${encodeURIComponent(eventoId)}`
            );
            if (!cancelled && evento?.tipo) setEventoTipo(evento.tipo);
          }
        } catch {
          // Sem tipo de evento — slots caindo no padrão.
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        console.warn("Falha ao carregar o departamento do cadastro.", err);
        if (!cancelled) setError("Não foi possível carregar este departamento. Tente recarregar a página.");
      } finally {
        if (!cancelled) setLoadingDept(false);
      }
    }

    fetchDept();
    return () => { cancelled = true; };
  }, [slug]);

  function toggleSlot(slotId: string) {
    setSelectedSlots((prev) =>
      prev.includes(slotId) ? prev.filter((s) => s !== slotId) : [...prev, slotId]
    );
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!department) return;

    const trimmedName = sanitizeInput(name);
    const trimmedCongregation = sanitizeInput(congregation);
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedCongregation || !trimmedPhone) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    if (trimmedName.length > 120 || trimmedCongregation.length > 120) {
      setError("Campos excedem o tamanho máximo permitido.");
      return;
    }

    if (!isValidPhone(trimmedPhone)) {
      setError("Número de telefone inválido.");
      return;
    }

    const lastSubmission = parseInt(localStorage.getItem(SUBMISSION_KEY) || "0", 10);
    if (Date.now() - lastSubmission < RATE_LIMIT_MS) {
      setError("Aguarde alguns segundos antes de cadastrar novamente.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Cadastro anônimo — o Worker grava com active=0 (aprovação manual).
      await apiPost("/api/public/volunteers", {
        department_id: department.id,
        name: trimmedName,
        congregation: trimmedCongregation,
        phone: trimmedPhone,
        availability: selectedSlots,
      });
    } catch {
      setError("Erro ao realizar cadastro. Tente novamente.");
      setSubmitting(false);
      return;
    }

    // Só bloqueia o próximo envio depois de um cadastro realmente aceito.
    localStorage.setItem(SUBMISSION_KEY, String(Date.now()));
    setSubmitting(false);
    setSubmitted(true);
  }

  if (loadingDept) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ef-bg)]">
        <div className="text-sm text-[var(--ef-muted)]">Carregando...</div>
      </div>
    );
  }

  if (notFound || !department) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ef-bg)] px-4">
        <div className="ef-card w-full max-w-md p-8 text-center">
          <div className="ef-empty-icon mx-auto !bg-[var(--ef-hover)] text-3xl">
            <i className="fi fi-rr-link-slash" />
          </div>
          <h1 className="ef-h2 mt-4">Departamento não encontrado</h1>
          <p className="mt-2 text-sm text-[var(--ef-muted)]">
            {error || "Verifique o link e tente novamente."}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ef-bg)] px-4">
        <div className="ef-card w-full max-w-md p-8 text-center md:p-10">
          <div className="ef-empty-icon mx-auto !bg-[var(--ef-accent-soft)] !text-[var(--ef-accent-strong)] text-3xl">
            <i className="fi fi-rr-check-circle" />
          </div>
          <h1 className="ef-h2 mt-4">Cadastro recebido!</h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--ef-text-2)]">
            A coordenação do departamento{" "}
            <span className="font-semibold text-[var(--ef-text)]">{department.name}</span>{" "}
            entrará em contato via WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--ef-bg)] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <div className="ef-empty-icon mx-auto !bg-[var(--ef-accent-soft)] !text-[var(--ef-accent-strong)]">
            <i className="fi fi-rr-hand-holding-heart text-2xl" />
          </div>
          <h1 className="ef-h1 mt-4">Seja um Voluntário</h1>
          <p className="ef-lead mt-2">
            Cadastre-se para ajudar no departamento{" "}
            <span className="font-semibold text-[var(--ef-text-2)]">{department.name}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="ef-card p-5 md:p-7">
          <div className="space-y-4">
            <div>
              <label className="ef-label" htmlFor="pub-name">
                Nome completo *
              </label>
              <input
                id="pub-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="ef-input"
              />
            </div>

            <div>
              <label className="ef-label" htmlFor="pub-congregation">
                Congregação *
              </label>
              <input
                id="pub-congregation"
                type="text"
                value={congregation}
                onChange={(e) => setCongregation(e.target.value)}
                placeholder="Nome da congregação"
                className="ef-input"
              />
            </div>

            <div>
              <label className="ef-label" htmlFor="pub-phone">
                WhatsApp *
              </label>
              <input
                id="pub-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="+55 99999-9999"
                className="ef-input"
              />
            </div>

            <div>
              <span className="ef-label">Disponibilidade</span>
              <p className="text-xs text-[var(--ef-muted)]">
                Selecione {assembleia ? "Manhã e/ou Tarde" : "os turnos em que você pode ajudar"}
              </p>
              {assembleia ? (
                <div className="mt-3 flex gap-3">
                  {slots.map((slot) => {
                    const isSelected = selectedSlots.includes(slot.id);
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => toggleSlot(slot.id)}
                        aria-pressed={isSelected}
                        className={`flex-1 rounded-tile border px-4 py-4 text-center text-sm font-semibold transition ${
                          isSelected
                            ? "border-[var(--ef-accent)] bg-[var(--ef-accent-soft)] text-[var(--ef-accent-strong)]"
                            : "border-slate-200 bg-[var(--ef-tile)] text-[var(--ef-text-2)] hover:border-[var(--ef-faint)]"
                        }`}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {slots.map((slot) => {
                    const isSelected = selectedSlots.includes(slot.id);
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => toggleSlot(slot.id)}
                        aria-pressed={isSelected}
                        className={`rounded-tile border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-[var(--ef-accent)] bg-[var(--ef-accent-soft)] font-medium text-[var(--ef-accent-strong)]"
                            : "border-slate-200 bg-[var(--ef-tile)] text-[var(--ef-text-2)] hover:border-[var(--ef-faint)]"
                        }`}
                      >
                        <span className="block text-xs font-semibold uppercase tracking-wide opacity-60">
                          {slot.day}
                        </span>
                        <span className="mt-0.5 block">{slot.period}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div role="alert" className="ef-alert ef-alert-danger mt-4">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="ef-btn ef-btn-primary ef-btn-block ef-btn-lg mt-6"
          >
            {submitting ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
