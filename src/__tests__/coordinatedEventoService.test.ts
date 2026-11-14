import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
}));

vi.mock("../services/api", () => ({
  apiGet: mocks.apiGet,
  apiPost: vi.fn(),
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

import { getCoordinatedEventoIds } from "../services/eventService";

type Fixture = {
  memberships?: unknown[];
  ownedDepartments?: unknown[];
  links?: unknown[];
};

function useFixture(fixture: Fixture): void {
  mocks.apiGet.mockImplementation(async (path: string) => {
    if (path.startsWith("/api/members?")) return fixture.memberships ?? [];
    if (path.startsWith("/api/departments?coordenador_id=")) return fixture.ownedDepartments ?? [];
    if (path.startsWith("/api/departments/links?")) return fixture.links ?? [];
    throw new Error(`Unexpected GET ${path}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCoordinatedEventoIds", () => {
  it("returns unique event ids from event-scoped coordinator memberships", async () => {
    useFixture({
      memberships: [
        { evento_id: "event-1", department_id: "dept-1" },
        { evento_id: "event-1", department_id: "dept-1" },
      ],
    });

    await expect(getCoordinatedEventoIds("user-1")).resolves.toEqual(["event-1"]);
    expect(mocks.apiGet).toHaveBeenCalledWith(
      "/api/members?user_id=user-1&role=coordenador"
    );
    expect(mocks.apiGet).toHaveBeenCalledWith("/api/departments?coordenador_id=user-1");
  });

  it("maps legacy department coordinators to their linked events", async () => {
    useFixture({
      memberships: [{ evento_id: null, department_id: "dept-1" }],
      ownedDepartments: [{ id: "dept-2" }],
      links: [{ evento_id: "event-1" }, { evento_id: "event-2" }, { evento_id: "event-1" }],
    });

    await expect(getCoordinatedEventoIds("user-1")).resolves.toEqual(["event-1", "event-2"]);
    expect(mocks.apiGet).toHaveBeenCalledWith(
      "/api/departments/links?department_id_in=dept-1,dept-2"
    );
  });

  it("requires a user id", async () => {
    await expect(getCoordinatedEventoIds("")).rejects.toThrow("userId is required");
    expect(mocks.apiGet).not.toHaveBeenCalled();
  });

  it("surfaces database errors", async () => {
    mocks.apiGet.mockRejectedValue({ message: "permission denied", code: "42501" });
    await expect(getCoordinatedEventoIds("user-1")).rejects.toThrow("Acesso negado.");
  });
});
