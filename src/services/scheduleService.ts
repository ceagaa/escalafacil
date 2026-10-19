import { supabase } from "./supabase";
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

export async function getScheduleBlocks(departmentId: string): Promise<DbScheduleBlock[]> {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("schedule_blocks")
    .select("*")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
  return (data ?? []) as DbScheduleBlock[];
}

export async function getShiftsByBlock(blockId: string, departmentId: string): Promise<DbShift[]> {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("block_id", blockId)
    .eq("department_id", departmentId);
  if (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
  return (data ?? []) as DbShift[];
}

export async function getAllShifts(departmentId: string): Promise<DbShift[]> {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("department_id", departmentId);
  if (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
  return (data ?? []) as DbShift[];
}

export async function getShiftVolunteers(departmentId: string): Promise<DbShiftVolunteer[]> {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("shift_volunteers")
    .select("*, shift:shifts!inner(department_id)")
    .eq("shift.department_id", departmentId);
  if (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
  return (data ?? []) as DbShiftVolunteer[];
}

export async function assignVolunteersToShift(
  shiftId: string,
  volunteerIds: string[],
  departmentId: string
): Promise<void> {
  if (!departmentId) throw new Error("departmentId is required");
  const { error: deleteError } = await supabase
    .from("shift_volunteers")
    .delete()
    .eq("shift_id", shiftId);
  if (deleteError) {
    throw new Error(sanitizeError(deleteError, "delete"));
  }

  if (volunteerIds.length === 0) return;

  const rows = volunteerIds.map((volunteerId) => ({
    shift_id: shiftId,
    volunteer_id: volunteerId,
    department_id: departmentId,
  }));

  const { error: insertError } = await supabase
    .from("shift_volunteers")
    .insert(rows);
  if (insertError) {
    throw new Error(sanitizeError(insertError, "create"));
  }
}

export async function saveShiftAssignments(
  shiftId: string,
  assignments: ShiftAssignment[],
  departmentId: string
): Promise<void> {
  if (!departmentId) throw new Error("departmentId is required");

  const { error: deleteError } = await supabase
    .from("shift_volunteers")
    .delete()
    .eq("shift_id", shiftId);
  if (deleteError) {
    throw new Error(sanitizeError(deleteError, "delete"));
  }

  if (assignments.length === 0) return;

  const rows = assignments.map((assignment) => ({
    shift_id: shiftId,
    volunteer_id: assignment.volunteer_id || null,
    manual_name: assignment.manual_name || null,
    department_id: departmentId,
  }));

  const { error: insertError } = await supabase
    .from("shift_volunteers")
    .insert(rows);
  if (insertError) {
    throw new Error(sanitizeError(insertError, "create"));
  }
}

export async function createShift(
  departmentId: string,
  blockId: string,
  payload: { start_time: string; end_time: string; description?: string; vagas?: number }
): Promise<DbShift> {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("shifts")
    .insert([
      {
        id: makeId("shift"),
        block_id: blockId,
        start_time: payload.start_time,
        end_time: payload.end_time,
        description: payload.description || "",
        vagas: payload.vagas || 0,
        department_id: departmentId,
      },
    ])
    .select()
    .single();
  if (error) {
    throw new Error(sanitizeError(error, "create"));
  }
  return data as DbShift;
}

export async function updateShift(
  departmentId: string,
  shiftId: string,
  payload: { start_time: string; end_time: string; description?: string; vagas?: number }
): Promise<DbShift> {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("shifts")
    .update({
      start_time: payload.start_time,
      end_time: payload.end_time,
      description: payload.description || "",
      vagas: payload.vagas || 0,
    })
    .eq("id", shiftId)
    .eq("department_id", departmentId)
    .select()
    .single();
  if (error) {
    throw new Error(sanitizeError(error, "update"));
  }
  return data as DbShift;
}

export async function deleteShift(departmentId: string, shiftId: string): Promise<void> {
  if (!departmentId) throw new Error("departmentId is required");
  const { error } = await supabase
    .from("shifts")
    .delete()
    .eq("id", shiftId)
    .eq("department_id", departmentId);
  if (error) {
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
