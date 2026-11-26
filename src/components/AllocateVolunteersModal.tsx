import { useState, useMemo } from "react";
import { Modal, Button } from "./UI";
import { getAvailabilitySlotId, parseAvailability } from "../utils/helpers";
import type { AllocateModalState, ScheduleBlock, Shift, Volunteer } from "../types";

interface AllocateVolunteersModalProps {
  block: ScheduleBlock;
  shift: Shift;
  volunteers?: Volunteer[];
  assignedVolunteerIds: string[];
  onAllocate: (volunteerId: string) => void;
  onDeallocate: (volunteerId: string) => void;
  onClose: () => void;
}

export default function AllocateVolunteersModal({
  block,
  shift,
  volunteers = [],
  assignedVolunteerIds,
  onAllocate,
  onDeallocate,
  onClose,
}: AllocateVolunteersModalProps) {
  const [search, setSearch] = useState("");

  const slotId = getAvailabilitySlotId(block?.day, block?.period);
  const assignedSet = new Set(assignedVolunteerIds || []);

  const sortedVolunteers = useMemo(() => {
    const list = [...volunteers].sort((a, b) => {
      const aAvail = slotId && parseAvailability(a.availability).includes(slotId) ? 1 : 0;
      const bAvail = slotId && parseAvailability(b.availability).includes(slotId) ? 1 : 0;
      return bAvail - aAvail;
    });
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((v) => v.name.toLowerCase().includes(q) || (v.congregation || "").toLowerCase().includes(q));
  }, [volunteers, slotId, search]);

  if (!block || !shift) return null;

  return (
    <Modal title={`Alocar Voluntários — ${shift.start} até ${shift.end}`} onClose={onClose}>
      <div className="space-y-4">
        <label className="block" htmlFor="allocate-search">
          <span className="ef-label">Buscar voluntário</span>
          <input
            id="allocate-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou congregação..."
            className="ef-input"
            autoFocus
          />
        </label>

        {slotId && (
          <p className="ef-meta">
            Voluntários com disponibilidade para <strong className="font-semibold text-[var(--ef-text-2)]">{block.day} — {block.period}</strong> estão destacados.
          </p>
        )}
        <div className="max-h-72 space-y-2 overflow-auto pr-1">
          {sortedVolunteers.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--ef-muted)]">Nenhum voluntário encontrado.</p>
          ) : (
            sortedVolunteers.map((volunteer) => {
              const isAssigned = assignedSet.has(volunteer.id);
              const isAvailable = slotId && parseAvailability(volunteer.availability).includes(slotId);

              return (
                <div
                  key={volunteer.id}
                  className={`flex items-center justify-between rounded-tile border p-3 transition ${
                    isAssigned
                      ? "border-[var(--ef-accent)] bg-[var(--ef-accent-soft)]"
                      : "border-[var(--ef-border)] bg-[var(--ef-tile)] hover:bg-[var(--ef-hover)]"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--ef-text)]">{volunteer.name}</span>
                      {isAvailable && (
                        <span className="ef-badge ef-badge-ok shrink-0 !py-0.5 !text-[10px]">
                          Disponível
                        </span>
                      )}
                      {isAssigned && (
                        <span className="ef-badge ef-badge-accent shrink-0 !py-0.5 !text-[10px]">
                          Alocado
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--ef-muted)]">{volunteer.congregation || "Sem congregação"}</span>
                  </div>
                  {isAssigned ? (
                    <button
                      type="button"
                      onClick={() => onDeallocate(volunteer.id)}
                      className="ml-3 shrink-0 rounded-full border border-[var(--ef-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ef-danger)] transition hover:bg-[var(--ef-danger-soft)]"
                    >
                      <i className="fi fi-rr-trash mr-1 text-[10px]" />
                      Remover
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAllocate(volunteer.id)}
                      className="ef-btn ef-btn-primary ef-btn-sm ml-3 shrink-0 !min-h-0 !px-3 !py-1.5 !text-xs"
                    >
                      <i className="fi fi-rr-plus text-[10px]" />
                      Alocar
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export type { AllocateModalState };
