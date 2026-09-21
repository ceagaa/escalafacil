import { useState, useMemo } from "react";
import { Card, Button, IconButton, Field } from "./UI";
import { WhatsAppIconLink, WhatsAppIcon } from "./WhatsApp";
import { createWaMeLink, parseAvailability, AVAILABILITY_SLOT_LABELS } from "../utils/helpers";
import EmptyState from "./EmptyState";

const PAGE_SIZE = 10;

export default function VolunteersView({
  volunteers,
  volunteerForm,
  setVolunteerForm,
  onSave,
  onEdit,
  onDelete,
  onCancel,
  onApprove,
  onReject,
  departmentName = "",
}) {
  const [tab, setTab] = useState("ativos");
  const [justApproved, setJustApproved] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const activeVolunteers = volunteers.filter((volunteer) => volunteer.active !== false);
  const pendingVolunteers = volunteers.filter((volunteer) => volunteer.active === false);

  const filteredActive = useMemo(() => {
    if (!search.trim()) return activeVolunteers;
    const q = search.toLowerCase();
    return activeVolunteers.filter(
      (v) => v.name.toLowerCase().includes(q) || (v.congregation || "").toLowerCase().includes(q)
    );
  }, [activeVolunteers, search]);

  const filteredPending = useMemo(() => {
    if (!search.trim()) return pendingVolunteers;
    const q = search.toLowerCase();
    return pendingVolunteers.filter(
      (v) => v.name.toLowerCase().includes(q) || (v.congregation || "").toLowerCase().includes(q)
    );
  }, [pendingVolunteers, search]);

  const currentList = tab === "ativos" ? filteredActive : filteredPending;
  const totalPages = Math.max(1, Math.ceil(currentList.length / PAGE_SIZE));
  const paginatedList = currentList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleTabChange(newTab) {
    setTab(newTab);
    setSearch("");
    setPage(1);
  }

  async function handleApprove(volunteer) {
    setJustApproved((current) => [...current, volunteer.id]);
    try {
      await onApprove(volunteer.id);
    } catch {
      setJustApproved((current) => current.filter((id) => id !== volunteer.id));
    }
  }

  async function handleReject(volunteerId) {
    try {
      await onReject(volunteerId);
    } catch {
      // error handled upstream
    }
  }

  function approveMessage(volunteer) {
    return `Olá ${volunteer.name}, seu cadastro no departamento ${departmentName} foi aprovado! Em breve você receberá suas designações.`;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleTabChange("ativos")}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            tab === "ativos" ? "bg-navy-800 text-white" : "bg-white text-slate-600 shadow-card hover:bg-slate-50"
          }`}
        >
          Ativos ({activeVolunteers.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("fila")}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            tab === "fila" ? "bg-navy-800 text-white" : "bg-white text-slate-600 shadow-card hover:bg-slate-50"
          }`}
        >
          Fila de Aprovação ({pendingVolunteers.length})
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[.9fr_1.4fr]">
        <Card className="ap-form-card h-fit p-8">
          <p className="text-sm text-slate-500">Cadastro</p>
          <h3 className="text-xl font-bold">{volunteerForm.id ? "Editar voluntário" : "Novo voluntário"}</h3>
          <form className="mt-5 space-y-3" onSubmit={onSave}>
            <Field
              label="Nome"
              placeholder="Nome completo"
              value={volunteerForm.name}
              onChange={(value) => setVolunteerForm({ ...volunteerForm, name: value })}
              required
            />
            <Field
              label="Congregação"
              placeholder="Ex: Bancários"
              value={volunteerForm.congregation}
              onChange={(value) => setVolunteerForm({ ...volunteerForm, congregation: value })}
            />
            <Field
              label="WhatsApp"
              placeholder="Ex: 83999999999"
              value={volunteerForm.phone}
              onChange={(value) => setVolunteerForm({ ...volunteerForm, phone: value })}
            />
            <div className="flex gap-2 pt-2">
              <Button type="submit">{volunteerForm.id ? "Salvar" : "Cadastrar"}</Button>
              {volunteerForm.id && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </Card>

        <Card className="ap-form-card p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">
                {tab === "ativos" ? "Lista" : "Fila de Aprovação"}
              </p>
              <h3 className="text-xl font-bold">
                {tab === "ativos" ? "Voluntários ativos" : "Cadastros aguardando aprovação"}
              </h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {currentList.length} cadastro{currentList.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-4">
            <label htmlFor="volunteer-search" className="sr-only">Buscar voluntário</label>
            <div className="relative">
              <i className="fi fi-rr-search absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-300" aria-hidden="true" />
              <input
                id="volunteer-search"
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar por nome ou congregação..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none transition placeholder:text-slate-300 focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
              />
            </div>
          </div>

          {tab === "ativos" ? (
            <div className="mt-5 divide-y divide-slate-100">
              {filteredActive.length === 0 ? (
                <EmptyState
                  icon="fi fi-rr-users"
                  title={search ? "Nenhum voluntário encontrado" : "Nenhum voluntário ativo"}
                  description={search ? "Tente buscar por outro termo." : "Cadastre voluntários usando o formulário ao lado."}
                />
              ) : (
                paginatedList.map((volunteer) => (
                  <div key={volunteer.id} className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 font-semibold text-navy-800">
                        <span className="truncate">{volunteer.name}</span>
                        {volunteer.phone && <WhatsAppIconLink phone={volunteer.phone} label={volunteer.name} compact />}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <span>{volunteer.congregation || "Sem congregação"}</span>
                      </div>
                      {justApproved.includes(volunteer.id) && volunteer.phone && (
                        <a
                          href={createWaMeLink(volunteer.phone, approveMessage(volunteer))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-whatsapp/10 px-3 py-1 text-xs font-semibold text-whatsapp-dark transition hover:bg-whatsapp/20"
                        >
                          <WhatsAppIcon className="h-3.5 w-3.5" />
                          Avisar no WhatsApp
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton label="Editar voluntário" iconClass="fi fi-rr-pencil" onClick={() => onEdit(volunteer)} />
                      <IconButton label="Excluir voluntário" iconClass="fi fi-rr-trash" onClick={() => onDelete(volunteer.id)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="mt-5 divide-y divide-slate-100">
              {filteredPending.length === 0 ? (
                <EmptyState
                  icon="fi fi-rr-user-add"
                  title={search ? "Nenhum cadastro encontrado" : "Nenhum cadastro aguardando aprovação"}
                  description={search ? "Tente buscar por outro termo." : "Quando voluntários se cadastrarem, eles aparecerão aqui."}
                />
              ) : (
                paginatedList.map((volunteer) => {
                  const slots = parseAvailability(volunteer.availability);
                  return (
                    <div key={volunteer.id} className="flex items-center justify-between gap-3 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-navy-800">{volunteer.name}</p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {volunteer.congregation || "Sem congregação"}
                        </p>
                        {slots.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {slots.map((slot) => (
                              <span
                                key={slot}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                              >
                                {AVAILABILITY_SLOT_LABELS[slot] || slot}
                              </span>
                            ))}
                          </div>
                        )}
                        {justApproved.includes(volunteer.id) && volunteer.phone && (
                          <a
                            href={createWaMeLink(volunteer.phone, approveMessage(volunteer))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-whatsapp/10 px-3 py-1 text-xs font-semibold text-whatsapp-dark transition hover:bg-whatsapp/20"
                          >
                            <WhatsAppIcon className="h-3.5 w-3.5" />
                            Avisar no WhatsApp
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button className="!px-4 !py-2" onClick={() => handleApprove(volunteer)}>
                          {justApproved.includes(volunteer.id) ? (
                            <span className="flex items-center gap-1.5"><i className="fi fi-rr-check text-xs" /> Aprovado</span>
                          ) : "Aprovar"}
                        </Button>
                        <Button
                          variant="outline"
                          className="!px-4 !py-2 !text-red-600"
                          onClick={() => handleReject(volunteer.id)}
                        >
                          Recusar
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
          {currentList.length > PAGE_SIZE && (
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm text-slate-400">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próximo
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
