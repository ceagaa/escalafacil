import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("../services/supabase", () => ({
  supabase: { from: mockFrom },
}));

import { fetchOwnersMap, fetchEventDepartments, applyEventOwner, groupDepartments } from "../services/dashboardDepartments";

/** Builder thenável que responde com o resultado da tabela configurada. */
function tableResponse(result) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    upsert: () => builder,
    maybeSingle: () => builder,
    single: () => builder,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function configureTables({ departmentMembers, profiles }) {
  mockFrom.mockImplementation((table) => {
    if (table === "department_members") return tableResponse(departmentMembers);
    if (table === "profiles") return tableResponse(profiles);
    return tableResponse({ data: [], error: null });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("fetchOwnersMap", () => {
  it("monta o mapa sem depender do join de profiles", async () => {
    configureTables({
      departmentMembers: { data: [{ department_id: "d-1", user_id: "u-1" }], error: null },
      profiles: { data: [{ id: "u-1", name: "Ana Souza" }], error: null },
    });

    const map = await fetchOwnersMap("ev-1");
    expect(map.get("d-1")).toEqual({ userId: "u-1", name: "Ana Souza" });
  });

  it("mantém o coordenador (card Ocupado) mesmo quando profiles falha — bug dos cards 'Disponível'", async () => {
    configureTables({
      departmentMembers: { data: [{ department_id: "d-1", user_id: "u-1" }], error: null },
      profiles: { data: null, error: { message: "permission denied for table profiles" } },
    });

    const map = await fetchOwnersMap("ev-1");
    expect(map.get("d-1")).toEqual({ userId: "u-1", name: null });
  });

  it("retorna mapa vazio quando a própria consulta de coordenadores falha", async () => {
    configureTables({
      departmentMembers: { data: null, error: { message: "rls" } },
      profiles: { data: [], error: null },
    });

    const map = await fetchOwnersMap("ev-1");
    expect(map.size).toBe(0);
  });

  it("ignora linhas sem department_id", async () => {
    configureTables({
      departmentMembers: { data: [{ department_id: null, user_id: "u-1" }, { department_id: "d-2", user_id: "u-2" }], error: null },
      profiles: { data: [{ id: "u-2", name: "Bia" }], error: null },
    });

    const map = await fetchOwnersMap("ev-1");
    expect(map.size).toBe(1);
    expect(map.get("d-2").name).toBe("Bia");
  });

  it("retorna mapa vazio sem evento", async () => {
    const map = await fetchOwnersMap(null);
    expect(map.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("applyEventOwner + groupDepartments (fluxo do card)", () => {
  it("marca como Ocupado (por outro) quando há coordenador no evento", async () => {
    configureTables({
      departmentMembers: { data: [{ department_id: "d-1", user_id: "u-2" }], error: null },
      profiles: { data: [{ id: "u-2", name: "Ana" }], error: null },
    });
    const owners = await fetchOwnersMap("ev-1");
    const record = applyEventOwner({ id: "d-1", name: "Contas", coordenador_id: null }, owners);
    const { takenByOthers, available, mine } = groupDepartments([record], "u-1");
    expect(mine).toHaveLength(0);
    expect(available).toHaveLength(0);
    expect(takenByOthers).toHaveLength(1);
    expect(takenByOthers[0].ownerName).toBe("Ana");
  });

  it("marca como meu quando o coordenador é o usuário atual", async () => {
    configureTables({
      departmentMembers: { data: [{ department_id: "d-1", user_id: "u-1" }], error: null },
      profiles: { data: [{ id: "u-1", name: "Carlos" }], error: null },
    });
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

  function configureGrade({ links, standard = [contas], owners = [] }) {
    mockFrom.mockImplementation((table) => {
      if (table === "evento_departamentos") return tableResponse(links);
      if (table === "departments") return tableResponse({ data: standard, error: null });
      if (table === "department_members") return tableResponse({ data: owners, error: null });
      if (table === "profiles") return tableResponse({ data: [], error: null });
      return tableResponse({ data: [], error: null });
    });
  }

  it("completa a grade com os departamentos padrão quando o evento não tem vínculos", async () => {
    configureGrade({ links: { data: [], error: null } });

    const list = await fetchEventDepartments("ev-grade-1");

    expect(list.map((dept) => dept.id)).toContain("d-contas");
  });

  it("mantém os vínculos existentes e só completa os que faltam (sem duplicar)", async () => {
    configureGrade({
      links: {
        data: [{ department: { id: "d-custom", name: "Limpeza", slug: "limpeza", coordenador_id: null } }],
        error: null,
      },
      standard: [contas],
    });

    const list = await fetchEventDepartments("ev-grade-2");
    const ids = list.map((dept) => dept.id);

    expect(ids).toContain("d-custom");
    expect(ids).toContain("d-contas");
    expect(ids).toHaveLength(2);
  });

  it("mostra o departamento padrão como Ocupado quando outro usuário o coordena", async () => {
    configureGrade({
      links: { data: [], error: null },
      owners: [{ department_id: "d-contas", user_id: "u-2" }],
    });

    const list = await fetchEventDepartments("ev-grade-3");

    expect(list).toHaveLength(1);
    expect(list[0].coordenador_id).toBe("u-2");
    const { takenByOthers } = groupDepartments(list, "u-1");
    expect(takenByOthers).toHaveLength(1);
  });

  it("funciona mesmo quando a consulta de vínculos falha", async () => {
    configureGrade({ links: { data: null, error: { message: "permission denied" } } });

    const list = await fetchEventDepartments("ev-grade-4");

    // fallback consulta department_id (também falha) -> lista vazia ->
    // departamentos padrão seguram a grade.
    expect(list.map((dept) => dept.id)).toContain("d-contas");
  });

  it("retorna lista vazia sem evento", async () => {
    const list = await fetchEventDepartments(null);
    expect(list).toEqual([]);
  });
});
