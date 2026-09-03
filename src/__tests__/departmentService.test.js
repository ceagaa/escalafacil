import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockSingle = vi.fn();

vi.mock("../services/supabase.js", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    })),
  },
}));

import { createDepartment, linkUserAsCoordinator } from "../services/departmentService";

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockReturnThis();
  mockSelect.mockReturnThis();
});

describe("departmentService", () => {
  describe("createDepartment", () => {
    it("inserts a department with generated slug", async () => {
      mockSingle.mockResolvedValue({
        data: { id: "d-1", name: "Achados e Perdidos", slug: "achados-e-perdidos" },
        error: null,
      });
      const result = await createDepartment("Achados e Perdidos");
      expect(result).toEqual({
        id: "d-1",
        name: "Achados e Perdidos",
        slug: "achados-e-perdidos",
      });
    });

    it("throws friendly message on 23505 unique constraint violation", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key value" },
      });
      await expect(createDepartment("Achados e Perdidos")).rejects.toThrow(
        "Este nome de departamento já está em uso por outra equipe"
      );
    });

    it("throws generic message on other errors", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "XX000", message: "connection refused" },
      });
      await expect(createDepartment("Teste")).rejects.toThrow("connection refused");
    });
  });

  describe("linkUserAsCoordinator", () => {
    it("inserts a department_members row with role coordenador", async () => {
      mockInsert.mockReturnValue({
        error: null,
      });
      await expect(linkUserAsCoordinator("d-1", "u-1")).resolves.not.toThrow();
      expect(mockInsert).toHaveBeenCalledWith({
        department_id: "d-1",
        user_id: "u-1",
        role: "coordenador",
      });
    });

    it("throws on insert error", async () => {
      mockInsert.mockReturnValue({
        error: { message: "foreign key violation" },
      });
      await expect(linkUserAsCoordinator("d-1", "u-1")).rejects.toThrow("foreign key violation");
    });
  });
});
