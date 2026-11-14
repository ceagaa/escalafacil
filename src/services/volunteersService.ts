import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import { sanitizeError } from "../utils/errors";
import type { Volunteer } from "../types";

export async function getVolunteers(departmentId: string): Promise<Volunteer[]> {
  if (!departmentId) throw new Error("departmentId is required");
  try {
    return await apiGet<Volunteer[]>(
      `/api/departments/${encodeURIComponent(departmentId)}/volunteers`
    );
  } catch (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
}

export async function createVolunteer(
  departmentId: string,
  data: Record<string, unknown>
): Promise<Volunteer> {
  if (!departmentId) throw new Error("departmentId is required");
  try {
    return await apiPost<Volunteer>(
      `/api/departments/${encodeURIComponent(departmentId)}/volunteers`,
      data
    );
  } catch (error) {
    throw new Error(sanitizeError(error, "create"));
  }
}

export async function updateVolunteer(
  id: string,
  departmentId: string,
  data: Record<string, unknown>
): Promise<Volunteer> {
  if (!departmentId) throw new Error("departmentId is required");
  try {
    return await apiPatch<Volunteer>(`/api/volunteers/${encodeURIComponent(id)}`, data);
  } catch (error) {
    throw new Error(sanitizeError(error, "update"));
  }
}

export async function deleteVolunteer(id: string, departmentId: string): Promise<void> {
  if (!departmentId) throw new Error("departmentId is required");
  try {
    await apiDelete(`/api/volunteers/${encodeURIComponent(id)}`);
  } catch (error) {
    throw new Error(sanitizeError(error, "delete"));
  }
}
