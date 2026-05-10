import { useState } from "react";
import { Modal, Button } from "./UI";

export default function ShiftEditorModal({ shiftEditor, volunteers, schedule, onClose, onSave }) {
  const currentShift = schedule
    .flatMap((block) => block.shifts)
    .find((shift) => shift.id === shiftEditor.shiftId);
  const [selectedIds, setSelectedIds] = useState(currentShift?.volunteerIds || []);

  function toggleVolunteer(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  return (
    <Modal title="Editar voluntários do turno" onClose={onClose}>
      <p className="text-sm text-slate-500">Selecione um ou mais voluntários para este horário.</p>
      <div className="mt-4 max-h-80 space-y-2 overflow-auto pr-1">
        {volunteers.map((volunteer) => (
          <label
            key={volunteer.id}
            className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-100 p-3 hover:bg-slate-50"
          >
            <span>
              <strong className="block">{volunteer.name}</strong>
              <small className="text-slate-500">{volunteer.congregation || "Sem congregação"}</small>
            </span>
            <input
              type="checkbox"
              checked={selectedIds.includes(volunteer.id)}
              onChange={() => toggleVolunteer(volunteer.id)}
              className="h-5 w-5"
            />
          </label>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={() => onSave(selectedIds)}>Salvar escala</Button>
      </div>
    </Modal>
  );
}
