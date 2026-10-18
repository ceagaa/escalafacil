import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockSingle = vi.fn();
const mockUpdate = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockIn = vi.fn().mockReturnThis();
const mockNot = vi.fn().mockReturnThis();
const mockIlike = vi.fn().mockReturnThis();
const mockMaybeSingle = vi.fn();
const mockDelete = vi.fn().mockReturnThis();
const mockUpsert = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }));

vi.mock("../services/supabase.js", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
      update: mockUpdate,
      eq: mockEq,
      in: mockIn,
      not: mockNot,
      ilike: mockIlike,
      maybeSingle: mockMaybeSingle,
      delete: mockDelete,
      upsert: mockUpsert,
      order: mockOrder,
      limit: mockLimit,
    })),
    rpc: mockRpc,
  },
}));

import {
  createDepartment,
  linkUserAsCoordinator,
  findProfileByEmail,
  addDepartmentMember,
  listDepartmentMembers,
  removeDepartmentMember,
  getDepartmentOwner,
  getDepartmentOwnerBySlugRpc,
  createStandardDepartmentsForEvento,
  linkStandardDepartmentsToEvento,
  STANDARD_DEPARTMENTS,
} from "../services/departmentService";

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockReturnThis();
  mockSelect.mockReturnThis();
  mockUpdate.mockReturnThis();
  mockEq.mockReturnThis();
  mockIn.mockReturnThis();
  mockNot.mockReturnThis();
  mockIlike.mockReturnThis();
  mockDelete.mockReturnThis();
  mockUpsert.mockReturnThis();
  mockOrder.mockReturnThis();
  mockLimit.mockReturnThis();
  mockSingle.mockReset();
  mockMaybeSingle.mockReset();
});

describe("departmentService", () => {
  describe("STANDARD_DEPARTMENTS", () => {
    it("contains exactly the 12 standard departments", () => {
      expect(STANDARD_DEPARTMENTS).toEqual([
        { name: "Contas", slug: "contas" },
        { name: "Indicadores", slug: "indicadores" },
        { name: "Áudio e vídeo", slug: "audio-e-video" },
        { name: "Batismo", slug: "batismo" },
        { name: "Primeiros socorros", slug: "primeiros-socorros" },
        { name: "Informações e serviço voluntário", slug: "informacoes-e-servico-voluntario" },
        { name: "Achados/perdidos e guarda-volumes", slug: "achados-perdidos-e-guarda-volumes" },
        { name: "Montagem", slug: "montagem" },
        { name: "Estacionamento", slug: "estacionamento" },
        { name: "Hospedagem", slug: "hospedagem" },
        { name: "Segurança", slug: "seguranca" },
        { name: "Transporte e equipamentos", slug: "transporte-e-equipamentos" },
      ]);
      expect(STANDARD_DEPARTMENTS.length).toBe(12);
    });
  });

  describe("createDepartment", () => {
    it("inserts a department with the provided slug", async () => {
      mockSingle.mockResolvedValue({
        data: { id: "d-1", name: "Indicadores", slug: "indicadores" },
        error: null,
      });
      const result = await createDepartment(
        "Indicadores",
        "indicadores"
      );
      expect(result).toEqual({
        id: "d-1",
        name: "Indicadores",
        slug: "indicadores",
      });
      expect(mockInsert).toHaveBeenCalledWith({
        name: "Indicadores",
        slug: "indicadores",
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

    it("throws message with owner name on 23505 when eventoId provided", async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key value" },
      });
      mockMaybeSingle
        .mockResolvedValueOnce({ data: { id: "d-1" }, error: null })
        .mockResolvedValueOnce({
          data: { coordenador_id: "other", profiles: { name: "Carlos Henrique" } },
          error: null,
        });
      await expect(
        createDepartment("Indicadores", "indicadores", "ev-1")
      ).rejects.toThrow("Departamento já possui coordenador para este evento: Carlos Henrique");
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
        data: { coordenador_id: "u-1", profiles: { name: "João Passos" } },
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

  describe("createStandardDepartmentsForEvento", () => {
    it("returns empty array when no eventoId", async () => {
      const result = await createStandardDepartmentsForEvento(null);
      expect(result).toEqual([]);
    });

    it("upserts departments and links them to evento", async () => {
      const depts = [
        { id: "d-1", name: "Contas", slug: "contas" },
        { id: "d-2", name: "Indicadores", slug: "indicadores" },
      ];
      mockUpsert.mockReturnValue({
        select: vi.fn().mockReturnValue({
          then: (resolve) => resolve({ data: depts, error: null }),
        }),
      });

      const result = await createStandardDepartmentsForEvento("ev-1");
      expect(result).toEqual(depts);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: "Contas", slug: "contas" }),
          expect.objectContaining({ name: "Indicadores", slug: "indicadores" }),
        ]),
        { onConflict: "slug" }
      );
    });
  });

  describe("linkStandardDepartmentsToEvento", () => {
    it("retorna { linked: 0 } sem eventoId", async () => {
      await expect(linkStandardDepartmentsToEvento(null)).resolves.toEqual({ linked: 0 });
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("vincula somente os departamentos padrão que faltam no evento", async () => {
      mockEq.mockResolvedValue({ data: [{ department_id: "id-contas" }], error: null });
      mockIn.mockResolvedValue({
        data: [{ id: "id-contas" }, { id: "id-indicadores" }],
        error: null,
      });
      mockUpsert.mockResolvedValue({ error: null });

      const result = await linkStandardDepartmentsToEvento("ev-1");

      expect(result).toEqual({ linked: 1 });
      expect(mockUpsert).toHaveBeenCalledWith(
        [{ evento_id: "ev-1", department_id: "id-indicadores" }],
        { onConflict: "evento_id,department_id" }
      );
    });

    it("não faz upsert quando o evento já tem todos os vínculos padrão", async () => {
      mockEq.mockResolvedValue({ data: [{ department_id: "id-contas" }], error: null });
      mockIn.mockResolvedValue({ data: [{ id: "id-contas" }], error: null });

      const result = await linkStandardDepartmentsToEvento("ev-1");

      expect(result).toEqual({ linked: 0 });
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("lança erro quando a leitura dos vínculos falha", async () => {
      mockEq.mockResolvedValue({ data: null, error: { message: "rls" } });
      await expect(linkStandardDepartmentsToEvento("ev-1")).rejects.toThrow();
    });

    it("lança erro quando o vínculo (INSERT) é recusado", async () => {
      mockEq.mockResolvedValue({ data: [], error: null });
      mockIn.mockResolvedValue({ data: [{ id: "id-contas" }], error: null });
      mockUpsert.mockResolvedValue({ error: { code: "42501", message: "permission denied" } });

      await expect(linkStandardDepartmentsToEvento("ev-1")).rejects.toThrow();
    });
  });
});
