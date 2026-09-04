import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockSingle = vi.fn();
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockIlike = vi.fn().mockReturnThis();
const mockMaybeSingle = vi.fn();
const mockDelete = vi.fn().mockReturnThis();

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("../services/supabase.js", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
      update: mockUpdate,
      eq: mockEq,
      ilike: mockIlike,
      maybeSingle: mockMaybeSingle,
      delete: mockDelete,
    })),
    rpc: mockRpc,
  },
}));

import {
  createDepartment,
  linkUserAsCoordinator,
  updateDepartmentFeatures,
  findProfileByEmail,
  addDepartmentMember,
  listDepartmentMembers,
  removeDepartmentMember,
  getDepartmentOwnerBySlug,
  getDepartmentOwner,
  getDashboardStats,
  getDepartmentOwnerBySlugRpc,
  STANDARD_DEPARTMENTS,
} from "../services/departmentService";

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockReturnThis();
  mockSelect.mockReturnThis();
  mockUpdate.mockReturnThis();
  mockEq.mockReturnThis();
  mockIlike.mockReturnThis();
  mockDelete.mockReturnThis();
});

describe("departmentService", () => {
  describe("STANDARD_DEPARTMENTS", () => {
    it("contains exactly the 3 standard departments", () => {
      expect(STANDARD_DEPARTMENTS).toEqual([
        { name: "Achados Perdidos e Guarda Volumes", slug: "achados-perdidos-guarda-volumes" },
        { name: "Indicadores", slug: "indicadores" },
        { name: "Limpeza", slug: "limpeza" },
      ]);
    });
  });

  describe("createDepartment", () => {
    it("inserts a department with the provided slug", async () => {
      mockSingle.mockResolvedValue({
        data: { id: "d-1", name: "Achados Perdidos e Guarda Volumes", slug: "achados-perdidos-guarda-volumes" },
        error: null,
      });
      const result = await createDepartment(
        "Achados Perdidos e Guarda Volumes",
        "achados-perdidos-guarda-volumes"
      );
      expect(result).toEqual({
        id: "d-1",
        name: "Achados Perdidos e Guarda Volumes",
        slug: "achados-perdidos-guarda-volumes",
      });
      expect(mockInsert).toHaveBeenCalledWith({
        name: "Achados Perdidos e Guarda Volumes",
        slug: "achados-perdidos-guarda-volumes",
      });
    });

    it("generates slug from name when slug is not provided", async () => {
      mockSingle.mockResolvedValue({
        data: { id: "d-1", name: "Indicadores", slug: "indicadores" },
        error: null,
      });
      const result = await createDepartment("Indicadores");
      expect(result).toEqual({ id: "d-1", name: "Indicadores", slug: "indicadores" });
    });

    it("throws message with owner name on 23505 unique constraint violation", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key value" },
      });
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: "d-1" }, error: null })
        .mockResolvedValueOnce({
          data: { role: "coordenador", profiles: { name: "Carlos Henrique" } },
          error: null,
        });
      await expect(
        createDepartment("Achados Perdidos e Guarda Volumes", "achados-perdidos-guarda-volumes")
      ).rejects.toThrow("Departamento já criado. Responsável: Carlos Henrique");
    });

    it("falls back to generic message on 23505 when department lookup fails", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key value" },
      });
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      await expect(
        createDepartment("Limpeza", "limpeza")
      ).rejects.toThrow("Este nome de departamento já está em uso por outra equipe");
    });

    it("returns existing department on 23505 when it has no coordinator (orphan claim)", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key value" },
      });
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: "d-1", name: "Limpeza", slug: "limpeza" }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });
      const result = await createDepartment("Limpeza", "limpeza");
      expect(result).toEqual({ id: "d-1", name: "Limpeza", slug: "limpeza" });
    });

    it("throws generic message on other errors", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "XX000", message: "connection refused" },
      });
      await expect(createDepartment("Teste", "teste")).rejects.toThrow("connection refused");
    });
  });

  describe("getDepartmentOwnerBySlug", () => {
    it("returns the coordinator profile name", async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: "d-1" }, error: null })
        .mockResolvedValueOnce({
          data: { role: "coordenador", profiles: { name: "Ana Souza" } },
          error: null,
        });
      const owner = await getDepartmentOwnerBySlug("indicadores");
      expect(owner).toBe("Ana Souza");
    });

    it("returns null when department does not exist", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const owner = await getDepartmentOwnerBySlug("nao-existe");
      expect(owner).toBeNull();
    });

    it("returns null when no coordinator member found", async () => {
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: "d-1" }, error: null })
        .mockResolvedValueOnce({ data: null, error: null });
      const owner = await getDepartmentOwnerBySlug("limpeza");
      expect(owner).toBeNull();
    });
  });

  describe("getDashboardStats", () => {
    it("returns stats from the RPC", async () => {
      mockRpc.mockResolvedValue({
        data: {
          total_departments: 3,
          total_volunteers: 12,
          total_coordinators: 2,
          top_department: "Indicadores",
        },
        error: null,
      });
      const stats = await getDashboardStats();
      expect(stats).toEqual({
        total_departments: 3,
        total_volunteers: 12,
        total_coordinators: 2,
        top_department: "Indicadores",
      });
      expect(mockRpc).toHaveBeenCalledWith("get_dashboard_stats");
    });

    it("throws when RPC fails", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "rpc error" } });
      await expect(getDashboardStats()).rejects.toThrow("rpc error");
    });
  });

  describe("getDepartmentOwnerBySlugRpc", () => {
    it("returns the owner name", async () => {
      mockRpc.mockResolvedValue({ data: "Carlos Henrique", error: null });
      const owner = await getDepartmentOwnerBySlugRpc("indicadores");
      expect(owner).toBe("Carlos Henrique");
      expect(mockRpc).toHaveBeenCalledWith("get_department_owner_by_slug", {
        p_slug: "indicadores",
      });
    });

    it("returns null when RPC fails or returns null", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "boom" } });
      expect(await getDepartmentOwnerBySlugRpc("limpeza")).toBeNull();
      mockRpc.mockResolvedValue({ data: null, error: null });
      expect(await getDepartmentOwnerBySlugRpc("limpeza")).toBeNull();
    });
  });

  describe("getDepartmentOwner", () => {
    it("returns the coordinator profile name by department id", async () => {
      mockMaybeSingle.mockResolvedValueOnce({
        data: { role: "coordenador", profiles: { name: "João Passos" } },
        error: null,
      });
      const owner = await getDepartmentOwner("d-1");
      expect(owner).toBe("João Passos");
    });

    it("returns null when no coordinator found", async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const owner = await getDepartmentOwner("d-1");
      expect(owner).toBeNull();
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

  describe("updateDepartmentFeatures", () => {
    it("updates the features column", async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "d-1", features: { lostItems: false } },
              error: null,
            }),
          }),
        }),
      });
      const result = await updateDepartmentFeatures("d-1", { lostItems: false });
      expect(result).toEqual({ id: "d-1", features: { lostItems: false } });
    });

    it("throws on update error", async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "rls violation" } }),
          }),
        }),
      });
      await expect(updateDepartmentFeatures("d-1", { lostItems: false })).rejects.toThrow("rls violation");
    });
  });

  describe("findProfileByEmail", () => {
    it("returns the matched profile", async () => {
      mockMaybeSingle.mockResolvedValue({ data: { id: "u-2", email: "a@b.com" }, error: null });
      const result = await findProfileByEmail("a@b.com");
      expect(result).toEqual({ id: "u-2", email: "a@b.com" });
    });

    it("returns null when no profile matches", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await findProfileByEmail("nobody@x.com");
      expect(result).toBeNull();
    });
  });

  describe("addDepartmentMember", () => {
    it("inserts a member with assistant role by default", async () => {
      mockInsert.mockReturnValue({ error: null });
      await expect(addDepartmentMember("d-1", "u-2")).resolves.not.toThrow();
      expect(mockInsert).toHaveBeenCalledWith({
        department_id: "d-1",
        user_id: "u-2",
        role: "assistente",
      });
    });

    it("throws friendly message on duplicate membership", async () => {
      mockInsert.mockReturnValue({ error: { code: "23505", message: "dup" } });
      await expect(addDepartmentMember("d-1", "u-2")).rejects.toThrow(
        "Este usuário já faz parte do departamento."
      );
    });
  });

  describe("listDepartmentMembers", () => {
    it("lists members with profile emails", async () => {
      mockEq.mockResolvedValue({
        data: [{ id: "dm-1", role: "coordenador", profiles: { email: "c@x.com" } }],
        error: null,
      });
      const result = await listDepartmentMembers("d-1");
      expect(result).toEqual([{ id: "dm-1", role: "coordenador", profiles: { email: "c@x.com" } }]);
    });

    it("returns empty array on error", async () => {
      mockEq.mockResolvedValue({ data: null, error: { message: "boom" } });
      await expect(listDepartmentMembers("d-1")).rejects.toThrow("boom");
    });
  });

  describe("removeDepartmentMember", () => {
    it("deletes a membership row", async () => {
      mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      await expect(removeDepartmentMember("dm-2")).resolves.not.toThrow();
    });

    it("throws on delete error", async () => {
      mockDelete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: { message: "boom" } }) });
      await expect(removeDepartmentMember("dm-2")).rejects.toThrow("boom");
    });
  });
});
