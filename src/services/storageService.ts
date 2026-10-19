// src/services/storageService.ts
/**
 * Supabase Storage service for handling image uploads.
 * Uses the `items-images` bucket.
 */

import { supabase } from "./supabase";

/**
 * Upload an image file to the Supabase storage bucket.
 * Generates a unique filename to avoid collisions.
 * @param file - The image file to upload (browser File object).
 * @returns Public URL of the uploaded image.
 */
export async function uploadImage(file: File): Promise<string> {
  if (!file) {
    throw new Error("uploadImage called without a file");
  }
  const bucket = "items-images";
  // Preserve file extension if present
  const ext = file.name.includes(".") ? file.name.split('.').pop() : "";
  const filename = `${crypto.randomUUID()}${ext ? `.${ext}` : ''}`;
  const { error } = await supabase.storage.from(bucket).upload(filename, file);
  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }
  // Return the public URL
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

/**
 * Delete an image from the storage bucket.
 * @param path - The storage path (filename) of the image to delete.
 */
export async function deleteImage(path: string): Promise<void> {
  if (!path) {
    throw new Error("deleteImage called without a path");
  }
  const bucket = "items-images";
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

/**
 * Get the public URL for a stored image.
 * @param path - The storage path (filename).
 * @returns Public URL.
 */
export function getPublicUrl(path: string): string {
  const bucket = "items-images";
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
