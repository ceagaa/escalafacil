import { useState, useMemo } from "react";
import { Modal, Button } from "./UI";
import { getAvailabilitySlotId, parseAvailability } from "../utils/helpers";

export default function AllocateVolunteersModal({
  block,
  shift,
  volunteers,
  assignedVolunteerIds,
  onAllocate,
  onDeallocate,
  onClose,
}) {
  const [search, setSearch] = useState("");

  const slotId = getAvailabilitySlotId(block?.day, block?.period);

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

  const assignedSet = new Set(assignedVolunteerIds || []);

  return (
    <Modal title={`Alocar Voluntários — ${shift.start} até ${shift.end}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-600">Buscar voluntário</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou congregação..."
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20"
            autoFocus
          />
        </div>

        {slotId && (
          <p className="text-xs text-slate-400">
            Voluntários com disponibilidade para <strong>{block.day} — {block.period}</strong> estão destacados.
          </p>
        )}

        <div className="max-h-72 space-y-2 overflow-auto pr-1">
          {sortedVolunteers.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Nenhum voluntário encontrado.</p>
          ) : (
            sortedVolunteers.map((volunteer) => {
              const isAssigned = assignedSet.has(volunteer.id);
              const isAvailable = slotId && parseAvailability(volunteer.availability).includes(slotId);

              return (
                <div
                  key={volunteer.id}
                  className={`flex items-center justify-between rounded-2xl border p-3 transition ${
                    isAssigned
                      ? "border-brand-400/40 bg-brand-400/5"
                      : "border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-[#172233]">{volunteer.name}</span>
                      {isAvailable && (
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          Disponível
                        </span>
                      )}
                      {isAssigned && (
                        <span className="shrink-0 rounded-full bg-brand-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-400">
                          Alocado
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400">{volunteer.congregation || "Sem congregação"}</span>
                  </div>
                  {isAssigned ? (
                    <button
                      type="button"
                      onClick={() => onDeallocate(volunteer.id)}
                      className="ml-3 shrink-0 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50"
                    >
                      <i className="fi fi-rr-trash mr-1 text-[10px]" />
                      Remover
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAllocate(volunteer.id)}
                      className="ml-3 shrink-0 rounded-xl bg-brand-400 px-3 py-1.5 text-xs font-semibold text-[#172233] transition hover:bg-brand-400/80"
                    >
                      <i className="fi fi-rr-plus mr-1 text-[10px]" />
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
