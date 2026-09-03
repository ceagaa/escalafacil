import { supabase } from "./supabase.js";
import { getVolunteers } from "./volunteersService.js";
import { getLostItems } from "./itemsService.js";

export async function getScheduleBlocks(departmentId) {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("schedule_blocks")
    .select("*")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to fetch schedule blocks: ${error.message}`);
  }
  return data;
}

export async function getShiftsByBlock(blockId, departmentId) {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("block_id", blockId)
    .eq("department_id", departmentId);
  if (error) {
    throw new Error(`Failed to fetch shifts for block ${blockId}: ${error.message}`);
  }
  return data;
}

export async function getAllShifts(departmentId) {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("department_id", departmentId);
  if (error) {
    throw new Error(`Failed to fetch shifts: ${error.message}`);
  }
  return data;
}

export async function getShiftVolunteers(departmentId) {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("shift_volunteers")
    .select("*, shift:shifts!inner(department_id)")
    .eq("shift.department_id", departmentId);
  if (error) {
    throw new Error(`Failed to fetch shift volunteers: ${error.message}`);
  }
  return data;
}

export async function assignVolunteersToShift(shiftId, volunteerIds, departmentId) {
  if (!departmentId) throw new Error("departmentId is required");
  const { error: deleteError } = await supabase
    .from("shift_volunteers")
    .delete()
    .eq("shift_id", shiftId);
  if (deleteError) {
    throw new Error(`Failed to clear shift volunteers: ${deleteError.message}`);
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
    throw new Error(`Failed to assign volunteers to shift: ${insertError.message}`);
  }
}

export async function seedScheduleForDepartment(departmentId, initialSchedule) {
  if (!departmentId) throw new Error("departmentId is required");

  const { data: existingBlocks } = await supabase
    .from("schedule_blocks")
    .select("id")
    .eq("department_id", departmentId);

  const shouldSeed = !Array.isArray(existingBlocks) || existingBlocks.length < 6;
  if (!shouldSeed) return;

  const blocks = initialSchedule.map((block) => ({
    id: block.id,
    day: block.day,
    period: block.period,
    responsible: block.responsible,
    accent: block.accent,
    department_id: departmentId,
  }));

  const shifts = initialSchedule.flatMap((block) =>
    block.shifts.map((shift) => ({
      id: shift.id,
      block_id: block.id,
      start_time: shift.start,
      end_time: shift.end,
      department_id: departmentId,
    }))
  );

  if (blocks.length > 0) {
    await supabase
      .from("schedule_blocks")
      .upsert(blocks, { onConflict: "id" });
  }

  if (shifts.length > 0) {
    await supabase
      .from("shifts")
      .upsert(shifts, { onConflict: "id" });
  }
}

export async function fetchDepartmentData(departmentId, initialSchedule, initialVolunteers, initialItems, mapDbItemToApp) {
  if (!departmentId) throw new Error("departmentId is required");

  await seedScheduleForDepartment(departmentId, initialSchedule);

  const [blocks, shifts, assigned, volunteers, lostItems] = await Promise.all([
    getScheduleBlocks(departmentId),
    getAllShifts(departmentId),
    getShiftVolunteers(departmentId),
    getVolunteers(departmentId),
    getLostItems(departmentId),
  ]);

  const groupedSchedule = (blocks || []).map((block) => ({
    id: block.id,
    day: block.day,
    period: block.period,
    responsible: block.responsible,
    accent: block.accent,
    shifts: (shifts || [])
      .filter((shift) => shift.block_id === block.id)
      .map((shift) => ({
        id: shift.id,
        start: shift.start_time,
        end: shift.end_time,
        volunteerIds: (assigned || [])
          .filter((item) => item.shift_id === shift.id)
          .map((item) => item.volunteer_id),
      })),
  }));

  const EXCLUDED_NAMES = ["Durval", "Flavio", "João Passos"];

  return {
    schedule: groupedSchedule,
    volunteers: Array.isArray(volunteers)
      ? volunteers.filter((v) => !EXCLUDED_NAMES.includes(v.name))
      : initialVolunteers,
    items: Array.isArray(lostItems) ? lostItems.map(mapDbItemToApp) : initialItems,
  };
}
