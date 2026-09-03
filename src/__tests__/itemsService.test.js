import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockSingle = vi.fn();
const mockInsert = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockDelete = vi.fn().mockReturnThis();

vi.mock("../services/supabase.js", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    })),
  },
}));

vi.mock("../services/storageService.js", () => ({
  uploadImage: vi.fn().mockResolvedValue("https://example.com/uploaded.jpg"),
  deleteImage: vi.fn().mockResolvedValue(),
}));

import {
  getLostItems,
  getLostItem,
  createLostItem,
  updateLostItem,
  deleteLostItem,
  updateLostItemStatus,
} from "../services/itemsService";

const DEPT_ID = "dept-test-1";

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnThis();
  mockEq.mockReturnThis();
  mockOrder.mockReturnThis();
  mockInsert.mockReturnThis();
  mockUpdate.mockReturnThis();
  mockDelete.mockReturnThis();
});

describe("itemsService", () => {
  describe("getLostItems", () => {
    it("throws when departmentId is missing", async () => {
      await expect(getLostItems()).rejects.toThrow("departmentId is required");
      await expect(getLostItems(null)).rejects.toThrow("departmentId is required");
      await expect(getLostItems("")).rejects.toThrow("departmentId is required");
    });

    it("queries lost_items filtered by department_id", async () => {
      mockOrder.mockResolvedValue({ data: [{ id: "1" }], error: null });
      const result = await getLostItems(DEPT_ID);
      expect(result).toEqual([{ id: "1" }]);
    });
  });

  describe("getLostItem", () => {
    it("throws when departmentId is missing", async () => {
      await expect(getLostItem("id-1")).rejects.toThrow("departmentId is required");
    });

    it("fetches a single item by id and department", async () => {
      mockSingle.mockResolvedValue({ data: { id: "1" }, error: null });
      const result = await getLostItem("1", DEPT_ID);
      expect(result).toEqual({ id: "1" });
    });
  });

  describe("createLostItem", () => {
    it("throws when departmentId is missing", async () => {
      await expect(createLostItem(null, { item: "Test" })).rejects.toThrow("departmentId is required");
    });

    it("inserts a new item with department_id", async () => {
      mockInsert.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: "new-1" }], error: null }) });
      const result = await createLostItem(DEPT_ID, { item: "Chave" });
      expect(result).toEqual({ id: "new-1" });
    });
  });

  describe("updateLostItem", () => {
    it("throws when departmentId is missing", async () => {
      await expect(updateLostItem("id-1", null, { item: "X" })).rejects.toThrow("departmentId is required");
    });

    it("updates an existing item", async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "1", item: "Updated" }, error: null }),
            }),
          }),
        }),
      });
      const result = await updateLostItem("1", DEPT_ID, { item: "Updated" });
      expect(result).toEqual({ id: "1", item: "Updated" });
    });
  });

  describe("deleteLostItem", () => {
    it("throws when departmentId is missing", async () => {
      await expect(deleteLostItem("id-1", null)).rejects.toThrow("departmentId is required");
    });

    it("deletes an item by id and department", async () => {
      mockDelete.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      await expect(deleteLostItem("1", DEPT_ID)).resolves.not.toThrow();
    });
  });

  describe("updateLostItemStatus", () => {
    it("throws when departmentId is missing", async () => {
      await expect(updateLostItemStatus("id-1", null, "Entregue")).rejects.toThrow("departmentId is required");
    });

    it("updates status of an item", async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "1", status: "Entregue" }, error: null }),
            }),
          }),
        }),
      });
      const result = await updateLostItemStatus("1", DEPT_ID, "Entregue");
      expect(result).toEqual({ id: "1", status: "Entregue" });
    });
  });
});
