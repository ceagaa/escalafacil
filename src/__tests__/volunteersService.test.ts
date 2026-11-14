import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("../services/api", () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiPatch: mocks.apiPatch,
  apiDelete: mocks.apiDelete,
  apiPut: vi.fn(),
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

import {
  getVolunteers,
  createVolunteer,
  updateVolunteer,
  deleteVolunteer,
} from "../services/volunteersService";

const DEPT_ID = "dept-test-1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiGet.mockResolvedValue([]);
  mocks.apiPost.mockResolvedValue({});
  mocks.apiPatch.mockResolvedValue({});
  mocks.apiDelete.mockResolvedValue({});
});

describe("volunteersService", () => {
  describe("getVolunteers", () => {
    it("throws when departmentId is missing", async () => {
      await expect(getVolunteers(undefined as any)).rejects.toThrow("departmentId is required");
      await expect(getVolunteers(null as any)).rejects.toThrow("departmentId is required");
      expect(mocks.apiGet).not.toHaveBeenCalled();
    });

    it("queries volunteers filtered by department_id", async () => {
      mocks.apiGet.mockResolvedValue([{ id: "v-1", name: "Carlos" }]);
      const result = await getVolunteers(DEPT_ID);
      expect(result).toEqual([{ id: "v-1", name: "Carlos" }]);
      expect(mocks.apiGet).toHaveBeenCalledWith(`/api/departments/${DEPT_ID}/volunteers`);
    });
  });

  describe("createVolunteer", () => {
    it("throws when departmentId is missing", async () => {
      await expect(createVolunteer(null as any, { name: "Test" })).rejects.toThrow("departmentId is required");
      expect(mocks.apiPost).not.toHaveBeenCalled();
    });

    it("inserts a new volunteer with department_id", async () => {
      mocks.apiPost.mockResolvedValue({ id: "v-new" });
      const result = await createVolunteer(DEPT_ID, { name: "João" });
      expect(result).toEqual({ id: "v-new" });
      expect(mocks.apiPost).toHaveBeenCalledWith(`/api/departments/${DEPT_ID}/volunteers`, {
        name: "João",
      });
    });
  });

  describe("updateVolunteer", () => {
    it("throws when departmentId is missing", async () => {
      await expect(updateVolunteer("v-1", null as any, { name: "X" })).rejects.toThrow("departmentId is required");
      expect(mocks.apiPatch).not.toHaveBeenCalled();
    });

    it("updates an existing volunteer", async () => {
      mocks.apiPatch.mockResolvedValue({ id: "v-1", name: "Updated" });
      const result = await updateVolunteer("v-1", DEPT_ID, { name: "Updated" });
      expect(result).toEqual({ id: "v-1", name: "Updated" });
      expect(mocks.apiPatch).toHaveBeenCalledWith("/api/volunteers/v-1", { name: "Updated" });
    });
  });

  describe("deleteVolunteer", () => {
    it("throws when departmentId is missing", async () => {
      await expect(deleteVolunteer("v-1", null as any)).rejects.toThrow("departmentId is required");
      expect(mocks.apiDelete).not.toHaveBeenCalled();
    });

    it("deletes a volunteer by id and department", async () => {
      await expect(deleteVolunteer("v-1", DEPT_ID)).resolves.not.toThrow();
      expect(mocks.apiDelete).toHaveBeenCalledWith("/api/volunteers/v-1");
    });
  });
});
