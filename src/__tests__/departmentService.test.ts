import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("../services/api", () => {
  class ApiError extends Error {
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
  }
  return {
    apiGet: mocks.apiGet,
    apiPost: mocks.apiPost,
    apiDelete: mocks.apiDelete,
    apiPatch: vi.fn(),
    apiPut: vi.fn(),
    apiData: vi.fn(),
    apiRequest: vi.fn(),
    ApiError,
  };
});

// O teste constrói erros com a MESMA classe que o service importa (instanceof).
import { ApiError } from "../services/api";
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
  mocks.apiGet.mockResolvedValue(null);
  mocks.apiPost.mockResolvedValue({});
  mocks.apiDelete.mockResolvedValue(undefined);
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
    it("posts a department with the provided slug", async () => {
      mocks.apiPost.mockResolvedValue({ id: "d-1", name: "Indicadores", slug: "indicadores" });
      const result = await createDepartment("Indicadores", "indicadores");
      expect(result).toEqual({ id: "d-1", name: "Indicadores", slug: "indicadores" });
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/departments", {
        name: "Indicadores",
        slug: "indicadores",
        evento_id: null,
      });
    });

    it("generates slug from name when slug is not provided", async () => {
      mocks.apiPost.mockResolvedValue({ id: "d-1", name: "Indicadores", slug: "indicadores" });
      const result = await createDepartment("Indicadores");
      expect(result).toEqual({ id: "d-1", name: "Indicadores", slug: "indicadores" });
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/departments", {
        name: "Indicadores",
        slug: "indicadores",
        evento_id: null,
      });
    });

    it("throws message with owner name on 409 with coordinator conflict", async () => {
      mocks.apiPost.mockRejectedValue(
        new ApiError(
          "Departamento já possui coordenador para este evento: Carlos Henrique",
          409,
          "23505"
        )
      );
      await expect(createDepartment("Indicadores", "indicadores", "ev-1")).rejects.toThrow(
        "Departamento já possui coordenador para este evento: Carlos Henrique"
      );
    });

    it("falls back to generic message on duplicate slug without coordinator info", async () => {
      mocks.apiPost.mockRejectedValue(new ApiError("duplicate key value", 409, "23505"));
      await expect(createDepartment("Limpeza", "limpeza")).rejects.toThrow(
        "Este nome de departamento já está em uso por outra equipe"
      );
    });

    it("returns the department when the Worker resolves an existing slug (orphan claim)", async () => {
      mocks.apiPost.mockResolvedValue({ id: "d-1", name: "Limpeza", slug: "limpeza" });
      const result = await createDepartment("Limpeza", "limpeza");
      expect(result).toEqual({ id: "d-1", name: "Limpeza", slug: "limpeza" });
    });

    it("surfaces safe server messages on other errors", async () => {
      mocks.apiPost.mockRejectedValue(new ApiError("Nome inválido.", 400));
      await expect(createDepartment("Teste", "teste")).rejects.toThrow("Nome inválido.");
    });
  });

  describe("getDepartmentOwnerBySlugRpc", () => {
    it("returns the owner name", async () => {
      mocks.apiGet.mockResolvedValue("Carlos Henrique");
      const owner = await getDepartmentOwnerBySlugRpc("indicadores");
      expect(owner).toBe("Carlos Henrique");
      expect(mocks.apiGet).toHaveBeenCalledWith("/api/departments/owner?slug=indicadores");
    });

    it("returns null when the endpoint fails or returns null", async () => {
      mocks.apiGet.mockResolvedValue(null);
      expect(await getDepartmentOwnerBySlugRpc("limpeza")).toBeNull();
      mocks.apiGet.mockRejectedValue(new Error("boom"));
      expect(await getDepartmentOwnerBySlugRpc("limpeza")).toBeNull();
    });
  });

  describe("getDepartmentOwner", () => {
    it("returns the coordinator profile name by department id", async () => {
      mocks.apiGet.mockResolvedValue({ userId: "u-1", name: "João Passos" });
      const owner = await getDepartmentOwner("d-1");
      expect(owner).toBe("João Passos");
      expect(mocks.apiGet).toHaveBeenCalledWith("/api/departments/d-1/owner");
    });

    it("returns null when no coordinator found", async () => {
      mocks.apiGet.mockResolvedValue({ userId: null, name: null });
      const owner = await getDepartmentOwner("d-1");
      expect(owner).toBeNull();
    });
  });

  describe("linkUserAsCoordinator", () => {
    it("posts a department_members row with role coordenador", async () => {
      await expect(linkUserAsCoordinator("d-1", "u-1")).resolves.not.toThrow();
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/departments/d-1/members", {
        user_id: "u-1",
        role: "coordenador",
        evento_id: null,
      });
    });

    it("throws on insert error", async () => {
      mocks.apiPost.mockRejectedValue(new ApiError("foreign key violation", 400));
      await expect(linkUserAsCoordinator("d-1", "u-1")).rejects.toThrow("foreign key violation");
    });

    it("throws 'Registro duplicado.' on duplicate membership", async () => {
      mocks.apiPost.mockRejectedValue(new ApiError("dup", 409, "23505"));
      await expect(linkUserAsCoordinator("d-1", "u-1")).rejects.toThrow("Registro duplicado.");
    });
  });

  describe("findProfileByEmail", () => {
    it("returns the matched profile", async () => {
      mocks.apiGet.mockResolvedValue({ id: "u-2", email: "a@b.com" });
      const result = await findProfileByEmail("a@b.com");
      expect(result).toEqual({ id: "u-2", email: "a@b.com" });
      expect(mocks.apiGet).toHaveBeenCalledWith("/api/profiles?email=a%40b.com");
    });

    it("returns null when no profile matches", async () => {
      mocks.apiGet.mockResolvedValue(null);
      const result = await findProfileByEmail("nobody@x.com");
      expect(result).toBeNull();
    });
  });

  describe("addDepartmentMember", () => {
    it("posts a member with assistant role by default", async () => {
      await expect(addDepartmentMember("d-1", "u-2")).resolves.not.toThrow();
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/departments/d-1/members", {
        user_id: "u-2",
        role: "assistente",
        evento_id: null,
      });
    });

    it("throws friendly message on duplicate membership", async () => {
      mocks.apiPost.mockRejectedValue(new ApiError("dup", 409, "23505"));
      await expect(addDepartmentMember("d-1", "u-2")).rejects.toThrow(
        "Este usuário já faz parte do departamento."
      );
    });
  });

  describe("listDepartmentMembers", () => {
    it("lists members with profile emails", async () => {
      mocks.apiGet.mockResolvedValue([
        { id: "dm-1", role: "coordenador", profiles: { email: "c@x.com" } },
      ]);
      const result = await listDepartmentMembers("d-1");
      expect(result).toEqual([{ id: "dm-1", role: "coordenador", profiles: { email: "c@x.com" } }]);
      expect(mocks.apiGet).toHaveBeenCalledWith("/api/departments/d-1/members");
    });

    it("throws safe server message on error", async () => {
      mocks.apiGet.mockRejectedValue(new ApiError("boom", 400));
      await expect(listDepartmentMembers("d-1")).rejects.toThrow("boom");
    });
  });

  describe("removeDepartmentMember", () => {
    it("deletes a membership row", async () => {
      await expect(removeDepartmentMember("dm-2")).resolves.not.toThrow();
      expect(mocks.apiDelete).toHaveBeenCalledWith("/api/members/dm-2");
    });

    it("throws on delete error", async () => {
      mocks.apiDelete.mockRejectedValue(new ApiError("boom", 400));
      await expect(removeDepartmentMember("dm-2")).rejects.toThrow("boom");
    });
  });

  describe("createStandardDepartmentsForEvento", () => {
    it("returns empty array when no eventoId", async () => {
      const result = await createStandardDepartmentsForEvento(null);
      expect(result).toEqual([]);
      expect(mocks.apiGet).not.toHaveBeenCalled();
      expect(mocks.apiPost).not.toHaveBeenCalled();
    });

    it("returns linked departments when the evento already has links", async () => {
      const depts = [
        { id: "d-1", name: "Contas", slug: "contas" },
        { id: "d-2", name: "Indicadores", slug: "indicadores" },
      ];
      mocks.apiGet.mockImplementation(async (path: string) => {
        if (path.endsWith("/department-links")) return [{ department_id: "d-1" }];
        if (path.endsWith("/departments")) return depts;
        throw new Error(`Unexpected GET ${path}`);
      });

      const result = await createStandardDepartmentsForEvento("ev-1");
      expect(result).toEqual(depts);
      expect(mocks.apiPost).not.toHaveBeenCalled();
    });

    it("asks the Worker to create + link the standard departments when there are no links", async () => {
      const depts = [
        { id: "d-1", name: "Contas", slug: "contas" },
        { id: "d-2", name: "Indicadores", slug: "indicadores" },
      ];
      mocks.apiGet.mockResolvedValue([]);
      mocks.apiPost.mockResolvedValue({ linked: 12, departments: depts });

      const result = await createStandardDepartmentsForEvento("ev-1");
      expect(result).toEqual(depts);
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/eventos/ev-1/departments/standard");
    });
  });

  describe("linkStandardDepartmentsToEvento", () => {
    it("retorna { linked: 0 } sem eventoId", async () => {
      await expect(linkStandardDepartmentsToEvento(null)).resolves.toEqual({ linked: 0 });
      expect(mocks.apiPost).not.toHaveBeenCalled();
    });

    it("delega a garantia dos vínculos padrão ao Worker", async () => {
      mocks.apiPost.mockResolvedValue({ linked: 1, departments: [] });
      const result = await linkStandardDepartmentsToEvento("ev-1");
      expect(result).toEqual({ linked: 1 });
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/eventos/ev-1/departments/standard");
    });

    it("retorna { linked: 0 } quando o Worker não precisa vincular nada", async () => {
      mocks.apiPost.mockResolvedValue({ linked: 0, departments: [] });
      await expect(linkStandardDepartmentsToEvento("ev-1")).resolves.toEqual({ linked: 0 });
    });

    it("lança erro quando o Worker recusa a operação", async () => {
      mocks.apiPost.mockRejectedValue(new ApiError("Sem permissão.", 403));
      await expect(linkStandardDepartmentsToEvento("ev-1")).rejects.toThrow("Sem permissão.");
    });
  });
});
