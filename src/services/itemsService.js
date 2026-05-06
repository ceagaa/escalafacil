// src/services/itemsService.js
/**
 * Service for CRUD operations on `items` table.
 * All functions use the shared Supabase client and return plain JS objects.
 */

import { supabase } from "./supabase.js";
import { uploadImage, deleteImage } from "./storageService.js";

/**
 * Fetch all items ordered by newest first.
 * @returns {Promise<Array<any>>} Array of item objects.
 */
export async function getItems() {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to fetch items: ${error.message}`);
  }
  return data;
}

/**
 * Fetch a single item by UUID.
 * @param {string} id - Item UUID.
 * @returns {Promise<any>} The item object.
 */
export async function getItem(id) {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .eq("id", id)
    .single();
  if (error) {
    throw new Error(`Failed to fetch item ${id}: ${error.message}`);
  }
  return data;
}

/**
 * Create a new item. If `data.imageFile` is provided, upload it first.
 * The uploaded image URL is stored in `image_url`.
 * @param {object} data - Item fields. May include `imageFile` (File).
 * @returns {Promise<any>} The created item.
 */
export async function createItem(data) {
  // Handle optional image upload
  if (data.imageFile) {
    const publicUrl = await uploadImage(data.imageFile);
    data.image_url = publicUrl;
    delete data.imageFile; // remove raw file before DB insert
  }

  const { data: inserted, error } = await supabase
    .from("items")
    .insert([data])
    .select();
  if (error) {
    throw new Error(`Failed to create item: ${error.message}`);
  }
  // insert returns an array; return the first element
  return inserted[0];
}

/**
 * Update an existing item. Supports optional new image upload.
 * If `data.imageFile` is present, the new image is uploaded, the DB record
 * updated with the new URL, and the previous image (passed as `oldImageUrl`)
 * is deleted after a successful DB update.
 * @param {string} id - UUID of the item to update.
 * @param {object} data - Fields to update. May contain `imageFile` and `oldImageUrl`.
 * @returns {Promise<any>} The updated item.
 */
export async function updateItem(id, data) {
  // If a new image is supplied, upload it first
  if (data.imageFile) {
    const publicUrl = await uploadImage(data.imageFile);
    data.image_url = publicUrl;
    delete data.imageFile;
    // Preserve the old URL for later deletion
    const oldUrl = data.oldImageUrl;
    delete data.oldImageUrl;

    const { data: updated, error } = await supabase
      .from("items")
      .update(data)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      // If DB update fails, remove the newly uploaded image to avoid orphan
      await deleteImage(publicUrl);
      throw new Error(`Failed to update item ${id}: ${error.message}`);
    }
    // Delete the previous image after success (if it existed)
    if (oldUrl) {
      // Strip the bucket URL to obtain the storage path
      const path = oldUrl.split("/").pop();
      await deleteImage(path);
    }
    return updated;
  }

  // No image handling required
  const { data: updated, error } = await supabase
    .from("items")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to update item ${id}: ${error.message}`);
  }
  return updated;
}

/**
 * Delete an item by its UUID.
 * @param {string} id - Item UUID.
 */
export async function deleteItem(id) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete item ${id}: ${error.message}`);
  }
}

