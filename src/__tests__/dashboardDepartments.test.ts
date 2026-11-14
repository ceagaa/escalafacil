import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("../services/api", () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
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
  fetchOwnersMap,
  fetchEventDepartments,
  applyEventOwner,
  groupDepartments,
} from "../services/dashboardDepartments";

/**
 * Despacha GETs por prefixo de path:
 *   /api/eventos/:id/owners     -> coordenadores do evento
 *   /api/eventos/:id/departments -> vínculos do evento
 *   /api/departments/standard    -> departamentos padrão
 */
function configureGet({
  owners = [],
  departments,
  standard = [],
  departmentsError,
}: {
  owners?: any;
  departments?: any;
  standard?: any;
  departmentsError?: unknown;
}) {
  mocks.apiGet.mockImplementation(async (path: string) => {
    if (path.includes("/owners")) return owners;
    if (path.endsWith("/departments")) {
      if (departmentsError) throw departmentsError;
      return departments ?? [];
    }
    if (path.startsWith("/api/departments/standard")) return standard;
    throw new Error(`Unexpected GET ${path}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiGet.mockResolvedValue([]);
  mocks.apiPost.mockResolvedValue({ linked: 0 });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("fetchOwnersMap", () => {
  it("monta o mapa de coordenadores do evento", async () => {
    configureGet({
      owners: [{ department_id: "d-1", user_id: "u-1", name: "Ana Souza" }],
    });

    const map = await fetchOwnersMap("ev-1");
    expect(map.get("d-1")).toEqual({ userId: "u-1", name: "Ana Souza" });
    expect(mocks.apiGet).toHaveBeenCalledWith("/api/eventos/ev-1/owners");
  });

  it("mantém o coordenador (card Ocupado) mesmo sem nome — bug dos cards 'Disponível'", async () => {
    configureGet({
      owners: [{ department_id: "d-1", user_id: "u-1", name: null }],
    });

    const map = await fetchOwnersMap("ev-1");
    expect(map.get("d-1")).toEqual({ userId: "u-1", name: null });
  });

  it("retorna mapa vazio quando a própria consulta de coordenadores falha", async () => {
    mocks.apiGet.mockImplementation(async (path: string) => {
      if (path.includes("/owners")) throw new Error("rls");
      return [];
    });

    const map = await fetchOwnersMap("ev-1");
    expect(map.size).toBe(0);
  });

  it("ignora linhas sem department_id", async () => {
    configureGet({
      owners: [
        { department_id: null, user_id: "u-1", name: "Ana" },
        { department_id: "d-2", user_id: "u-2", name: "Bia" },
      ],
    });

    const map = await fetchOwnersMap("ev-1");
    expect(map.size).toBe(1);
    expect(map.get("d-2")!.name).toBe("Bia");
  });

  it("retorna mapa vazio sem evento", async () => {
    const map = await fetchOwnersMap(null);
    expect(map.size).toBe(0);
    expect(mocks.apiGet).not.toHaveBeenCalled();
  });
});

describe("applyEventOwner + groupDepartments (fluxo do card)", () => {
  it("marca como Ocupado (por outro) quando há coordenador no evento", async () => {
    configureGet({ owners: [{ department_id: "d-1", user_id: "u-2", name: "Ana" }] });
    const owners = await fetchOwnersMap("ev-1");
    const record = applyEventOwner({ id: "d-1", name: "Contas", coordenador_id: null }, owners);
    const { takenByOthers, available, mine } = groupDepartments([record], "u-1");
    expect(mine).toHaveLength(0);
    expect(available).toHaveLength(0);
    expect(takenByOthers).toHaveLength(1);
    expect(takenByOthers[0].ownerName).toBe("Ana");
  });

  it("marca como meu quando o coordenador é o usuário atual", async () => {
    configureGet({ owners: [{ department_id: "d-1", user_id: "u-1", name: "Carlos" }] });
    const owners = await fetchOwnersMap("ev-1");
    const record = applyEventOwner({ id: "d-1", name: "Contas", coordenador_id: null }, owners);
    const { mine } = groupDepartments([record], "u-1");
    expect(mine).toHaveLength(1);
    expect(mine[0].coordenador_id).toBe("u-1");
  });

  it("fica Disponível apenas quando não há coordenador algum", () => {
    const record = applyEventOwner({ id: "d-1", name: "Batismo", coordenador_id: null }, new Map());
    const { available } = groupDepartments([record], "u-1");
    expect(available).toHaveLength(1);
  });
});

describe("fetchEventDepartments (grade nunca fica vazia)", () => {
  const contas = { id: "d-contas", name: "Contas", slug: "contas", coordenador_id: null };

  it("completa a grade com os departamentos padrão quando o evento não tem vínculos", async () => {
    configureGet({ departments: [], standard: [contas] });

    const list = await fetchEventDepartments("ev-grade-1");

    expect(list.map((dept) => dept.id)).toContain("d-contas");
  });

  it("mantém os vínculos existentes e só completa os que faltam (sem duplicar)", async () => {
    configureGet({
      departments: [{ id: "d-custom", name: "Limpeza", slug: "limpeza", coordenador_id: null }],
      standard: [contas],
    });

    const list = await fetchEventDepartments("ev-grade-2");
    const ids = list.map((dept) => dept.id);

    expect(ids).toContain("d-custom");
    expect(ids).toContain("d-contas");
    expect(ids).toHaveLength(2);
  });

  it("mostra o departamento padrão como Ocupado quando outro usuário o coordena", async () => {
    configureGet({
      departments: [],
      standard: [contas],
      owners: [{ department_id: "d-contas", user_id: "u-2", name: "Paulo" }],
    });

    const list = await fetchEventDepartments("ev-grade-3");

    expect(list).toHaveLength(1);
    expect(list[0].coordenador_id).toBe("u-2");
    const { takenByOthers } = groupDepartments(list, "u-1");
    expect(takenByOthers).toHaveLength(1);
  });

  it("funciona mesmo quando a consulta de vínculos falha", async () => {
    configureGet({
      departmentsError: new Error("permission denied"),
      standard: [contas],
    });

    const list = await fetchEventDepartments("ev-grade-4");

    // vínculos falham -> lista vazia -> departamentos padrão seguram a grade.
    expect(list.map((dept) => dept.id)).toContain("d-contas");
  });

  it("retorna lista vazia sem evento", async () => {
    const list = await fetchEventDepartments(null);
    expect(list).toEqual([]);
    expect(mocks.apiGet).not.toHaveBeenCalled();
  });
});
