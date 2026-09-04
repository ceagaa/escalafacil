import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockSingle = vi.fn();
const mockInsert = vi.fn().mockReturnThis();
const mockDelete = vi.fn().mockReturnThis();
const mockUpdate = vi.fn().mockReturnThis();
const mockUpsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("../services/supabase.js", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
      insert: mockInsert,
      delete: mockDelete,
      update: mockUpdate,
      upsert: mockUpsert,
    })),
  },
}));

vi.mock("../services/volunteersService.js", () => ({
  getVolunteers: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/itemsService.js", () => ({
  getLostItems: vi.fn().mockResolvedValue([]),
}));

import {
  getScheduleBlocks,
  getAllShifts,
  getShiftVolunteers,
  assignVolunteersToShift,
  saveShiftAssignments,
  createShift,
  updateShift,
  deleteShift,
  seedScheduleForDepartment,
} from "../services/scheduleService";

const DEPT_ID = "dept-test-1";

beforeEach(() => {
  vi.clearAllMocks();
  mockSelect.mockReturnThis();
  mockEq.mockReturnThis();
  mockOrder.mockReturnThis();
  mockInsert.mockReturnThis();
  mockDelete.mockReturnThis();
  mockUpdate.mockReturnThis();
});

describe("scheduleService", () => {
  describe("getScheduleBlocks", () => {
    it("throws when departmentId is missing", async () => {
      await expect(getScheduleBlocks()).rejects.toThrow("departmentId is required");
      await expect(getScheduleBlocks(null)).rejects.toThrow("departmentId is required");
    });

    it("queries blocks filtered by department_id", async () => {
      mockOrder.mockResolvedValue({ data: [{ id: "sex-manha" }], error: null });
      const result = await getScheduleBlocks(DEPT_ID);
      expect(result).toEqual([{ id: "sex-manha" }]);
    });
  });

  describe("getAllShifts", () => {
    it("throws when departmentId is missing", async () => {
      await expect(getAllShifts()).rejects.toThrow("departmentId is required");
    });

    it("queries shifts filtered by department_id", async () => {
      mockEq.mockResolvedValue({ data: [{ id: "sex-m-1" }], error: null });
      const result = await getAllShifts(DEPT_ID);
      expect(result).toEqual([{ id: "sex-m-1" }]);
    });
  });

  describe("getShiftVolunteers", () => {
    it("throws when departmentId is missing", async () => {
      await expect(getShiftVolunteers()).rejects.toThrow("departmentId is required");
    });

    it("queries shift_volunteers with department join", async () => {
      mockEq.mockResolvedValue({ data: [{ shift_id: "s-1", volunteer_id: "v-1" }], error: null });
      const result = await getShiftVolunteers(DEPT_ID);
      expect(result).toEqual([{ shift_id: "s-1", volunteer_id: "v-1" }]);
    });
  });

  describe("assignVolunteersToShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect(assignVolunteersToShift("s-1", ["v-1"])).rejects.toThrow("departmentId is required");
    });

    it("clears and inserts volunteers for a shift", async () => {
      mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      mockInsert.mockResolvedValue({ error: null });

      await assignVolunteersToShift("s-1", ["v-1", "v-2"], DEPT_ID);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockInsert).toHaveBeenCalled();
    });

    it("clears volunteers when empty array provided", async () => {
      mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

      await assignVolunteersToShift("s-1", [], DEPT_ID);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("seedScheduleForDepartment", () => {
    it("throws when departmentId is missing", async () => {
      await expect(seedScheduleForDepartment(null, [])).rejects.toThrow("departmentId is required");
    });

    it("skips seeding when blocks already exist", async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [{ id: "existing" }], error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }));
      const { supabase } = await import("../services/supabase.js");
      const originalFrom = supabase.from;
      supabase.from = mockFrom;

      try {
        await seedScheduleForDepartment(DEPT_ID, [{ id: "test", shifts: [] }]);
      } finally {
        supabase.from = originalFrom;
      }

      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe("saveShiftAssignments", () => {
    it("throws when departmentId is missing", async () => {
      await expect(saveShiftAssignments("s-1", [], null)).rejects.toThrow(
        "departmentId is required"
      );
    });

    it("replaces assignments with volunteers and manual names", async () => {
      mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      mockInsert.mockResolvedValue({ error: null });

      await saveShiftAssignments(
        "s-1",
        [
          { volunteer_id: "v-1", manual_name: null },
          { volunteer_id: null, manual_name: "Irmão Joãozinho" },
        ],
        DEPT_ID
      );

      expect(mockInsert).toHaveBeenCalledWith([
        { shift_id: "s-1", volunteer_id: "v-1", manual_name: null, department_id: DEPT_ID },
        { shift_id: "s-1", volunteer_id: null, manual_name: "Irmão Joãozinho", department_id: DEPT_ID },
      ]);
    });

    it("does not insert when assignments are empty", async () => {
      mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

      await saveShiftAssignments("s-1", [], DEPT_ID);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });

  describe("createShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect(createShift(null, "b-1", {})).rejects.toThrow("departmentId is required");
    });

    it("inserts a shift with generated id", async () => {
      mockSingle.mockResolvedValue({
        data: { id: "shift-123", block_id: "sex-manha", start_time: "8:00", end_time: "9:30", description: "Porta" },
        error: null,
      });
      const result = await createShift(DEPT_ID, "sex-manha", {
        start_time: "8:00",
        end_time: "9:30",
        description: "Porta",
      });
      expect(result.id).toBe("shift-123");
      expect(mockInsert).toHaveBeenCalled();
      const inserted = mockInsert.mock.calls[0][0][0];
      expect(inserted.block_id).toBe("sex-manha");
      expect(inserted.start_time).toBe("8:00");
      expect(inserted.end_time).toBe("9:30");
      expect(inserted.description).toBe("Porta");
      expect(inserted.department_id).toBe(DEPT_ID);
    });
  });

  describe("updateShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect(updateShift(null, "s-1", {})).rejects.toThrow("departmentId is required");
    });

    it("updates a shift", async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "s-1", start_time: "9:00" }, error: null }),
            }),
          }),
        }),
      });
      const result = await updateShift(DEPT_ID, "s-1", {
        start_time: "9:00",
        end_time: "10:00",
        description: "Porta 2",
      });
      expect(result).toEqual({ id: "s-1", start_time: "9:00" });
    });
  });

  describe("deleteShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect(deleteShift(null, "s-1")).rejects.toThrow("departmentId is required");
    });

    it("deletes a shift", async () => {
      mockDelete.mockReturnValue({
        eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      });
      await expect(deleteShift(DEPT_ID, "s-1")).resolves.not.toThrow();
    });
  });
});
