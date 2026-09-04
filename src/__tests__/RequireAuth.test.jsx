import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "../context/AuthContext";

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <div>PROTECTED CONTENT</div>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RequireAuth", () => {
  it("renders children when user is authenticated", () => {
    useAuth.mockReturnValue({ user: { id: "u-1" }, loading: false });
    renderAt("/");
    expect(screen.getByText("PROTECTED CONTENT")).toBeDefined();
  });

  it("redirects to /login when not authenticated", () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderAt("/");
    expect(screen.getByText("LOGIN PAGE")).toBeDefined();
    expect(screen.queryByText("PROTECTED CONTENT")).toBeNull();
  });

  it("shows loading state while auth is loading", () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    renderAt("/");
    expect(screen.getByText("Carregando...")).toBeDefined();
    expect(screen.queryByText("LOGIN PAGE")).toBeNull();
  });
});
