import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockSingle = vi.fn();
const mockInsert = vi.fn().mockReturnThis();
const mockDelete = vi.fn().mockReturnThis();
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
      supabase.from = mockFrom;

      await seedScheduleForDepartment(DEPT_ID, [{ id: "test", shifts: [] }]);

      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });
});
