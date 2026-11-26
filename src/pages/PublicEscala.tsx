import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { apiGet, ApiError } from "../services/api";
import { dayTheme, sortScheduleBlocks, sortShifts } from "../utils/helpers";
import type { DepartmentRef } from "../types";

interface PublicShift {
  id: string;
  start: string;
  end: string;
  description: string;
  volunteers: string[];
  manualNames: (string | null)[];
}

interface PublicBlock {
  id: string;
  day: string;
  period: string;
  responsible: string | null;
  accent: string | null;
  shifts: PublicShift[];
}

interface DbBlock {
  id: string;
  day: string;
  period: string;
  responsible?: string | null;
  accent?: string | null;
}

interface DbShiftRow {
  id: string;
  block_id: string;
  start_time: string;
  end_time: string;
  description?: string | null;
}

interface DbAssignedRow {
  shift_id: string;
  volunteer_id: string | null;
  manual_name: string | null;
}

export default function PublicEscala() {
  const { slug } = useParams<{ slug: string }>();
  const [department, setDepartment] = useState<Pick<DepartmentRef, "id" | "name"> | null>(null);
  const [schedule, setSchedule] = useState<PublicBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      let dept: Pick<DepartmentRef, "id" | "name"> | null = null;
      try {
        dept = await apiGet<Pick<DepartmentRef, "id" | "name">>(
          `/api/public/departments/${encodeURIComponent(slug || "")}`
        );
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          console.warn("Falha ao carregar o departamento da escala:", err);
        }
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      if (!dept) {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      type SchedulePayload = {
        blocks: DbBlock[];
        shifts: DbShiftRow[];
        assignments: DbAssignedRow[];
        volunteers: { id: string; name: string; active?: boolean | null }[];
      };

      let payload: SchedulePayload;
      try {
        payload = await apiGet<SchedulePayload>(
          `/api/public/departments/${encodeURIComponent(dept.id)}/schedule`
        );
      } catch {
        if (!cancelled) {
          setLoadError("Não foi possível carregar a escala deste departamento.");
          setLoading(false);
        }
        return;
      }

      if (cancelled) return;

      const blocks: DbBlock[] = Array.isArray(payload?.blocks) ? payload.blocks : [];
      const shifts: DbShiftRow[] = Array.isArray(payload?.shifts) ? payload.shifts : [];
      const assigned: DbAssignedRow[] = Array.isArray(payload?.assignments) ? payload.assignments : [];
      const volunteers: { id: string; name: string; active?: boolean | null }[] = Array.isArray(
        payload?.volunteers
      )
        ? payload.volunteers.filter((volunteer) => volunteer.active !== false)
        : [];

      const volunteerNameById = new Map(
        volunteers.map((volunteer) => [String(volunteer.id), volunteer.name])
      );

      const grouped: PublicBlock[] = sortScheduleBlocks(blocks).map((block) => ({
        id: block.id,
        day: block.day,
        period: block.period,
        responsible: block.responsible ?? null,
        accent: block.accent ?? null,
        shifts: sortShifts(shifts.filter((shift) => shift.block_id === block.id)).map((shift) => ({
          id: shift.id,
          start: shift.start_time,
          end: shift.end_time,
          description: shift.description || "",
          volunteers: assigned
            .filter((item) => item.shift_id === shift.id && item.volunteer_id)
            .map((item) => volunteerNameById.get(String(item.volunteer_id)))
            .filter((name): name is string => Boolean(name)),
          manualNames: assigned
            .filter((item) => item.shift_id === shift.id && item.manual_name)
            .map((item) => item.manual_name),
        })),
      }));

      setDepartment(dept);
      setSchedule(grouped);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ef-bg)]">
        <div className="text-sm text-[var(--ef-muted)]">Carregando escala...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ef-bg)] px-4">
        <div className="ef-card w-full max-w-md p-8 text-center">
          <div className="ef-empty-icon mx-auto !bg-[var(--ef-hover)] text-3xl">
            <i className="fi fi-rr-link-slash" />
          </div>
          <h1 className="ef-h2 mt-4">Departamento não encontrado</h1>
          <p className="mt-2 text-sm text-[var(--ef-muted)]">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const days = ["Sexta-feira", "Sábado", "Domingo"];

  return (
    <div className="min-h-screen bg-[var(--ef-bg)] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <div className="ef-empty-icon mx-auto !bg-[var(--ef-accent-soft)] !text-[var(--ef-accent-strong)]">
            <i className="fi fi-rr-calendar-lines text-2xl" />
          </div>
          <h1 className="ef-h1 mt-4">Escala Geral</h1>
          <p className="ef-lead mt-2">
            Departamento <span className="font-semibold text-[var(--ef-text-2)]">{department?.name}</span>
          </p>
        </div>

        {loadError && (
          <div className="ef-alert ef-alert-danger mb-6 text-center" role="alert">
            {loadError}
          </div>
        )}

        <div className="space-y-8">
          {days.map((day): ReactNode => {
            const blocks = schedule.filter((block) => block.day === day);
            if (blocks.length === 0) return null;
            const theme = dayTheme[day] || dayTheme["Sexta-feira"];
            return (
              <section key={day}>
                <h2
                  className="mb-3 text-lg font-bold tracking-tight"
                  style={{ color: theme.color }}
                >
                  {day}
                </h2>
                <div className="grid gap-3">
                  {blocks.map((block) => (
                    <div key={block.id} className="ef-card p-5">
                      <div className="mb-3 flex items-center justify-between border-b border-[var(--ef-border)] pb-3">
                        <span className="ef-h3">{block.period}</span>
                        {block.responsible && (
                          <span className="ef-meta">Resp.: {block.responsible}</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {block.shifts.map((shift) => (
                          <div
                            key={shift.id}
                            className="rounded-tile bg-[var(--ef-tile)] px-4 py-3"
                          >
                            <p className="text-sm font-semibold text-[var(--ef-text)]">
                              {shift.start} <span className="font-normal text-[var(--ef-muted)]">até</span>{" "}
                              {shift.end}
                            </p>
                            {shift.description && (
                              <p className="mt-0.5 text-xs text-[var(--ef-muted)]">{shift.description}</p>
                            )}
                            <p className="mt-1 text-sm text-[var(--ef-text-2)]">
                              {shift.volunteers.length || shift.manualNames.length
                                ? [
                                    ...shift.volunteers,
                                    ...shift.manualNames.map((name) => name + " (Avulso)"),
                                  ].join(", ")
                                : "Aguardando escala"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
