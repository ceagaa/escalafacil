import { supabase } from "./supabase.js";
import { uploadImage, deleteImage } from "./storageService.js";

export async function getLostItems(departmentId) {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("lost_items")
    .select("*")
    .eq("department_id", departmentId)
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to fetch items: ${error.message}`);
  }
  return data;
}

export async function getLostItem(id, departmentId) {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("lost_items")
    .select("*")
    .eq("id", id)
    .eq("department_id", departmentId)
    .single();
  if (error) {
    throw new Error(`Failed to fetch item ${id}: ${error.message}`);
  }
  return data;
}

export async function createLostItem(departmentId, data) {
  if (!departmentId) throw new Error("departmentId is required");
  if (data.imageFile) {
    const publicUrl = await uploadImage(data.imageFile);
    data.photo_url = publicUrl;
    delete data.imageFile;
  }

  const payload = { ...data, department_id: departmentId };
  const { data: inserted, error } = await supabase
    .from("lost_items")
    .insert([payload])
    .select();
  if (error) {
    throw new Error(`Failed to create item: ${error.message}`);
  }
  return inserted[0];
}

export async function updateLostItem(id, departmentId, data) {
  if (!departmentId) throw new Error("departmentId is required");
  if (data.imageFile) {
    const publicUrl = await uploadImage(data.imageFile);
    data.photo_url = publicUrl;
    delete data.imageFile;
    const oldUrl = data.oldPhotoUrl;
    delete data.oldPhotoUrl;

    const { data: updated, error } = await supabase
      .from("lost_items")
      .update(data)
      .eq("id", id)
      .eq("department_id", departmentId)
      .select()
      .single();
    if (error) {
      await deleteImage(publicUrl);
      throw new Error(`Failed to update item ${id}: ${error.message}`);
    }
    if (oldUrl && !oldUrl.startsWith("data:")) {
      const path = oldUrl.split("/").pop();
      await deleteImage(path);
    }
    return updated;
  }

  const { data: updated, error } = await supabase
    .from("lost_items")
    .update(data)
    .eq("id", id)
    .eq("department_id", departmentId)
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to update item ${id}: ${error.message}`);
  }
  return updated;
}

export async function deleteLostItem(id, departmentId) {
  if (!departmentId) throw new Error("departmentId is required");
  const { error } = await supabase
    .from("lost_items")
    .delete()
    .eq("id", id)
    .eq("department_id", departmentId);
  if (error) {
    throw new Error(`Failed to delete item ${id}: ${error.message}`);
  }
}

export async function updateLostItemStatus(id, departmentId, status) {
  if (!departmentId) throw new Error("departmentId is required");
  const { data, error } = await supabase
    .from("lost_items")
    .update({ status })
    .eq("id", id)
    .eq("department_id", departmentId)
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to update status for item ${id}: ${error.message}`);
  }
  return data;
}
