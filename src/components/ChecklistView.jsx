import imageCompression from "browser-image-compression";
import { statusClass } from "../utils/helpers";
import { Card, Button, IconButton, Field, Select, Icon } from "./UI";

export default function ChecklistView({
  query,
  setQuery,
  items,
  itemForm,
  setItemForm,
  onSave,
  onEdit,
  onDelete,
  onStatusChange,
  onCancel,
}) {
  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 0.5,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      });
      const preview = await imageCompression.getDataUrlFromFile(compressedFile);
      setItemForm({ ...itemForm, photo: preview, imageFile: compressedFile });
    } catch {
      const dataUrl = await readFileAsDataUrl(file);
      setItemForm({ ...itemForm, photo: dataUrl });
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[.9fr_1.4fr]">
      <Card className="ap-form-card h-fit p-8">
        <p className="text-sm text-slate-500">Registro</p>
        <h3 className="text-xl font-bold">{itemForm.id ? "Editar item" : "Item Perdido"}</h3>
        <form className="mt-5 space-y-3" onSubmit={onSave}>
          <Field
            label="Item"
            placeholder="Ex: Bolsa preta, Relógio dourado, Brinco pequeno"
            value={itemForm.item}
            onChange={(value) => setItemForm({ ...itemForm, item: value })}
            required
          />
          <Field
            label="Nome"
            placeholder="Nome de quem encontrou o item"
            value={itemForm.person}
            onChange={(value) => setItemForm({ ...itemForm, person: value })}
          />
          <Select
            label="Dia"
            value={itemForm.day}
            onChange={(value) => setItemForm({ ...itemForm, day: value })}
            options={["Sexta-feira", "Sábado", "Domingo"]}
          />
          {itemForm.id && (
            <Select
              label="Status"
              value={itemForm.status}
              onChange={(value) => setItemForm({ ...itemForm, status: value })}
              options={["Guardado", "Entregue"]}
            />
          )}
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Foto do item</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
            {itemForm.photo && (
              <img
                src={itemForm.photo}
                alt="Prévia do item"
                className="mt-3 h-28 w-28 rounded-2xl border border-slate-200 object-cover"
              />
            )}
          </label>
          <div className="flex gap-2 pt-2">
            <Button type="submit">{itemForm.id ? "Salvar" : "Cadastrar"}</Button>
            {itemForm.id && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-slate-500">Checklist</p>
            <h3 className="text-xl font-bold">Itens perdidos e achados</h3>
          </div>
          <label className="flex min-w-[260px] items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2">
            <Icon name="search" className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar item, pessoa ou status"
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </label>
        </div>
        <div className="mt-5 space-y-3">
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex gap-3">
                    <div>
                      {item.photo ? (
                        <img
                          src={item.photo}
                          alt={item.item}
                          className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                          Sem foto
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.item}</p>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {item.person || "Sem contato"} · {item.day}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={item.status}
                      onChange={(event) => onStatusChange(item.id, event.target.value)}
                      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none"
                    >
                      <option>Guardado</option>
                      <option>Entregue</option>
                    </select>
                    <IconButton label="Editar item" iconClass="fi fi-rr-pencil" onClick={() => onEdit(item)} />
                    <IconButton label="Excluir item" iconClass="fi fi-rr-trash" onClick={() => onDelete(item.id)} />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
              Nenhum item encontrado.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
