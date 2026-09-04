import { useState } from "react";
import { Card, Button, IconButton, Field } from "./UI";
import { WhatsAppIconLink, WhatsAppIcon } from "./WhatsApp";
import { createWaMeLink, parseAvailability, AVAILABILITY_SLOT_LABELS } from "../utils/helpers";

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

  const activeVolunteers = volunteers.filter((volunteer) => volunteer.active !== false);
  const pendingVolunteers = volunteers.filter((volunteer) => volunteer.active === false);

  async function handleApprove(volunteer) {
    await onApprove(volunteer.id);
    setJustApproved((current) => [...current, volunteer.id]);
  }

  function approveMessage(volunteer) {
    return `Olá ${volunteer.name}, seu cadastro no departamento ${departmentName} foi aprovado! Em breve você receberá suas designações.`;
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("ativos")}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            tab === "ativos" ? "bg-[#172233] text-white" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          }`}
        >
          Ativos ({activeVolunteers.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("fila")}
          className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
            tab === "fila" ? "bg-[#172233] text-white" : "bg-white text-slate-600 shadow-sm hover:bg-slate-50"
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
              placeholder="Nome do voluntário"
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
              {tab === "ativos" ? activeVolunteers.length : pendingVolunteers.length} cadastros
            </span>
          </div>

          {tab === "ativos" ? (
            <div className="mt-5 divide-y divide-slate-100">
              {activeVolunteers.map((volunteer) => (
                <div key={volunteer.id} className="flex items-center justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold text-[#172233]">
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
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-1 text-xs font-semibold text-[#128C4A] transition hover:bg-[#25D366]/20"
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
              ))}
            </div>
          ) : (
            <div className="mt-5 divide-y divide-slate-100">
              {pendingVolunteers.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">
                  Nenhum cadastro aguardando aprovação.
                </p>
              )}
              {pendingVolunteers.map((volunteer) => {
                const slots = parseAvailability(volunteer.availability);
                return (
                  <div key={volunteer.id} className="flex items-center justify-between gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[#172233]">{volunteer.name}</p>
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
                          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/10 px-3 py-1 text-xs font-semibold text-[#128C4A] transition hover:bg-[#25D366]/20"
                        >
                          <WhatsAppIcon className="h-3.5 w-3.5" />
                          Avisar no WhatsApp
                        </a>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button className="!px-4 !py-2" onClick={() => handleApprove(volunteer)}>
                        Aprovar
                      </Button>
                      <Button
                        variant="outline"
                        className="!px-4 !py-2 !text-red-600"
                        onClick={() => onReject(volunteer.id)}
                      >
                        Recusar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
