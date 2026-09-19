import { useState, useEffect } from "react";
import { useEvent } from "../context/EventContext";
import { upsertEvento, listEventos } from "../services/eventService";
import CityCombobox from "../components/CityCombobox";

const EVENT_TYPES = [
  { value: "assembleia_circuito", label: "Assembleia com o Superintendente de Circuito" },
  { value: "assembleia_representante", label: "Assembleia com o Representante de Betel" },
  { value: "congresso_regional", label: "Congresso Regional" },
];

const ASSEMBLEIA_TYPES = ["assembleia_circuito", "assembleia_representante"];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR, CURRENT_YEAR + 1];

function applyCircuitoMask(value) {
  const raw = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length === 0) return "";
  const letters = raw.replace(/[0-9]/g, "");
  const digits = raw.replace(/[^0-9]/g, "");
  if (letters.length <= 2) {
    return letters + (digits ? "-" + digits : "");
  }
  const uf = letters.slice(0, 2);
  const rest = letters.slice(2);
  return uf + "-" + digits + (rest ? " " + rest : "");
}

async function fetchEstados() {
  try {
    const res = await fetch(
      "https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome"
    );
    if (!res.ok) throw new Error("Falha ao buscar estados");
    return await res.json();
  } catch {
    return [];
  }
}

async function fetchCidades(uf) {
  if (!uf) return [];
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`
    );
    if (!res.ok) throw new Error("Falha ao buscar cidades");
    return await res.json();
  } catch {
    return [];
  }
}

export default function EventSelector() {
  const { selectEvent } = useEvent();

  const [mode, setMode] = useState("select");
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [estados, setEstados] = useState([]);
  const [cidades, setCidades] = useState([]);
  const [loadingCidades, setLoadingCidades] = useState(false);

  const [form, setForm] = useState({
    tipo: "",
    estado: "",
    cidade: "",
    ano: CURRENT_YEAR,
  });
  const [identificacoes, setIdentificacoes] = useState([""]);
  const [cityValid, setCityValid] = useState(false);

  const isAssembleia = ASSEMBLEIA_TYPES.includes(form.tipo);
  const isCongreso = form.tipo === "congresso_regional";

  useEffect(() => {
    fetchEstados().then(setEstados);
  }, []);

  useEffect(() => {
    if (!form.estado) {
      setCidades([]);
      setForm((prev) => ({ ...prev, cidade: "" }));
      setCityValid(false);
      return;
    }
    setLoadingCidades(true);
    fetchCidades(form.estado).then((data) => {
      setCidades(data);
      setLoadingCidades(false);
      setForm((prev) => ({ ...prev, cidade: "" }));
      setCityValid(false);
    });
  }, [form.estado]);

  function handleSelectExisting(evento) {
    selectEvent(evento);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const circuitoValues = identificacoes.filter((id) => id.trim() !== "");

    if (!form.tipo || circuitoValues.length === 0 || !form.ano) {
      setError("Preencha todos os campos.");
      return;
    }

    if (isCongreso && (!form.estado || !form.cidade)) {
      setError("Preencha todos os campos.");
      return;
    }

    if (isCongreso && !cityValid) {
      setError("Selecione uma cidade válida da lista do IBGE.");
      return;
    }

    const circuitoDisplay = circuitoValues
      .map((c) => c.trim().toUpperCase())
      .join(" / ");

    setLoading(true);
    try {
      const evento = await upsertEvento({
        tipo: form.tipo,
        estado: isCongreso ? form.estado : "",
        cidade: isCongreso ? form.cidade : "",
        circuito: circuitoDisplay,
        identificacoes: circuitoValues,
        ano: Number(form.ano),
      });
      selectEvent(evento);
    } catch (err) {
      setError(err?.message || "Erro ao criar evento.");
    } finally {
      setLoading(false);
    }
  }

  function handleIdentificacaoChange(index, value) {
    const masked = isAssembleia ? applyCircuitoMask(value) : value.toUpperCase().slice(0, 10);
    setIdentificacoes((prev) => {
      const next = [...prev];
      next[index] = masked;
      return next;
    });
  }

  function addIdentificacao() {
    setIdentificacoes((prev) => [...prev, ""]);
  }

  function removeIdentificacao(index) {
    setIdentificacoes((prev) => prev.filter((_, i) => i !== index));
  }

  if (mode === "select") {
    return (
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#345C3F]/10">
              <i className="fi fi-rr-calendar text-xl text-[#345C3F]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#172233]">Selecionar Evento</h2>
              <p className="text-sm text-slate-500">Escolha um evento existente ou crie um novo.</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {eventos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <i className="fi fi-rr-folder-open text-2xl text-slate-300" />
                <p className="mt-2 text-sm text-slate-400">Nenhum evento encontrado.</p>
                <p className="text-xs text-slate-400">Crie o primeiro evento para começar.</p>
              </div>
            ) : (
              eventos.map((evento) => (
                <button
                  key={evento.id}
                  type="button"
                  onClick={() => handleSelectExisting(evento)}
                  className="group flex w-full items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 text-left transition hover:border-[#42d27b]/40 hover:shadow-md"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#345C3F]/10">
                    <i className="fi fi-rr-calendar text-lg text-[#345C3F]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#172233]">{evento.tipo}</p>
                    <p className="truncate text-xs text-slate-400">
                      {evento.cidade ? `${evento.cidade}/${evento.estado} — ` : ""}
                      {evento.circuito} — {evento.ano}
                    </p>
                  </div>
                  <i className="fi fi-rr-angle-right text-sm text-slate-300 transition group-hover:text-[#42d27b]" />
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setMode("create");
              setError("");
              setIdentificacoes([""]);
              setForm((prev) => ({ ...prev, tipo: "", estado: "", cidade: "" }));
              setCityValid(false);
              listEventos().then(setEventos).catch(() => {});
            }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-[#345C3F] transition hover:border-[#42d27b]/40 hover:bg-[#42d27b]/5"
          >
            <i className="fi fi-rr-plus text-base" />
            Criar novo evento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#345C3F]/10">
            <i className="fi fi-rr-add-document text-xl text-[#345C3F]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#172233]">Criar Evento</h2>
            <p className="text-sm text-slate-500">Defina os detalhes do evento sazonal.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => {
                const newTipo = e.target.value;
                setForm((prev) => ({ ...prev, tipo: newTipo, estado: "", cidade: "" }));
                setIdentificacoes([""]);
                setCityValid(false);
              }}
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
            >
              <option value="">Selecione o tipo</option>
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {isCongreso && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700">Estado (UF)</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value }))}
                  disabled={loading}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
                >
                  <option value="">Selecione o estado</option>
                  {estados.map((uf) => (
                    <option key={uf.id} value={uf.sigla}>
                      {uf.nome} ({uf.sigla})
                    </option>
                  ))}
                </select>
              </div>

              <CityCombobox
                cidades={cidades}
                value={form.cidade}
                onChange={(cidade) => setForm((prev) => ({ ...prev, cidade }))}
                onValidate={setCityValid}
                disabled={loading || !form.estado}
                loading={loadingCidades}
              />
            </>
          )}

          {form.tipo && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                {isAssembleia ? "Circuito(s)" : "Identificação do Congresso"}
              </label>
              <div className="mt-1 space-y-2">
                {identificacoes.map((val, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      value={val}
                      onChange={(e) => handleIdentificacaoChange(index, e.target.value)}
                      placeholder={
                        isAssembleia
                          ? index === 0
                            ? "Ex: PB-008 B"
                            : "Ex: SP-138 A"
                          : index === 0
                            ? "Ex: 027 (B)"
                            : "Ex: 001 (A)"
                      }
                      maxLength={10}
                      disabled={loading}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-base uppercase outline-none transition placeholder:normal-case focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
                    />
                    {identificacoes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIdentificacao(index)}
                        disabled={loading}
                        className="shrink-0 rounded-xl border border-slate-200 px-3 text-slate-400 transition hover:border-red-300 hover:bg-red-50 hover:text-red-500"
                        aria-label={`Remover identificação ${index + 1}`}
                      >
                        <i className="fi fi-rr-trash-small text-base" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addIdentificacao}
                disabled={loading}
                className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-[#345C3F] transition hover:bg-[#345C3F]/5"
              >
                <i className="fi fi-rr-plus text-[10px]" />
                {isAssembleia
                  ? "Adicionar outro circuito (Evento Conjunto)"
                  : "Adicionar outra identificação"}
              </button>
              <p className="mt-1 text-xs text-slate-400">
                {isAssembleia
                  ? "Se o evento for em conjunto com outro circuito, adicione todos para que as escalas sejam unificadas."
                  : "Adicione múltiplas identificações se o congresso reunir diferentes seções."}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">Ano</label>
            <select
              value={form.ano}
              onChange={(e) => setForm((prev) => ({ ...prev, ano: Number(e.target.value) }))}
              disabled={loading}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-[#42d27b] focus:ring-2 focus:ring-[#42d27b]/20"
            >
              {YEAR_OPTIONS.map((ano) => (
                <option key={ano} value={ano}>
                  {ano}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setMode("select");
                setError("");
              }}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-[#42d27b] px-4 py-3 text-sm font-semibold text-[#172233] transition hover:bg-[#36b868] disabled:opacity-50"
            >
              {loading ? "Criando..." : "Criar e Selecionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
