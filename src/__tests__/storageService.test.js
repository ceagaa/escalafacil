import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/supabase.js", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/image.jpg" } })),
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

import { uploadImage, deleteImage, getPublicUrl } from "../services/storageService";

describe("uploadImage", () => {
  it("throws when called without a file", async () => {
    await expect(uploadImage(null)).rejects.toThrow("uploadImage called without a file");
    await expect(uploadImage(undefined)).rejects.toThrow("uploadImage called without a file");
  });

  it("returns a public URL on success", async () => {
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const url = await uploadImage(file);
    expect(url).toBe("https://example.com/image.jpg");
  });
});

describe("deleteImage", () => {
  it("throws when called without a path", async () => {
    await expect(deleteImage(null)).rejects.toThrow("deleteImage called without a path");
    await expect(deleteImage("")).rejects.toThrow("deleteImage called without a path");
  });
});

describe("getPublicUrl", () => {
  it("returns a public URL string", () => {
    const url = getPublicUrl("test.jpg");
    expect(url).toBe("https://example.com/image.jpg");
  });
});
