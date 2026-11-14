import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("../services/api", () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiPatch: mocks.apiPatch,
  apiPut: mocks.apiPut,
  apiDelete: mocks.apiDelete,
  apiData: vi.fn(),
  apiRequest: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    safe: boolean;
    constructor(message: string, status = 400, code?: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.safe = status > 0 && status < 500;
    }
  },
}));

vi.mock("../services/volunteersService", () => ({
  getVolunteers: vi.fn().mockResolvedValue([]),
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
} from "../services/scheduleService";

const DEPT_ID = "dept-test-1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiGet.mockResolvedValue([]);
  mocks.apiPost.mockResolvedValue({});
  mocks.apiPatch.mockResolvedValue({});
  mocks.apiPut.mockResolvedValue(undefined);
  mocks.apiDelete.mockResolvedValue(undefined);
});

describe("scheduleService", () => {
  describe("getScheduleBlocks", () => {
    it("throws when departmentId is missing", async () => {
      await expect((getScheduleBlocks as any)()).rejects.toThrow("departmentId is required");
      await expect((getScheduleBlocks as any)(null)).rejects.toThrow("departmentId is required");
      expect(mocks.apiGet).not.toHaveBeenCalled();
    });

    it("queries blocks filtered by department_id", async () => {
      mocks.apiGet.mockResolvedValue([{ id: "sex-manha" }]);
      const result = await getScheduleBlocks(DEPT_ID);
      expect(result).toEqual([{ id: "sex-manha" }]);
      expect(mocks.apiGet).toHaveBeenCalledWith(`/api/departments/${DEPT_ID}/blocks`);
    });
  });

  describe("getAllShifts", () => {
    it("throws when departmentId is missing", async () => {
      await expect((getAllShifts as any)()).rejects.toThrow("departmentId is required");
      expect(mocks.apiGet).not.toHaveBeenCalled();
    });

    it("queries shifts filtered by department_id", async () => {
      mocks.apiGet.mockResolvedValue([{ id: "sex-m-1" }]);
      const result = await getAllShifts(DEPT_ID);
      expect(result).toEqual([{ id: "sex-m-1" }]);
      expect(mocks.apiGet).toHaveBeenCalledWith(`/api/departments/${DEPT_ID}/shifts`);
    });
  });

  describe("getShiftVolunteers", () => {
    it("throws when departmentId is missing", async () => {
      await expect((getShiftVolunteers as any)()).rejects.toThrow("departmentId is required");
      expect(mocks.apiGet).not.toHaveBeenCalled();
    });

    it("queries shift assignments for the department", async () => {
      mocks.apiGet.mockResolvedValue([{ shift_id: "s-1", volunteer_id: "v-1" }]);
      const result = await getShiftVolunteers(DEPT_ID);
      expect(result).toEqual([{ shift_id: "s-1", volunteer_id: "v-1" }]);
      expect(mocks.apiGet).toHaveBeenCalledWith(`/api/departments/${DEPT_ID}/assignments`);
    });
  });

  describe("assignVolunteersToShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect((assignVolunteersToShift as any)("s-1", ["v-1"])).rejects.toThrow(
        "departmentId is required"
      );
      expect(mocks.apiPut).not.toHaveBeenCalled();
    });

    it("replaces the shift assignments with the given volunteers", async () => {
      await assignVolunteersToShift("s-1", ["v-1", "v-2"], DEPT_ID);

      expect(mocks.apiPut).toHaveBeenCalledWith("/api/shifts/s-1/assignments", {
        volunteer_ids: ["v-1", "v-2"],
      });
    });

    it("clears volunteers when empty array provided", async () => {
      await assignVolunteersToShift("s-1", [], DEPT_ID);

      expect(mocks.apiPut).toHaveBeenCalledWith("/api/shifts/s-1/assignments", {
        volunteer_ids: [],
      });
    });
  });

  describe("saveShiftAssignments", () => {
    it("throws when departmentId is missing", async () => {
      await expect((saveShiftAssignments as any)("s-1", [], null)).rejects.toThrow(
        "departmentId is required"
      );
      expect(mocks.apiPut).not.toHaveBeenCalled();
    });

    it("replaces assignments with volunteers and manual names", async () => {
      await saveShiftAssignments(
        "s-1",
        [
          { volunteer_id: "v-1", manual_name: null },
          { volunteer_id: null, manual_name: "Irmão Joãozinho" },
        ],
        DEPT_ID
      );

      expect(mocks.apiPut).toHaveBeenCalledWith("/api/shifts/s-1/assignments", {
        assignments: [
          { volunteer_id: "v-1", manual_name: null },
          { volunteer_id: null, manual_name: "Irmão Joãozinho" },
        ],
      });
    });

    it("clears assignments when the list is empty", async () => {
      await saveShiftAssignments("s-1", [], DEPT_ID);

      expect(mocks.apiPut).toHaveBeenCalledWith("/api/shifts/s-1/assignments", {
        assignments: [],
      });
    });
  });

  describe("createShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect((createShift as any)(null, "b-1", {})).rejects.toThrow("departmentId is required");
      expect(mocks.apiPost).not.toHaveBeenCalled();
    });

    it("posts a shift with generated id", async () => {
      mocks.apiPost.mockResolvedValue({
        id: "shift-123",
        block_id: "sex-manha",
        start_time: "8:00",
        end_time: "9:30",
        description: "Porta",
      });
      const result = await createShift(DEPT_ID, "sex-manha", {
        start_time: "8:00",
        end_time: "9:30",
        description: "Porta",
      });
      expect(result.id).toBe("shift-123");
      expect(mocks.apiPost).toHaveBeenCalledWith(`/api/departments/${DEPT_ID}/shifts`, {
        id: expect.stringContaining("shift"),
        block_id: "sex-manha",
        start_time: "8:00",
        end_time: "9:30",
        description: "Porta",
        vagas: 0,
      });
    });
  });

  describe("updateShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect((updateShift as any)(null, "s-1", {})).rejects.toThrow("departmentId is required");
      expect(mocks.apiPatch).not.toHaveBeenCalled();
    });

    it("patches a shift", async () => {
      mocks.apiPatch.mockResolvedValue({ id: "s-1", start_time: "9:00" });
      const result = await updateShift(DEPT_ID, "s-1", {
        start_time: "9:00",
        end_time: "10:00",
        description: "Porta 2",
      });
      expect(result).toEqual({ id: "s-1", start_time: "9:00" });
      expect(mocks.apiPatch).toHaveBeenCalledWith("/api/shifts/s-1", {
        start_time: "9:00",
        end_time: "10:00",
        description: "Porta 2",
        vagas: 0,
      });
    });
  });

  describe("deleteShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect((deleteShift as any)(null, "s-1")).rejects.toThrow("departmentId is required");
      expect(mocks.apiDelete).not.toHaveBeenCalled();
    });

    it("deletes a shift", async () => {
      await expect(deleteShift(DEPT_ID, "s-1")).resolves.not.toThrow();
      expect(mocks.apiDelete).toHaveBeenCalledWith("/api/shifts/s-1");
    });
  });
});
