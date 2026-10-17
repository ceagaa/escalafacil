import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  results: {},
  queries: {},
}));

vi.mock("../services/supabase", () => ({ supabase: { from: mocks.from } }));

import { getCoordinatedEventoIds } from "../services/eventService";

function createQuery(result) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.results = {
    department_members: {
      data: [{ evento_id: "event-1", department_id: "dept-1" }, { evento_id: "event-1", department_id: "dept-1" }],
      error: null,
    },
    departments: { data: [], error: null },
    evento_departamentos: { data: [], error: null },
  };
  mocks.queries = {};
  mocks.from.mockImplementation((table) => {
    const query = createQuery(mocks.results[table]);
    mocks.queries[table] = query;
    return query;
  });
});

describe("getCoordinatedEventoIds", () => {
  it("returns unique event ids from event-scoped coordinator memberships", async () => {
    await expect(getCoordinatedEventoIds("user-1")).resolves.toEqual(["event-1"]);
    expect(mocks.from).toHaveBeenCalledWith("department_members");
    expect(mocks.queries.department_members.select).toHaveBeenCalledWith("evento_id, department_id");
    expect(mocks.queries.department_members.eq).toHaveBeenNthCalledWith(1, "user_id", "user-1");
    expect(mocks.queries.department_members.eq).toHaveBeenNthCalledWith(2, "role", "coordenador");
  });

  it("maps legacy department coordinators to their linked events", async () => {
    mocks.results.department_members = {
      data: [{ evento_id: null, department_id: "dept-1" }],
      error: null,
    };
    mocks.results.departments = { data: [{ id: "dept-2" }], error: null };
    mocks.results.evento_departamentos = {
      data: [{ evento_id: "event-1" }, { evento_id: "event-2" }, { evento_id: "event-1" }],
      error: null,
    };

    await expect(getCoordinatedEventoIds("user-1")).resolves.toEqual(["event-1", "event-2"]);
    expect(mocks.queries.evento_departamentos.in).toHaveBeenCalledWith("department_id", ["dept-1", "dept-2"]);
  });

  it("requires a user id", async () => {
    await expect(getCoordinatedEventoIds("")).rejects.toThrow("userId is required");
  });

  it("surfaces database errors", async () => {
    mocks.results.department_members = { data: null, error: { message: "permission denied", code: "42501" } };
    await expect(getCoordinatedEventoIds("user-1")).rejects.toThrow("Acesso negado.");
  });
});
