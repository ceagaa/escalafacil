import {
  dayTheme,
  UNASSIGNED_LABEL,
  getCurrentMinutes,
  getTodayScheduleDay,
  findActiveShiftId,
} from "../utils/helpers";
import { Card, Button, DayBadge, LiveNowBadge } from "./UI";
import { VolunteerWhatsAppName, ResponsibleNames } from "./WhatsApp";

export default function ScheduleView({ activeDay, setActiveDay, dayCards, volunteers, now, onEditShift }) {
  const currentMinutes = getCurrentMinutes(now);
  const todayDay = getTodayScheduleDay(now);
  const activeShiftId = findActiveShiftId(dayCards, activeDay, todayDay, currentMinutes);

  return (
    <div className="ap-schedule-view grid w-full gap-6">
      <div className="space-y-5">
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-[#172233]">Escala</h2>
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
                          </div>

                          <Button variant="outline" square onClick={() => onEditShift({ blockId: block.id, shiftId: shift.id })}>
                            <i className="fi fi-rr-pencil" />
                          </Button>
                        </div>

                        <ShiftDetailsCard volunteers={selectedVolunteers} />
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

function ShiftDetailsCard({ volunteers }) {
  return (
    <div className="ap-volunteer-chip-card mt-4">
      <div className="flex flex-col gap-2">
        {volunteers.length ? (
          volunteers.map((volunteer) => (
            <VolunteerWhatsAppName key={volunteer.id} volunteer={volunteer} />
          ))
        ) : (
          <span className="text-sm font-semibold" style={{ color: "#172233" }}>
            {UNASSIGNED_LABEL}
          </span>
        )}
      </div>
    </div>
  );
}
