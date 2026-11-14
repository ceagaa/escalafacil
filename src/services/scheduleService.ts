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
  initialVolunteers: Volunteer[]
): Promise<{ schedule: ScheduleBlock[]; volunteers: Volunteer[] }> {
  if (!departmentId) throw new Error("departmentId is required");

  const [blocks, shifts, assigned, volunteers] = await Promise.all([
    getScheduleBlocks(departmentId),
    getAllShifts(departmentId),
    getShiftVolunteers(departmentId),
    getVolunteers(departmentId),
  ]);

  const groupedSchedule: ScheduleBlock[] = (blocks || []).map((block) => ({
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
