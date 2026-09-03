import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../services/supabase";

const SLOTS = [
  { id: "sexta-manha", day: "Sexta-feira", period: "Manhã" },
  { id: "sexta-tarde", day: "Sexta-feira", period: "Tarde" },
  { id: "sabado-manha", day: "Sábado", period: "Manhã" },
  { id: "sabado-tarde", day: "Sábado", period: "Tarde" },
  { id: "domingo-manha", day: "Domingo", period: "Manhã" },
  { id: "domingo-tarde", day: "Domingo", period: "Tarde" },
];

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
  return `+${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function PublicCadastro() {
  const { slug } = useParams();
  const [department, setDepartment] = useState(null);
  const [loadingDept, setLoadingDept] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [congregation, setCongregation] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchDept() {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .eq("slug", slug)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setDepartment(data);
      }
      setLoadingDept(false);
    }
    fetchDept();
  }, [slug]);

  function toggleSlot(slotId) {
    setSelectedSlots((prev) =>
      prev.includes(slotId) ? prev.filter((s) => s !== slotId) : [...prev, slotId]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!department) return;

    const trimmedName = name.trim();
    const trimmedCongregation = congregation.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedCongregation || !trimmedPhone) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    setError("");

    const { error: insertError } = await supabase.from("volunteers").insert({
      department_id: department.id,
      name: trimmedName,
      congregation: trimmedCongregation,
      phone: trimmedPhone,
      availability: JSON.stringify(selectedSlots),
      active: false,
    });

    if (insertError) {
      setError("Erro ao realizar cadastro. Tente novamente.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSubmitted(true);
  }

  if (loadingDept) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f6]">
        <div className="text-sm text-slate-500">Carregando...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f6]">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-3xl">
            <i className="fi fi-rr-link-broken" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[#172233]">Departamento não encontrado</h1>
          <p className="mt-2 text-sm text-slate-500">
            Verifique o link e tente novamente.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f6f6] px-4">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm md:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#42d27b]/10 text-3xl text-[#2a9d5c]">
            <i className="fi fi-rr-check-circle" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-[#172233]">Cadastro recebido!</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            A coordenação do departamento{" "}
            <span className="font-semibold text-[#172233]">{department.name}</span>{" "}
            entrará em contato via WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6] px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#42d27b]/10 text-2xl text-[#2a9d5c]">
            <i className="fi fi-rr-hand-helping" />
          </div>
          <h1 className="mt-3 text-xl font-bold text-[#172233]">Seja um Voluntário</h1>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre-se para ajudar no departamento{" "}
            <span className="font-semibold">{department.name}</span>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-6 shadow-sm md:p-8"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Nome completo *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Congregação *
              </label>
              <input
                type="text"
                value={congregation}
                onChange={(e) => setCongregation(e.target.value)}
                placeholder="Nome da congregação"
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                WhatsApp *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="+55 99999-9999"
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Disponibilidade
              </label>
              <p className="mt-1 text-xs text-slate-400">
                Selecione os turnos em que você pode ajudar
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {SLOTS.map((slot) => {
                  const isSelected = selectedSlots.includes(slot.id);
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => toggleSlot(slot.id)}
                      className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                        isSelected
                          ? "border-[#42d27b] bg-[#42d27b]/10 font-medium text-[#1a7a42]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
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
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-xl bg-[#42d27b] px-4 py-3 text-sm font-semibold text-[#172233] transition hover:bg-[#36b868] disabled:opacity-50"
          >
            {submitting ? "Cadastrando..." : "Cadastrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
