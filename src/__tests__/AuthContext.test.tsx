import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, render, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { EventProvider, useEvent } from "../context/EventContext";

const _mockUser = { id: "user-1", email: "test@example.com" };
const mockProfile = { id: "user-1", name: "Test User", is_super_admin: false };
const _mockDepts = [{ id: "dm-1", user_id: "user-1", department: { id: "dept-1", name: "Indicadores" } }];

vi.mock("../services/api", () => {
  const mockApiRequest = vi.fn();
  const mockApiGet = vi.fn();

  class MockApiError extends Error {
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
    apiRequest: mockApiRequest,
    apiGet: mockApiGet,
    apiData: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
    ApiError: MockApiError,
  };
});

import { apiRequest, apiGet } from "../services/api";

function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <EventProvider>
        <AuthProvider>{children}</AuthProvider>
      </EventProvider>
    );
  };
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Sessão inicial: sem usuário logado.
    (apiRequest as any).mockResolvedValue({ user: null });
    (apiGet as any).mockResolvedValue([]);
  });

  it("starts with loading=true and no user", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it("exposes login, signUp and logout functions", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(typeof result.current.login).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(typeof result.current.logout).toBe("function");
    expect(typeof result.current.resetPassword).toBe("function");
  });

  it("exposes selectDepartment function", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(typeof result.current.selectDepartment).toBe("function");
  });

  it("purges departments and active department when the active event is cleared", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => ({ auth: useAuth(), event: useEvent() }),
      { wrapper }
    );

    act(() => {
      result.current.auth.selectDepartment({
        id: "dm-1",
        user_id: "user-1",
        evento_id: "ev-1",
        department: { id: "dept-1", name: "Indicadores" },
      });
    });
    expect(result.current.auth.activeDepartment).not.toBeNull();

    act(() => {
      result.current.event.selectEvent({ id: "ev-1", tipo: "assembleia" });
    });
    expect(result.current.auth.activeDepartment).not.toBeNull();

    act(() => {
      result.current.event.clearEvent();
    });

    await waitFor(() => {
      expect(result.current.auth.activeDepartment).toBeNull();
      expect(result.current.auth.departments).toEqual([]);
    });

    localStorage.removeItem("escalafacil_active_evento_id");
  });

  it("throws when useAuth is used outside AuthProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function TestComponent() {
      useAuth();
      return null;
    }
    expect(() => render(<TestComponent />)).toThrow("useAuth deve ser usado dentro de um AuthProvider");
    spy.mockRestore();
  });
});
