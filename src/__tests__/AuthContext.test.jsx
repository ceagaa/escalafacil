import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, render, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "../context/AuthContext";

const mockUser = { id: "user-1", email: "test@example.com" };
const mockProfile = { id: "user-1", name: "Test User", is_super_admin: false };
const mockDepts = [{ id: "dm-1", user_id: "user-1", department: { id: "dept-1", name: "Achados" } }];

vi.mock("../services/supabase.js", () => {
  const mockSignIn = vi.fn();
  const mockSignOut = vi.fn();
  const mockGetSession = vi.fn();
  const mockOnAuthStateChange = vi.fn();

  return {
    supabase: {
      auth: {
        signInWithPassword: mockSignIn,
        signOut: mockSignOut,
        getSession: mockGetSession,
        onAuthStateChange: mockOnAuthStateChange,
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
      })),
    },
    __mocks: { mockSignIn, mockSignOut, mockGetSession, mockOnAuthStateChange },
  };
});

import { supabase } from "../services/supabase";

function createWrapper() {
  return function Wrapper({ children }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it("starts with loading=true and no user", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it("exposes login and logout functions", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(typeof result.current.login).toBe("function");
    expect(typeof result.current.logout).toBe("function");
  });

  it("exposes selectDepartment function", () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(typeof result.current.selectDepartment).toBe("function");
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
