import { useState } from "react";
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

export default function ScheduleView({
  activeDay,
  setActiveDay,
  dayCards,
  volunteers,
  now,
  onEditShift,
  onCreateShift,
  departmentName = "",
}) {
  const [copied, setCopied] = useState(false);
  const currentMinutes = getCurrentMinutes(now);
  const todayDay = getTodayScheduleDay(now);
  const activeShiftId = findActiveShiftId(dayCards, activeDay, todayDay, currentMinutes);

  async function copyDaySummary() {
    const text = buildDaySummary(dayCards, activeDay, volunteers, departmentName);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      console.warn("Falha ao copiar resumo do dia.", error);
    }
  }

  return (
    <div className="ap-schedule-view grid w-full gap-6">
      <div className="space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[#172233]">Escala</h2>
            <Button onClick={() => onCreateShift(dayCards[0]?.id)} className="!px-5 !py-2.5">
              <i className="fi fi-rr-plus" /> Criar Escala
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="ap-day-tabs flex p-0">
              {["Sexta-feira", "Sábado", "Domingo"].map((day) => (
                <button
                  key={day}
                  onClick={() => setActiveDay(day)}
                  className="rounded-full px-8 py-4 text-sm font-medium transition"
                  style={
                    activeDay === day
                      ? {
                          backgroundColor: dayTheme[day].soft,
                          color: dayTheme[day].color,
                          boxShadow: "none",
                        }
                      : undefined
                  }
                >
                  {day.replace("-feira", "")}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={copyDaySummary} className="!px-4 !py-2">
              <i className="fi fi-rr-copy" /> {copied ? "Copiado!" : "Copiar Resumo do Dia"}
            </Button>
          </div>
        </div>

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

                          <Button variant="outline" square onClick={() => onEditShift({ blockId: block.id, shiftId: shift.id })}>
                            <i className="fi fi-rr-pencil" />
                          </Button>
                        </div>

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
      </div>
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
