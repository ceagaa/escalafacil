import { supabase } from "./supabase";
import { sanitizeError } from "../utils/errors";
import type { Volunteer } from "../types";

export async function getVolunteers(departmentId: string): Promise<Volunteer[]> {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("volunteers")
    .select("*")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
  return data as Volunteer[];
}


export async function createVolunteer(departmentId: string, data: Record<string, unknown>): Promise<Volunteer> {
  if (!departmentId) throw new Error("departmentId is required");
  const payload = { ...data, department_id: departmentId };
  const { data: inserted, error } = await supabase
    .from("volunteers")
    .insert([payload])
    .select();
  if (error) {
    throw new Error(sanitizeError(error, "create"));
  }
  return (inserted as Volunteer[])[0];
}

export async function updateVolunteer(
  id: string,
  departmentId: string,
  data: Record<string, unknown>
): Promise<Volunteer> {
  if (!departmentId) throw new Error("departmentId is required");
  const { data: updated, error } = await supabase
    .from("volunteers")
    .update(data)
    .eq("id", id)
    .eq("department_id", departmentId)
    .select()
    .single();
  if (error) {
    throw new Error(sanitizeError(error, "update"));
  }
  return updated as Volunteer;
}

export async function deleteVolunteer(id: string, departmentId: string): Promise<void> {
  if (!departmentId) throw new Error("departmentId is required");
  const { error } = await supabase
    .from("volunteers")
    .delete()
    .eq("id", id)
    .eq("department_id", departmentId);
  if (error) {
    throw new Error(sanitizeError(error, "delete"));
  }
}
