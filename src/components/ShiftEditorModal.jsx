import { useState } from "react";
import { Modal, Button } from "./UI";
import { getAvailabilitySlotId, parseAvailability } from "../utils/helpers";

export default function ShiftEditorModal({ shiftEditor, volunteers, schedule, onClose, onSave }) {
  const isEdit = Boolean(shiftEditor?.shiftId);
  const currentShift = isEdit
    ? schedule.flatMap((block) => block.shifts).find((shift) => shift.id === shiftEditor.shiftId)
    : null;

  const [blockId, setBlockId] = useState(shiftEditor?.blockId || schedule[0]?.id || "");
  const [startTime, setStartTime] = useState(currentShift?.start || "");
  const [endTime, setEndTime] = useState(currentShift?.end || "");
  const [description, setDescription] = useState(currentShift?.description || "");
  const [selectedIds, setSelectedIds] = useState(currentShift?.volunteerIds || []);
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState(currentShift?.manualNames?.[0] || "");

  const currentBlock =
    schedule.find((block) => block.id === blockId) || schedule[0] || null;
  const slotId = getAvailabilitySlotId(currentBlock?.day, currentBlock?.period);

  const sortedVolunteers = [...volunteers].sort((a, b) => {
    const aAvailable = slotId && parseAvailability(a.availability).includes(slotId) ? 1 : 0;
    const bAvailable = slotId && parseAvailability(b.availability).includes(slotId) ? 1 : 0;
    return bAvailable - aAvailable;
  });

  const conflictingVolunteers = (() => {
    if (manualMode || !currentBlock || !currentShift) return [];
    const conflictingIds = new Set(
      schedule
        .filter((block) => block.day === currentBlock.day)
        .flatMap((block) => block.shifts)
        .filter((shift) => shift.id !== currentShift.id && shift.start === currentShift.start)
        .flatMap((shift) => shift.volunteerIds)
        .map(String)
    );
    return volunteers.filter(
      (volunteer) => selectedIds.includes(volunteer.id) && conflictingIds.has(String(volunteer.id))
    );
  })();

  function toggleVolunteer(id) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  const canSave = Boolean(startTime.trim() && endTime.trim());

  function handleSave() {
    onSave({
      blockId: currentBlock?.id || blockId,
      shiftId: isEdit ? shiftEditor.shiftId : null,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      description: description.trim(),
      selectedIds: manualMode ? [] : selectedIds,
      manualName: manualMode ? manualName.trim() : "",
    });
  }

  return (
    <Modal title={isEdit ? "Editar turno" : "Criar escala"} onClose={onClose}>
      <div className="space-y-4">
        {!isEdit && (
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Período</span>
            <select
              value={blockId}
              onChange={(event) => setBlockId(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            >
              {schedule.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.day} — {block.period}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Início</span>
            <input
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              placeholder="Ex: 8:00"
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Fim</span>
            <input
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              placeholder="Ex: 9:30"
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-slate-600">Descrição / Local</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex: Guarda Volumes — Entrada principal"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
          />
        </label>

        {!manualMode ? (
          <div>
            <p className="text-sm font-medium text-slate-600">Voluntários</p>
            <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
              {sortedVolunteers.map((volunteer) => {
                const available =
                  slotId && parseAvailability(volunteer.availability).includes(slotId);
                return (
                  <label
                    key={volunteer.id}
                    className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-100 p-3 hover:bg-slate-50"
                  >
                    <span>
                      <strong className="flex items-center gap-2">
                        {volunteer.name}
                        {available && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                            Disponível
                          </span>
                        )}
                      </strong>
                      <small className="text-slate-500">
                        {volunteer.congregation || "Sem congregação"}
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(volunteer.id)}
                      onChange={() => toggleVolunteer(volunteer.id)}
                      className="h-5 w-5"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <label className="block">
            <span className="text-sm font-medium text-slate-600">Nome do voluntário (Avulso)</span>
            <input
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Ex: Irmão Joãozinho"
              className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
            />
          </label>
        )}

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={manualMode}
            onChange={() => setManualMode((current) => !current)}
            className="h-5 w-5"
          />
          <span className="text-sm font-medium text-slate-600">
            Adicionar nome não cadastrado (Avulso)
          </span>
        </label>

        {conflictingVolunteers.length > 0 && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            Atenção: {conflictingVolunteers.map((volunteer) => volunteer.name).join(", ")}{" "}
            {conflictingVolunteers.length === 1 ? "já está escalado" : "já estão escalados"} em outro
            turno neste mesmo horário.
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={!canSave}>
          {isEdit ? "Salvar alterações" : "Criar escala"}
        </Button>
      </div>
    </Modal>
  );
}
