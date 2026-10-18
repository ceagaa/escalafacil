import { useState, useCallback, useMemo } from "react";
import {
  dayTheme,
  UNASSIGNED_LABEL,
  getCurrentMinutes,
  getTodayScheduleDay,
  findActiveShiftId,
  buildAssignmentMessage,
  buildDaySummary,
} from "../utils/helpers";
import { Card, Button, DayBadge, LiveNowBadge } from "./UI";
import { VolunteerWhatsAppName, ResponsibleNames } from "./WhatsApp";
import { useKeyboardShortcut } from "../hooks/useKeyboardShortcut";
import ConfirmModal from "./ConfirmModal";

const CONGRESSO_DAYS = ["Sexta-feira", "Sábado", "Domingo"];

function getEventDays(eventType, dataEvento) {
  if (eventType === "congresso_regional") {
    if (!dataEvento) return CONGRESSO_DAYS;
    const base = new Date(dataEvento + "T12:00:00");
    return CONGRESSO_DAYS.map((day, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return {
        label: day,
        date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      };
    });
  }
  if (!dataEvento) return [{ label: "Dia do Evento", date: "" }];
  const d = new Date(dataEvento + "T12:00:00");
  return [{
    label: d.toLocaleDateString("pt-BR", { weekday: "long" }),
    date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }),
  }];
}

export default function ScheduleView({
  activeDay,
  setActiveDay,
  dayCards,
  volunteers,
  now,
  onEditShift,
  onCreateShift,
  onDeleteShift,
  onAllocateVolunteers,
  departmentName = "",
  eventType,
  dataEvento,
}) {
  const [copied, setCopied] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const currentMinutes = getCurrentMinutes(now);
  const todayDay = getTodayScheduleDay(now);

  const eventDays = useMemo(() => getEventDays(eventType, dataEvento), [eventType, dataEvento]);
  const isSingleDay = eventDays.length === 1;

  // Em evento de dia único o dia real é o do evento, não o `activeDay` do App.
  const effectiveDay = isSingleDay ? eventDays[0]?.label : activeDay;
  const activeShiftId = findActiveShiftId(dayCards, effectiveDay, todayDay, currentMinutes);

  const handleNewShift = useCallback(() => {
    onCreateShift(dayCards[0]?.id);
  }, [onCreateShift, dayCards]);

  useKeyboardShortcut("n", handleNewShift, { ctrl: true });

  async function copyDaySummary() {
    const text = buildDaySummary(dayCards, effectiveDay, volunteers, departmentName);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      console.warn("Falha ao copiar resumo do dia.", error);
    }
  }

  function handleConfirmDelete() {
    if (deleteModal) {
      onDeleteShift(deleteModal.blockId, deleteModal.shiftId);
      setDeleteModal(null);
    }
  }

  return (
    <div className="ap-schedule-view grid w-full gap-6">
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[#172233]">Escala</h2>
            <Button onClick={() => onCreateShift(dayCards[0]?.id)} className="!px-5 !py-2.5">
              <i className="fi fi-rr-plus" /> Criar Turno
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!isSingleDay && (
              <div className="ap-day-tabs flex p-0">
                {eventDays.map((day) => (
                  <button
                    key={day.label}
                    onClick={() => setActiveDay(day.label)}
                    className="rounded-full px-6 py-4 text-sm font-medium transition md:px-8"
                    style={
                      activeDay === day.label
                        ? {
                            backgroundColor: (dayTheme[day.label] || dayTheme["Sexta-feira"]).soft,
                            color: (dayTheme[day.label] || dayTheme["Sexta-feira"]).color,
                            boxShadow: "none",
                          }
                        : undefined
                    }
                  >
                    <span className="hidden md:inline">{day.label.replace("-feira", "")}</span>
                    <span className="md:hidden">{day.label.replace("-feira", "").slice(0, 3)}</span>
                    {day.date && (
                      <span className="ml-1.5 text-[10px] opacity-60">{day.date}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {isSingleDay && (
              <div className="flex items-center gap-2 rounded-full bg-brand-400/10 px-4 py-2">
                <i className="fi fi-rr-calendar text-sm text-brand-400" />
                <span className="text-sm font-medium text-brand-400">{eventDays[0]?.label}</span>
                {eventDays[0]?.date && (
                  <span className="text-xs text-slate-500">· {eventDays[0]?.date}</span>
                )}
              </div>
            )}
            <Button variant="outline" onClick={copyDaySummary} className="!px-4 !py-2">
              <i className="fi fi-rr-copy" /> {copied ? "Copiado!" : "Copiar Resumo do Dia"}
            </Button>
          </div>
        </div>

        {dayCards.length === 0 ? (
          <button
            type="button"
            onClick={() => onCreateShift()}
            className="group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center transition hover:border-brand-400/40 hover:bg-brand-400/5"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 transition group-hover:bg-brand-400/15">
              <i className="fi fi-rr-calendar-plus text-2xl text-slate-400 transition group-hover:text-brand-400" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-700 transition group-hover:text-navy-800">Criar Escala</p>
            <p className="mt-1 text-sm text-slate-400">Clique para criar o primeiro turno</p>
          </button>
        ) : (
          <div className="grid w-full gap-4 lg:grid-cols-2">
            {dayCards.map((block) => {
              const theme = dayTheme[block.day] || dayTheme["Sexta-feira"];

              return (
                <Card key={block.id} className="ap-period-card overflow-hidden p-7">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-7">
                    <DayBadge day={block.day} period={block.period} />
                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-[12px] font-medium text-slate-400">Responsável</span>
                      <ResponsibleNames responsible={block.responsible} day={block.day} />
                    </div>
                  </div>

                  <div className="space-y-3 pt-7">
                    {block.shifts.map((shift) => {
                      const selectedVolunteers = shift.volunteerIds
                        .map((id) => volunteers.find((volunteer) => volunteer.id === id))
                        .filter(Boolean);
                      const current = shift.id === activeShiftId;
                      const totalSlots = shift.vagas || 0;
                      const filledSlots = selectedVolunteers.length + (shift.manualNames?.length || 0);
                      const occupancy = totalSlots > 0 ? filledSlots / totalSlots : null;

                      return (
                        <div
                          key={shift.id}
                          className={`ap-shift-card rounded-3xl bg-[#f6f6f6] p-7 shadow-sm transition ${
                            current ? "border-2" : "border border-transparent"
                          }`}
                          style={
                            current
                              ? {
                                  borderColor: theme.color,
                                  boxShadow: "0 12px 30px " + theme.soft,
                                }
                              : undefined
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-medium text-slate-400">Designação</p>
                                {current && <LiveNowBadge color={theme.color} backgroundColor={theme.soft} />}
                              </div>
                              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                                <span className="text-[18px] font-bold leading-tight" style={{ color: "#172233" }}>
                                  {shift.start}
                                </span>
                                <span className="text-sm text-slate-400">até</span>
                                <span className="text-[18px] font-semibold text-slate-700">{shift.end}</span>
                              </div>
                              {shift.description && (
                                <p className="mt-1 text-xs font-medium text-slate-400">
                                  {shift.description}
                                </p>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                variant="outline"
                                square
                                onClick={() => onAllocateVolunteers({ blockId: block.id, shiftId: shift.id, block, shift })}
                                aria-label="Alocar voluntários"
                              >
                                <i className="fi fi-rr-user-plus" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                square
                                onClick={() => onEditShift({ blockId: block.id, shiftId: shift.id })}
                                aria-label="Editar turno"
                              >
                                <i className="fi fi-rr-pencil" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="outline"
                                square
                                onClick={() => setDeleteModal({ blockId: block.id, shiftId: shift.id, shift })}
                                aria-label="Excluir turno"
                                className="!border-red-200 !text-red-400 hover:!bg-red-50 hover:!text-red-500"
                              >
                                <i className="fi fi-rr-trash" aria-hidden="true" />
                              </Button>
                            </div>
                          </div>

                          {occupancy !== null && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-medium text-slate-500">
                                  {filledSlots}/{totalSlots} vagas preenchidas
                                </span>
                                <span className={`font-bold ${
                                  occupancy >= 1 ? "text-emerald-600" : occupancy >= 0.5 ? "text-amber-600" : "text-red-500"
                                }`}>
                                  {Math.round(occupancy * 100)}%
                                </span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    occupancy >= 1 ? "bg-emerald-500" : occupancy >= 0.5 ? "bg-amber-400" : "bg-red-400"
                                  }`}
                                  style={{ width: `${Math.min(occupancy * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <ShiftDetailsCard
                            volunteers={selectedVolunteers}
                            manualNames={shift.manualNames || []}
                            block={block}
                            shift={shift}
                            departmentName={departmentName}
                          />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {deleteModal && (
        <ConfirmModal
          title="Excluir Turno"
          message={`Tem certeza que deseja excluir o turno de ${deleteModal.shift.start} até ${deleteModal.shift.end}? Esta ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          cancelLabel="Cancelar"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </div>
  );
}

function ShiftDetailsCard({ volunteers, manualNames, block, shift, departmentName }) {
  const hasAssignments = volunteers.length > 0 || manualNames.length > 0;
  return (
    <div className="ap-volunteer-chip-card mt-4">
      <div className="flex flex-col gap-2">
        {hasAssignments ? (
          <>
            {volunteers.map((volunteer) => (
              <VolunteerWhatsAppName
                key={volunteer.id}
                volunteer={volunteer}
                message={buildAssignmentMessage(
                  volunteer,
                  { day: block.day, period: block.period, start: shift.start, end: shift.end },
                  departmentName
                )}
              />
            ))}
            {manualNames.map((name) => (
              <span
                key={name}
                className="inline-flex w-fit items-center gap-1.5 rounded-full font-semibold"
                style={{ color: "#172233" }}
              >
                <span>{name}</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Avulso
                </span>
              </span>
            ))}
          </>
        ) : (
          <span className="text-sm font-semibold" style={{ color: "#172233" }}>
            {UNASSIGNED_LABEL}
          </span>
        )}
      </div>
    </div>
  );
}
