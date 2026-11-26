import { useState, useCallback, useEffect, useMemo } from "react";
import { Modal, Button } from "./UI";
import { getAvailabilitySlotId, parseAvailability } from "../utils/helpers";
import { useBeforeUnload } from "../hooks/useBeforeUnload";
import { useKeyboardShortcut } from "../hooks/useKeyboardShortcut";
import { listDepartmentMembers } from "../services/departmentService";
import type {
  DepartmentMemberRow,
  ScheduleBlock,
  ShiftEditorPayload,
  ShiftEditorState,
  Volunteer,
} from "../types";

interface ShiftEditorModalProps {
  shiftEditor: ShiftEditorState;
  volunteers: Volunteer[];
  schedule: ScheduleBlock[];
  departmentId?: string | null;
  coordinatorName?: string | null;
  onClose: () => void;
  onSave: (payload: ShiftEditorPayload) => void;
}

type ResponsibleKind = "coordenador" | "voluntario" | "assistente";
interface ResponsibleOption {
  name: string;
  kind: ResponsibleKind;
}

export default function ShiftEditorModal({
  shiftEditor,
  volunteers,
  schedule,
  departmentId,
  coordinatorName,
  onClose,
  onSave,
}: ShiftEditorModalProps) {
  const isEdit = Boolean(shiftEditor?.shiftId);
  const currentShift = isEdit && shiftEditor.shiftId
    ? schedule.flatMap((block) => block.shifts).find((shift) => shift.id === shiftEditor.shiftId)
    : null;

  const [blockId, setBlockId] = useState(shiftEditor?.blockId || schedule[0]?.id || "");
  const [startTime, setStartTime] = useState(currentShift?.start || "");
  const [endTime, setEndTime] = useState(currentShift?.end || "");
  const [description, setDescription] = useState(currentShift?.description || "");
  const [vagas, setVagas] = useState<number | string>(currentShift?.vagas || 0);
  const [responsible, setResponsible] = useState(currentShift?.responsible || "");
  const [selectedIds, setSelectedIds] = useState<string[]>(currentShift?.volunteerIds || []);
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState(currentShift?.manualNames?.[0] || "");

  const hasChanges =
    startTime !== (currentShift?.start || "") ||
    endTime !== (currentShift?.end || "") ||
    description !== (currentShift?.description || "") ||
    vagas !== (currentShift?.vagas || 0) ||
    responsible !== (currentShift?.responsible || "") ||
    JSON.stringify(selectedIds) !== JSON.stringify(currentShift?.volunteerIds || []) ||
    manualName !== (currentShift?.manualNames?.[0] || "");
  useBeforeUnload(hasChanges);

  const currentBlock =
    schedule.find((block) => block.id === blockId) || schedule[0] || null;
  const slotId = getAvailabilitySlotId(currentBlock?.day, currentBlock?.period);

  // Dias disponíveis (ordem de exibição já vem do schedule) e períodos do dia
  // selecionado — na prática sempre "Manhã" e "Tarde".
  const days = useMemo(() => {
    const seen: string[] = [];
    for (const block of schedule) {
      if (!seen.includes(block.day)) seen.push(block.day);
    }
    return seen;
  }, [schedule]);

  const periodsOfDay = useMemo(() => {
    const seen: string[] = [];
    for (const block of schedule) {
      if (block.day === currentBlock?.day && !seen.includes(block.period)) seen.push(block.period);
    }
    return seen;
  }, [schedule, currentBlock?.day]);

  function selectBlockByDayPeriod(day: string, period: string) {
    const match =
      schedule.find((block) => block.day === day && block.period === period) ||
      schedule.find((block) => block.day === day);
    if (match) setBlockId(match.id);
  }

  // Membros do departamento (coordenador/assistente) para o campo Responsável.
  const [members, setMembers] = useState<DepartmentMemberRow[]>([]);
  useEffect(() => {
    if (!departmentId) return;
    let active = true;
    listDepartmentMembers(departmentId)
      .then((rows) => {
        if (active) setMembers(rows);
      })
      .catch(() => {
        // silencioso: ainda dá para escolher coordenador (prop) e voluntários
      });
    return () => {
      active = false;
    };
  }, [departmentId]);

  const responsibleOptions = useMemo<ResponsibleOption[]>(() => {
    const options: ResponsibleOption[] = [];
    const seen = new Set<string>();
    const add = (kind: ResponsibleKind, name?: string | null) => {
      const clean = (name || "").trim();
      if (!clean || seen.has(clean)) return;
      seen.add(clean);
      options.push({ name: clean, kind });
    };
    add("coordenador", coordinatorName);
    members
      .filter((member) => member.role === "coordenador")
      .forEach((member) => add("coordenador", member.profiles?.name));
    volunteers.forEach((volunteer) => add("voluntario", volunteer.name));
    members
      .filter((member) => member.role === "assistente")
      .forEach((member) => add("assistente", member.profiles?.name));
    return options;
  }, [coordinatorName, members, volunteers]);

  const coordinatorOptions = responsibleOptions.filter((option) => option.kind === "coordenador");
  const volunteerOptions = responsibleOptions.filter((option) => option.kind === "voluntario");
  const assistantOptions = responsibleOptions.filter((option) => option.kind === "assistente");
  const responsibleKnown = responsibleOptions.some((option) => option.name === responsible);

  const sortedVolunteers = [...volunteers].sort((a, b) => {
    const aAvailable = slotId && parseAvailability(a.availability).includes(slotId) ? 1 : 0;
    const bAvailable = slotId && parseAvailability(b.availability).includes(slotId) ? 1 : 0;
    return bAvailable - aAvailable;
  });

  const conflictingVolunteers = (() => {
    if (manualMode || !currentBlock || !currentShift) return [] as Volunteer[];
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

  function toggleVolunteer(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  const canSave = Boolean(startTime.trim() && endTime.trim());

  const handleSave = useCallback(() => {
    if (!canSave) return;
    onSave({
      blockId: currentBlock?.id || blockId,
      shiftId: isEdit ? shiftEditor.shiftId ?? null : null,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      description: description.trim(),
      vagas: Math.max(0, Number(vagas) || 0),
      responsible: responsible.trim(),
      selectedIds: manualMode ? [] : selectedIds,
      manualName: manualMode ? manualName.trim() : "",
    });
  }, [canSave, onSave, currentBlock, blockId, isEdit, shiftEditor, startTime, endTime, description, vagas, responsible, manualMode, selectedIds, manualName]);

  useKeyboardShortcut("s", handleSave, { ctrl: true });

  const selectClass = "ef-select";

  return (
    <Modal title={isEdit ? "Editar turno" : "Criar turno"} onClose={onClose}>
      <div className="space-y-4">
        {!isEdit && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="ef-label">Dia</span>
              <select
                value={currentBlock?.day || ""}
                onChange={(event) => selectBlockByDayPeriod(event.target.value, currentBlock?.period || "")}
                className={selectClass}
              >
                {days.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="ef-label">Período</span>
              <select
                value={currentBlock?.period || ""}
                onChange={(event) => selectBlockByDayPeriod(currentBlock?.day || "", event.target.value)}
                className={selectClass}
              >
                {periodsOfDay.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="ef-label">Início</span>
            <input
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              placeholder="Ex: 8:00"
              className="ef-input"
            />
          </label>
          <label className="block">
            <span className="ef-label">Fim</span>
            <input
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              placeholder="Ex: 9:30"
              className="ef-input"
            />
          </label>
        </div>

        <label className="block">
          <span className="ef-label">Descrição / Local</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ex: Guarda Volumes — Entrada principal"
            className="ef-input"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="ef-label">Vagas</span>
            <input
              type="number"
              min="0"
              value={vagas}
              onChange={(event) => setVagas(event.target.value)}
              placeholder="0"
              className="ef-input"
            />
          </label>
          <label className="block">
            <span className="ef-label">Responsável</span>
            <select
              value={responsible}
              onChange={(event) => setResponsible(event.target.value)}
              className={selectClass}
            >
              <option value="">Sem responsável</option>
              {coordinatorOptions.length > 0 && (
                <optgroup label="Coordenador">
                  {coordinatorOptions.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {volunteerOptions.length > 0 && (
                <optgroup label="Voluntários">
                  {volunteerOptions.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {assistantOptions.length > 0 && (
                <optgroup label="Assistentes">
                  {assistantOptions.map((option) => (
                    <option key={option.name} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              )}
              {responsible && !responsibleKnown && (
                <option value={responsible}>{responsible}</option>
              )}
            </select>
          </label>
        </div>

        {!manualMode ? (
          <div>
            <p className="ef-label">Voluntários</p>
            <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
              {sortedVolunteers.map((volunteer) => {
                const available =
                  slotId && parseAvailability(volunteer.availability).includes(slotId);
                return (
                  <label
                    key={volunteer.id}
                    className="flex cursor-pointer items-center justify-between rounded-tile border border-[var(--ef-border)] bg-[var(--ef-tile)] p-3 transition hover:bg-[var(--ef-hover)]"
                  >
                    <span>
                      <strong className="flex items-center gap-2 text-sm font-semibold text-[var(--ef-text)]">
                        {volunteer.name}
                        {available && (
                          <span className="ef-badge ef-badge-ok !py-0.5 !text-[10px]">
                            Disponível
                          </span>
                        )}
                      </strong>
                      <small className="text-[var(--ef-muted)]">
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
            <span className="ef-label">Nome do voluntário (Avulso)</span>
            <input
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Ex: Irmão Joãozinho"
              className="ef-input"
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
          <span className="text-sm font-medium text-[var(--ef-text-2)]">
            Adicionar nome não cadastrado (Avulso)
          </span>
        </label>

        {conflictingVolunteers.length > 0 && (
          <p className="ef-alert ef-alert-danger">
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
          {isEdit ? "Salvar alterações" : "Criar turno"}
        </Button>
      </div>
    </Modal>
  );
}
