import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "./api";
import { getVolunteers } from "./volunteersService";
import { makeId } from "../utils/helpers";
import { sanitizeError } from "../utils/errors";
import type { ScheduleBlock, ShiftAssignment, Volunteer } from "../types";

interface DbScheduleBlock {
  id: string;
  day: string;
  period: string;
  responsible?: string | null;
  accent?: string | null;
}

interface DbShift {
  id: string;
  block_id: string;
  start_time: string;
  end_time: string;
  description?: string | null;
  vagas?: number | null;
  department_id?: string | null;
}

interface DbShiftVolunteer {
  shift_id: string;
  volunteer_id?: string | null;
  manual_name?: string | null;
}

const dept = (departmentId: string): string => {
  if (!departmentId) throw new Error("departmentId is required");
  return `/api/departments/${encodeURIComponent(departmentId)}`;
};

const BLOCK_PERIODS = ["Manhã", "Tarde"] as const;
const CONGRESSO_BLOCK_DAYS = ["Sexta-feira", "Sábado", "Domingo"] as const;
const BLOCK_ACCENT_BY_DAY: Record<string, string> = {
  "Sexta-feira": "sexta",
  "Sábado": "sabado",
  "Domingo": "domingo",
};

/** Ordem de exibição dos dias (o que não estiver na lista vai depois). */
const DAY_DISPLAY_ORDER = ["Sexta-feira", "Sábado", "Domingo", "Dia do Evento"];
/** Ordem de exibição dos períodos dentro de um dia. */
const PERIOD_DISPLAY_ORDER = ["Manhã", "Tarde", "Noite"];

/**
 * Ordena os blocos para exibição: dia na ordem canônica e, dentro do dia,
 * período (Manhã → Tarde → Noite). O GET do Worker devolve `created_at DESC`,
 * então sem isso "Tarde" poderia aparecer antes de "Manhã".
 */
export function sortBlocksForDisplay(blocks: DbScheduleBlock[]): DbScheduleBlock[] {
  const dayRank = (day: string): number => {
    const i = DAY_DISPLAY_ORDER.indexOf(day);
    return i === -1 ? DAY_DISPLAY_ORDER.length : i;
  };
  const periodRank = (period: string): number => {
    const i = PERIOD_DISPLAY_ORDER.indexOf(period);
    return i === -1 ? PERIOD_DISPLAY_ORDER.length : i;
  };
  return [...blocks].sort((a, b) => {
    const byDay = dayRank(a.day) - dayRank(b.day);
    if (byDay !== 0) return byDay;
    return periodRank(a.period) - periodRank(b.period);
  });
}

export interface DefaultBlockSpec {
  id: string;
  day: string;
  period: string;
  accent: string | null;
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Blocos padrão (Manhã/Tarde) do departamento, conforme o tipo de evento:
 * congresso regional → Sexta/Sábado/Domingo; demais → "Dia do Evento".
 * Os IDs são determinísticos por departamento, então recriar é idempotente.
 */
export function defaultBlockSpecs(
  departmentId: string,
  eventoTipo?: string | null
): DefaultBlockSpec[] {
  const days = eventoTipo === "congresso_regional" ? CONGRESSO_BLOCK_DAYS : ["Dia do Evento"];
  return days.flatMap((day) =>
    BLOCK_PERIODS.map((period) => ({
      id: `blk-${departmentId}-${slug(day)}-${slug(period)}`,
      day,
      period,
      accent: BLOCK_ACCENT_BY_DAY[day] ?? null,
    }))
  );
}

/**
 * Garante que o departamento tenha períodos (Manhã/Tarde).
 * Se já existir bloco, devolve os existentes sem criar nada.
 */
export async function ensureDefaultBlocks(
  departmentId: string,
  eventoTipo?: string | null,
  existing?: DbScheduleBlock[]
): Promise<DbScheduleBlock[]> {
  const current = existing ?? (await getScheduleBlocks(departmentId));
  if (current.length > 0) return current;

  const specs = defaultBlockSpecs(departmentId, eventoTipo);
  // allSettled: se uma criação falhar (ex.: outra aba criou antes), segue em frente.
  await Promise.allSettled(
    specs.map((spec) => apiPost(`${dept(departmentId)}/blocks`, spec))
  );
  // Releitura final — devolve o que existir (criado aqui ou por concorrência).
  return getScheduleBlocks(departmentId);
}

export async function getScheduleBlocks(departmentId: string): Promise<DbScheduleBlock[]> {
  const base = dept(departmentId);
  try {
    const data = await apiGet<DbScheduleBlock[]>(`${base}/blocks`);
    return data ?? [];
  } catch (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
}

export async function getShiftsByBlock(blockId: string, departmentId: string): Promise<DbShift[]> {
  const base = dept(departmentId);
  try {
    const data = await apiGet<DbShift[]>(
      `${base}/shifts?block_id=${encodeURIComponent(blockId)}`
    );
    return data ?? [];
  } catch (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
}

export async function getAllShifts(departmentId: string): Promise<DbShift[]> {
  const base = dept(departmentId);
  try {
    const data = await apiGet<DbShift[]>(`${base}/shifts`);
    return data ?? [];
  } catch (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
}

export async function getShiftVolunteers(departmentId: string): Promise<DbShiftVolunteer[]> {
  const base = dept(departmentId);
  try {
    const data = await apiGet<DbShiftVolunteer[]>(`${base}/assignments`);
    return data ?? [];
  } catch (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
}

export async function assignVolunteersToShift(
  shiftId: string,
  volunteerIds: string[],
  departmentId: string
): Promise<void> {
  dept(departmentId); // valida a entrada (assinatura mantida por compatibilidade)
  try {
    // PUT substitui todas as alocações do turno (delete + insert no Worker).
    await apiPut(`/api/shifts/${encodeURIComponent(shiftId)}/assignments`, {
      volunteer_ids: volunteerIds,
    });
  } catch (error) {
    throw new Error(sanitizeError(error, volunteerIds.length > 0 ? "create" : "delete"));
  }
}

export async function saveShiftAssignments(
  shiftId: string,
  assignments: ShiftAssignment[],
  departmentId: string
): Promise<void> {
  dept(departmentId);
  try {
    await apiPut(`/api/shifts/${encodeURIComponent(shiftId)}/assignments`, {
      assignments: assignments.map((assignment) => ({
        volunteer_id: assignment.volunteer_id || null,
        manual_name: assignment.manual_name || null,
      })),
    });
  } catch (error) {
    throw new Error(sanitizeError(error, assignments.length > 0 ? "create" : "delete"));
  }
}

export async function createShift(
  departmentId: string,
  blockId: string,
  payload: { start_time: string; end_time: string; description?: string; vagas?: number }
): Promise<DbShift> {
  const base = dept(departmentId);
  try {
    return await apiPost<DbShift>(`${base}/shifts`, {
      id: makeId("shift"),
      block_id: blockId,
      start_time: payload.start_time,
      end_time: payload.end_time,
      description: payload.description || "",
      vagas: payload.vagas || 0,
    });
  } catch (error) {
    throw new Error(sanitizeError(error, "create"));
  }
}

export async function updateShift(
  departmentId: string,
  shiftId: string,
  payload: { start_time: string; end_time: string; description?: string; vagas?: number }
): Promise<DbShift> {
  dept(departmentId);
  try {
    return await apiPatch<DbShift>(`/api/shifts/${encodeURIComponent(shiftId)}`, {
      start_time: payload.start_time,
      end_time: payload.end_time,
      description: payload.description || "",
      vagas: payload.vagas || 0,
    });
  } catch (error) {
    throw new Error(sanitizeError(error, "update"));
  }
}

export async function deleteShift(departmentId: string, shiftId: string): Promise<void> {
  dept(departmentId);
  try {
    await apiDelete(`/api/shifts/${encodeURIComponent(shiftId)}`);
  } catch (error) {
    throw new Error(sanitizeError(error, "delete"));
  }
}

export async function fetchDepartmentData(
  departmentId: string,
  initialVolunteers: Volunteer[],
  eventoTipo?: string | null
): Promise<{ schedule: ScheduleBlock[]; volunteers: Volunteer[] }> {
  if (!departmentId) throw new Error("departmentId is required");

  const [blocks, shifts, assigned, volunteers] = await Promise.all([
    getScheduleBlocks(departmentId),
    getAllShifts(departmentId),
    getShiftVolunteers(departmentId),
    getVolunteers(departmentId),
  ]);

  // Departamento sem nenhum período (ex.: recém-criado): cria Manhã/Tarde padrão.
  const finalBlocks =
    blocks && blocks.length > 0
      ? blocks
      : await ensureDefaultBlocks(departmentId, eventoTipo, []);

  const groupedSchedule: ScheduleBlock[] = sortBlocksForDisplay(finalBlocks || []).map((block) => ({
    id: block.id,
    day: block.day,
    period: block.period,
    responsible: block.responsible ?? undefined,
    accent: block.accent ?? undefined,
    shifts: (shifts || [])
      .filter((shift) => shift.block_id === block.id)
      .map((shift) => ({
        id: shift.id,
        start: shift.start_time,
        end: shift.end_time,
        description: shift.description || "",
        volunteerIds: (assigned || [])
          .filter((item) => item.shift_id === shift.id && item.volunteer_id)
          .map((item) => String(item.volunteer_id)),
        manualNames: (assigned || [])
          .filter((item) => item.shift_id === shift.id && item.manual_name)
          .map((item) => String(item.manual_name)),
      })),
  }));

  const EXCLUDED_NAMES = ["Durval", "Flavio", "João Passos"];

  return {
    schedule: groupedSchedule,
    volunteers: Array.isArray(volunteers)
      ? volunteers.filter((v) => !EXCLUDED_NAMES.includes(v.name))
      : initialVolunteers,
  };
}
