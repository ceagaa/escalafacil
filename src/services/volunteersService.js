import { supabase } from "./supabase.js";
import { sanitizeError } from "../utils/errors.js";

export async function getVolunteers(departmentId) {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("volunteers")
    .select("*")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
  return data;
}

export async function getVolunteer(id, departmentId) {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("volunteers")
    .select("*")
    .eq("id", id)
    .eq("department_id", departmentId)
    .single();
  if (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
  return data;
}

export async function createVolunteer(departmentId, data) {
  if (!departmentId) throw new Error("departmentId is required");
  const payload = { ...data, department_id: departmentId };
  const { data: inserted, error } = await supabase
    .from("volunteers")
    .insert([payload])
    .select();
  if (error) {
    throw new Error(sanitizeError(error, "create"));
  }
  return inserted[0];
}

export async function updateVolunteer(id, departmentId, data) {
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
  return updated;
}

export async function deleteVolunteer(id, departmentId) {
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
