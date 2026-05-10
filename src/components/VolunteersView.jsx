import { Card, Button, IconButton, Field } from "./UI";
import { WhatsAppIconLink } from "./WhatsApp";

export default function VolunteersView({
  volunteers,
  volunteerForm,
  setVolunteerForm,
  isUnlocked,
  onUnlock,
  onSave,
  onEdit,
  onDelete,
  onCancel,
}) {
  if (!isUnlocked) {
    return (
      <Card className="ap-form-card mx-auto max-w-2xl p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-2xl text-[#172233]">
          <i className="fi fi-rr-file-edit" />
        </div>
        <h3 className="mt-4 text-2xl font-bold">Edição protegida</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Para cadastrar, editar ou excluir voluntários, informe a senha de edição.
        </p>
        <Button className="mt-5" onClick={onUnlock}>
          Liberar edição
        </Button>
      </Card>
    );
  }

  return (
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
            <p className="text-sm text-slate-500">Lista</p>
            <h3 className="text-xl font-bold">Voluntários cadastrados</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {volunteers.length} voluntários
          </span>
        </div>
        <div className="mt-5 divide-y divide-slate-100">
          {volunteers.map((volunteer) => (
            <div key={volunteer.id} className="flex items-center justify-between gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 font-semibold text-[#172233]">
                  <span className="truncate">{volunteer.name}</span>
                  {volunteer.phone && <WhatsAppIconLink phone={volunteer.phone} label={volunteer.name} compact />}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span>{volunteer.congregation || "Sem congregação"}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconButton label="Editar voluntário" iconClass="fi fi-rr-pencil" onClick={() => onEdit(volunteer)} />
                <IconButton label="Excluir voluntário" iconClass="fi fi-rr-trash" onClick={() => onDelete(volunteer.id)} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
