import { useState, useEffect, useRef, type FormEvent } from "react";
import { useEvent } from "../context/EventContext";
import { useAuth } from "../context/AuthContext";
import {
  upsertEvento,
  updateEvento,
  deleteEvento,
  getCoordinatedEventoIds,
  listEventos,
} from "../services/eventService";
import { createStandardDepartmentsForEvento } from "../services/departmentService";
import { getEventoTipoLabel, formatEventoNome, formatEventoDate } from "../utils/helpers";
import { UfCityFields, IdentificacoesFields, maskIdentificacao } from "../components/EventFormFields";
import ConfirmModal from "../components/ConfirmModal";
import type { Cidade, Estado, Evento, EventoTipo } from "../types";

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: "assembleia_circuito", label: "Assembleia com o Superintendente de Circuito" },
  { value: "assembleia_representante", label: "Assembleia com o Representante de Betel" },
  { value: "congresso_regional", label: "Congresso Regional" },
];

const ASSEMBLEIA_TYPES = ["assembleia_circuito", "assembleia_representante"];

const IDENTIFICACOES_HINT = {
  assembleia: "Se o evento for em conjunto com outro circuito, adicione todos para que as escalas sejam unificadas.",
  congresso: "Adicione múltiplas identificações se o congresso reunir diferentes seções.",
};

function isPastEvent(evento: Evento): boolean {
  if (!evento.data_evento) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(evento.data_evento + "T12:00:00") < today;
}

function readErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return fallback;
}

async function fetchEstados(): Promise<Estado[]> {
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

async function fetchCidades(uf: string): Promise<Cidade[]> {
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

function readErrorMessageFromLoad(err: unknown, fallback: string): string {
  return readErrorMessage(err, fallback);
}

interface EventFormState {
  tipo: string;
  estado: string;
  cidade: string;
  data_evento: string;
}

export default function EventSelector() {
  const { selectEvent } = useEvent();
  const { user, selectDepartment } = useAuth();

  const [activeTab, setActiveTab] = useState("upcoming");
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [coordinatedEventoIds, setCoordinatedEventoIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [eventLoadError, setEventLoadError] = useState("");
  const [estados, setEstados] = useState<Estado[]>([]);
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);

  const [contextMenu, setContextMenu] = useState<string | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal] = useState<Evento | null>(null);
  const [editForm, setEditForm] = useState<EventFormState>({ tipo: "", estado: "", cidade: "", data_evento: "" });
  const [editIdentificacoes, setIdentificacoes] = useState<string[]>([""]);
  const [editLoading, setEditLoading] = useState(false);

  const [deleteModal, setDeleteModal] = useState<Evento | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [form, setForm] = useState<EventFormState>({
    tipo: "",
    estado: "",
    cidade: "",
    data_evento: "",
  });
  const [identificacoes, setIdentificacoesState] = useState<string[]>([""]);
  const [cityValid, setCityValid] = useState(false);

  const isAssembleia = ASSEMBLEIA_TYPES.includes(form.tipo);
  const isCongreso = form.tipo === "congresso_regional";

  const upcomingEventos = eventos
    .filter((e) => !isPastEvent(e))
    .sort((a, b) => (a.data_evento || "").localeCompare(b.data_evento || ""));

  const pastEventos = eventos
    .filter((e) => isPastEvent(e))
    .sort((a, b) => (b.data_evento || "").localeCompare(a.data_evento || ""));

  const displayedEventos = activeTab === "upcoming" ? upcomingEventos : pastEventos;

  useEffect(() => {
    fetchEstados().then(setEstados);
    let cancelled = false;

    async function loadEventos() {
      try {
        const eventosData = await listEventos();
        if (!cancelled) setEventos(eventosData);
      } catch (loadError) {
        if (!cancelled) {
          setEventLoadError(readErrorMessageFromLoad(loadError, "Não foi possível carregar os eventos."));
        }
      }

      if (!user?.id) {
        if (!cancelled) setCoordinatedEventoIds(new Set());
        return;
      }

      try {
        const eventoIds = await getCoordinatedEventoIds(user.id);
        if (!cancelled) setCoordinatedEventoIds(new Set(eventoIds));
      } catch (loadError) {
        if (!cancelled) {
          setEventLoadError((current) => current || readErrorMessageFromLoad(loadError, "Não foi possível verificar suas permissões nos eventos."));
        }
      }
    }

    loadEventos();
    return () => { cancelled = true; };
  }, [user?.id]);

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

  useEffect(() => {
    if (!editForm.estado) {
      setCidades([]);
      return;
    }
    fetchCidades(editForm.estado).then(setCidades);
  }, [editForm.estado]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function resetCreateForm() {
    setForm({ tipo: "", estado: "", cidade: "", data_evento: "" });
    setIdentificacoesState([""]);
    setCityValid(false);
    setError("");
  }

  function openCreateModal() {
    resetCreateForm();
    setCreateModal(true);
  }

  function handleSelectExisting(evento: Evento) {
    selectDepartment(null);
    selectEvent(evento);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    const circuitoValues = identificacoes.filter((id) => id.trim() !== "");

    if (!form.tipo || circuitoValues.length === 0) {
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
        tipo: form.tipo as EventoTipo,
        estado: isCongreso ? form.estado : "",
        cidade: isCongreso ? form.cidade : "",
        circuito: circuitoDisplay,
        identificacoes: circuitoValues,
        data_evento: form.data_evento || null,
        userId: user?.id,
      });
      try {
        await createStandardDepartmentsForEvento(evento.id);
      } catch (deptErr) {
        console.error("Erro ao criar departamentos padrão:", deptErr);
      }
      setCreateModal(false);
      selectDepartment(null);
      selectEvent(evento);
    } catch (err) {
      setError(readErrorMessage(err, "Erro ao criar evento."));
    } finally {
      setLoading(false);
    }
  }

  function handleIdentificacaoChange(index: number, value: string) {
    const masked = maskIdentificacao(value, isAssembleia);
    setIdentificacoesState((prev) => {
      const next = [...prev];
      next[index] = masked;
      return next;
    });
  }

  function addIdentificacao() {
    setIdentificacoesState((prev) => [...prev, ""]);
  }

  function removeIdentificacao(index: number) {
    setIdentificacoesState((prev) => prev.filter((_, i) => i !== index));
  }

  function isCreator(evento: Evento): boolean {
    return Boolean(user?.id && evento.criado_por === user.id);
  }

  function isCoordinator(evento: Evento): boolean {
    return coordinatedEventoIds.has(evento.id);
  }

  function canDeleteEvento(evento: Evento): boolean {
    return isCreator(evento) || isCoordinator(evento);
  }

  function openEditModal(e: React.MouseEvent, evento: Evento) {
    e.stopPropagation();
    setContextMenu(null);
    const ids = (evento.circuito || "").split(" / ").map((s) => s.trim()).filter(Boolean);
    setEditForm({
      tipo: evento.tipo,
      estado: evento.estado || "",
      cidade: evento.cidade || "",
      data_evento: evento.data_evento || "",
    });
    setIdentificacoes(ids.length > 0 ? ids : [""]);
    setEditModal(evento);
  }

  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editModal) return;
    const circuitoValues = editIdentificacoes.filter((id) => id.trim() !== "");
    if (circuitoValues.length === 0) return;

    const circuitoDisplay = circuitoValues.map((c) => c.trim().toUpperCase()).join(" / ");

    setEditLoading(true);
    try {
      await updateEvento(editModal.id, {
        tipo: editForm.tipo as EventoTipo,
        estado: editForm.estado,
        cidade: editForm.cidade,
        circuito: circuitoDisplay,
        data_evento: editForm.data_evento || null,
      });
      setEventos((prev) =>
        prev.map((ev) =>
          ev.id === editModal.id
            ? { ...ev, tipo: editForm.tipo as EventoTipo, estado: editForm.estado, cidade: editForm.cidade, circuito: circuitoDisplay, data_evento: editForm.data_evento || null }
            : ev
        )
      );
      setEditModal(null);
    } catch {
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteModal) return;
    setDeleteError("");
    try {
      await deleteEvento(deleteModal.id);
      setEventos((prev) => prev.filter((ev) => ev.id !== deleteModal.id));
      setDeleteModal(null);
    } catch (err) {
      setDeleteModal(null);
      setDeleteError(readErrorMessage(err, "Não foi possível excluir o evento."));
    }
  }

  const createFormContent = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700">Tipo</label>
        <select
          value={form.tipo}
          onChange={(e) => {
            const newTipo = e.target.value;
            setForm((prev) => ({ ...prev, tipo: newTipo, estado: "", cidade: "" }));
            setIdentificacoesState([""]);
            setCityValid(false);
          }}
          disabled={loading}
          className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
        >
          <option value="">Selecione o tipo</option>
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {isAssembleia && (
        <div className="flex items-start gap-3 rounded-r border-l-4 border-amber-500 bg-amber-50 p-3">
          <i className="fi fi-rr-exclamation-triangle mt-0.5 text-lg text-amber-500" />
          <p className="text-sm leading-relaxed text-amber-800">
            Antes de prosseguir, verifique quais circuitos estarão juntos nesse evento.
          </p>
        </div>
      )}

      {isCongreso && (
        <UfCityFields
          uf={form.estado}
          cidade={form.cidade}
          estados={estados}
          cidades={cidades}
          loadingCidades={loadingCidades}
          disabled={loading}
          onChangeUf={(estado) => setForm((prev) => ({ ...prev, estado }))}
          onChangeCidade={(cidade) => setForm((prev) => ({ ...prev, cidade }))}
          onValidateCidade={setCityValid}
        />
      )}

      {form.tipo && (
        <IdentificacoesFields
          values={identificacoes}
          isAssembleia={isAssembleia}
          disabled={loading}
          onChange={handleIdentificacaoChange}
          onAdd={addIdentificacao}
          onRemove={removeIdentificacao}
          addLabel={isAssembleia ? "Adicionar outro circuito (Evento Conjunto)" : "Adicionar outra identificação"}
          addHint={isAssembleia ? IDENTIFICACOES_HINT.assembleia : IDENTIFICACOES_HINT.congresso}
        />
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700">Data do Evento</label>
        <input
          type="date"
          value={form.data_evento}
          onChange={(e) => setForm((prev) => ({ ...prev, data_evento: e.target.value }))}
          disabled={loading}
          className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
        />
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => setCreateModal(false)}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 rounded-xl bg-brand-400 px-4 py-3 text-sm font-semibold text-navy-800 transition hover:bg-brand-400/80 disabled:opacity-50"
        >
          {loading ? "Criando..." : "Criar e Selecionar"}
        </button>
      </div>
    </form>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-navy-800 md:text-3xl">Bem-vindo ao EscalaFácil</h1>
        <p className="mt-2 text-sm text-slate-500 md:text-base">
          Selecione um evento existente ou crie um novo para começar.
        </p>
      </div>

      {deleteError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {deleteError}
        </div>
      )}
      {eventLoadError && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {eventLoadError}
        </div>
      )}

      <div className="rounded-2xl bg-white p-6 shadow-card md:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-400/10">
              <i className="fi fi-rr-calendar text-xl text-brand-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-800">Meus Eventos</h2>
              <p className="text-sm text-slate-500">Escolha um evento para continuar.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="flex items-center gap-2 rounded-xl bg-brand-400 px-4 py-2.5 text-sm font-semibold text-navy-800 transition hover:bg-brand-400/80"
          >
            <i className="fi fi-rr-plus text-xs" />
            Criar evento
          </button>
        </div>

        <div className="mt-5 flex gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              activeTab === "upcoming"
                ? "bg-white text-navy-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Próximos
            {upcomingEventos.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-400/15 text-[10px] font-bold text-brand-400">
                {upcomingEventos.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
              activeTab === "history"
                ? "bg-white text-navy-800 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Histórico
            {pastEventos.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                {pastEventos.length}
              </span>
            )}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {displayedEventos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <i className={`fi ${activeTab === "upcoming" ? "fi-rr-folder-open" : "fi-rr-inbox"} text-2xl text-slate-300`} />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-600">
                {activeTab === "upcoming" ? "Nenhum evento criado." : "Nenhum evento no histórico."}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {activeTab === "upcoming"
                  ? "Crie um novo evento clicando no botão acima."
                  : "Eventos passados aparecerão aqui automaticamente."}
              </p>
              {activeTab === "upcoming" && (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-400 px-5 py-3 text-sm font-semibold text-navy-800 transition hover:bg-brand-400/80"
                >
                  <i className="fi fi-rr-plus text-xs" />
                  Criar um novo evento
                </button>
              )}
            </div>
          ) : (
            displayedEventos.map((evento) => (
              <div key={evento.id} className="group relative flex items-center gap-2 rounded-xl border border-slate-100 bg-white p-2 transition hover:border-brand-400/40 hover:shadow-card">
                <button
                  type="button"
                  onClick={() => handleSelectExisting(evento)}
                  className="flex min-w-0 flex-1 items-center gap-4 rounded-lg p-2 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-400/10">
                    <i className="fi fi-rr-calendar text-lg text-brand-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-navy-800">{formatEventoNome(evento)}</p>
                    {formatEventoDate(evento) && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        <i className="fi fi-rr-calendar mr-1 text-[10px]" />
                        {formatEventoDate(evento)}
                      </p>
                    )}
                  </div>
                  {!canDeleteEvento(evento) && (
                    <i className="fi fi-rr-angle-right text-sm text-slate-300 transition group-hover:text-brand-400" />
                  )}
                </button>
                {canDeleteEvento(evento) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError("");
                      setDeleteModal(evento);
                    }}
                    className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300"
                    aria-label={`Excluir evento ${formatEventoNome(evento)}`}
                    title="Excluir evento"
                  >
                    <i className="fi fi-rr-trash text-sm" />
                    <span>Excluir</span>
                  </button>
                )}
                {isCreator(evento) && (
                    <div className="relative" ref={contextMenuRef}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenu(contextMenu === evento.id ? null : evento.id);
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-slate-100 hover:text-slate-500"
                        aria-label="Opções do evento"
                      >
                        <i className="fi fi-rr-menu-dots-vertical text-base" />
                      </button>
                      {contextMenu === evento.id && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
                          <button
                            type="button"
                            onClick={(e) => openEditModal(e, evento)}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                          >
                            <i className="fi fi-rr-edit text-xs text-slate-400" />
                            Editar Evento
                          </button>
                        </div>
                      )}
                    </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {createModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-800">Criar Evento</h3>
              <button
                type="button"
                onClick={() => setCreateModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fechar"
              >
                <i className="fi fi-rr-cross text-sm" />
              </button>
            </div>
            <div className="mt-5">{createFormContent}</div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-800">Editar Evento</h3>
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fechar"
              >
                <i className="fi fi-rr-cross text-sm" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Tipo</label>
                <select
                  value={editForm.tipo}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, tipo: e.target.value }))}
                  disabled={editLoading}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {ASSEMBLEIA_TYPES.includes(editForm.tipo) && (
                <UfCityFields
                  uf={editForm.estado}
                  cidade={editForm.cidade}
                  estados={estados}
                  cidades={cidades}
                  loadingCidades={loadingCidades}
                  disabled={editLoading}
                  onChangeUf={(estado) => setEditForm((prev) => ({ ...prev, estado }))}
                  onChangeCidade={(cidade) => setEditForm((prev) => ({ ...prev, cidade }))}
                  onValidateCidade={() => {}}
                />
              )}

              {editForm.tipo && (
                <IdentificacoesFields
                  values={editIdentificacoes}
                  isAssembleia={ASSEMBLEIA_TYPES.includes(editForm.tipo)}
                  disabled={editLoading}
                  onChange={(index, value) => {
                    const masked = maskIdentificacao(value, ASSEMBLEIA_TYPES.includes(editForm.tipo));
                    setIdentificacoes((prev) => {
                      const next = [...prev];
                      next[index] = masked;
                      return next;
                    });
                  }}
                  onAdd={() => setIdentificacoes((prev) => [...prev, ""])}
                  onRemove={(index) => setIdentificacoes((prev) => prev.filter((_, i) => i !== index))}
                  addLabel="Adicionar"
                />
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700">Data do Evento</label>
                <input
                  type="date"
                  value={editForm.data_evento}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, data_evento: e.target.value }))}
                  disabled={editLoading}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModal(null)}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 rounded-xl bg-brand-400 px-4 py-3 text-sm font-semibold text-navy-800 transition hover:bg-brand-400/80 disabled:opacity-50"
                >
                  {editLoading ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal && (
        <ConfirmModal
          title="Excluir evento"
          message={`Tem certeza? Isso apagará permanentemente o evento "${getEventoTipoLabel(deleteModal.tipo)}" e todos os departamentos, voluntários e escalas vinculados a ele.`}
          confirmationText={ASSEMBLEIA_TYPES.includes(deleteModal.tipo) ? "Assembleia" : "Congresso"}
          confirmLabel="Excluir Evento"
          cancelLabel="Manter"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}
