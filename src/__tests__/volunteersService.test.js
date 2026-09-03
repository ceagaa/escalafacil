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

import {
  getVolunteers,
  getVolunteer,
  createVolunteer,
  updateVolunteer,
  deleteVolunteer,
} from "../services/volunteersService";

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

describe("volunteersService", () => {
  describe("getVolunteers", () => {
    it("throws when departmentId is missing", async () => {
      await expect(getVolunteers()).rejects.toThrow("departmentId is required");
      await expect(getVolunteers(null)).rejects.toThrow("departmentId is required");
    });

    it("queries volunteers filtered by department_id", async () => {
      mockOrder.mockResolvedValue({ data: [{ id: "v-1", name: "Carlos" }], error: null });
      const result = await getVolunteers(DEPT_ID);
      expect(result).toEqual([{ id: "v-1", name: "Carlos" }]);
    });
  });

  describe("getVolunteer", () => {
    it("throws when departmentId is missing", async () => {
      await expect(getVolunteer("v-1")).rejects.toThrow("departmentId is required");
    });

    it("fetches a single volunteer", async () => {
      mockSingle.mockResolvedValue({ data: { id: "v-1", name: "Carlos" }, error: null });
      const result = await getVolunteer("v-1", DEPT_ID);
      expect(result).toEqual({ id: "v-1", name: "Carlos" });
    });
  });

  describe("createVolunteer", () => {
    it("throws when departmentId is missing", async () => {
      await expect(createVolunteer(null, { name: "Test" })).rejects.toThrow("departmentId is required");
    });

    it("inserts a new volunteer with department_id", async () => {
      mockInsert.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: "v-new" }], error: null }) });
      const result = await createVolunteer(DEPT_ID, { name: "João" });
      expect(result).toEqual({ id: "v-new" });
    });
  });

  describe("updateVolunteer", () => {
    it("throws when departmentId is missing", async () => {
      await expect(updateVolunteer("v-1", null, { name: "X" })).rejects.toThrow("departmentId is required");
    });

    it("updates an existing volunteer", async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "v-1", name: "Updated" }, error: null }),
            }),
          }),
        }),
      });
      const result = await updateVolunteer("v-1", DEPT_ID, { name: "Updated" });
      expect(result).toEqual({ id: "v-1", name: "Updated" });
    });
  });

  describe("deleteVolunteer", () => {
    it("throws when departmentId is missing", async () => {
      await expect(deleteVolunteer("v-1", null)).rejects.toThrow("departmentId is required");
    });

    it("deletes a volunteer by id and department", async () => {
      mockDelete.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      await expect(deleteVolunteer("v-1", DEPT_ID)).resolves.not.toThrow();
    });
  });
});
