import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../pages/Dashboard";

const mockState = vi.hoisted(() => ({ deptListResult: { data: [], error: null } }));

vi.mock("../services/supabase.js", () => ({
  supabase: {
    from: vi.fn(() => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        then: (resolve) => resolve(mockState.deptListResult),
      };
      return builder;
    }),
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../services/departmentService", () => ({
  STANDARD_DEPARTMENTS: [
    { name: "Achados Perdidos e Guarda Volumes", slug: "achados-perdidos-guarda-volumes" },
    { name: "Indicadores", slug: "indicadores" },
    { name: "Limpeza", slug: "limpeza" },
  ],
  createDepartment: vi.fn(),
  linkUserAsCoordinator: vi.fn(),
  getDashboardStats: vi.fn(),
  getDepartmentOwnerBySlugRpc: vi.fn(),
}));

import { useAuth } from "../context/AuthContext";
import {
  createDepartment,
  linkUserAsCoordinator,
  getDashboardStats,
  getDepartmentOwnerBySlugRpc,
} from "../services/departmentService";

const authDefaults = {
  user: { id: "user-1" },
  departments: [],
  selectDepartment: vi.fn(),
  refreshSession: vi.fn().mockResolvedValue([]),
};

const statsResult = {
  total_departments: 3,
  total_volunteers: 12,
  total_coordinators: 2,
  top_department: "Indicadores",
};

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Dashboard />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue(authDefaults);
  getDashboardStats.mockResolvedValue(statsResult);
  getDepartmentOwnerBySlugRpc.mockResolvedValue(null);
  mockState.deptListResult = { data: [], error: null };
});

describe("Dashboard", () => {
  it("renders the 4 stat cards from the RPC", async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Total de Departamentos")).toBeDefined();
      expect(screen.getByText("Total de Voluntários")).toBeDefined();
      expect(screen.getByText("Total de Coordenadores")).toBeDefined();
      expect(screen.getByText("Maior Departamento")).toBeDefined();
      expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("12").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Indicadores").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders the 3 standard department cards", () => {
    renderDashboard();
    expect(screen.getByText("Achados Perdidos e Guarda Volumes")).toBeDefined();
    expect(screen.getByText("Limpeza")).toBeDefined();
  });

  it("opens control panel when clicking own department", async () => {
    useAuth.mockReturnValue({
      ...authDefaults,
      departments: [
        {
          id: "dm-1",
          role: "coordenador",
          department: { id: "d-1", name: "Achados Perdidos e Guarda Volumes" },
        },
      ],
    });
    mockState.deptListResult = {
      data: [{ id: "d-1", name: "Achados Perdidos e Guarda Volumes", slug: "achados-perdidos-guarda-volumes" }],
      error: null,
    };
    getDepartmentOwnerBySlugRpc.mockResolvedValue("Carlos Henrique");

    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Meu departamento")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Achados Perdidos e Guarda Volumes"));

    await waitFor(() => {
      expect(screen.getByText(/Painel de Controle/)).toBeDefined();
      expect(screen.getByText("Link de Cadastro de Voluntários")).toBeDefined();
      expect(screen.getByText("Link Público da Escala")).toBeDefined();
      expect(screen.getByText("Gestão de Escalas")).toBeDefined();
    });
    expect(screen.getByText("Achados e Perdidos")).toBeDefined();
  });

  it("shows owner toast when clicking someone else's department", async () => {
    mockState.deptListResult = {
      data: [{ id: "d-1", name: "Indicadores", slug: "indicadores" }],
      error: null,
    };
    getDepartmentOwnerBySlugRpc.mockResolvedValue("Ana Souza");

    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Ocupado")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: /Indicadores/ }));

    await waitFor(() => {
      expect(
        screen.getByText("Departamento já criado. Responsável: Ana Souza")
      ).toBeDefined();
    });
    expect(screen.queryByText(/Painel de Controle/)).toBeNull();
  });

  it("claims a free department and opens control panel", async () => {
    createDepartment.mockResolvedValue({ id: "d-3", name: "Limpeza", slug: "limpeza" });
    linkUserAsCoordinator.mockResolvedValue();
    mockState.deptListResult = { data: [], error: null };

    renderDashboard();
    await waitFor(() => {
      expect(screen.getAllByText("Disponível").length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /Limpeza/ }));

    await waitFor(() => {
      expect(createDepartment).toHaveBeenCalledWith("Limpeza", "limpeza");
      expect(linkUserAsCoordinator).toHaveBeenCalledWith("d-3", "user-1");
      expect(screen.getByText(/Painel de Controle — Limpeza/)).toBeDefined();
    });
  });

  it("does not show Achados e Perdidos module for other departments", async () => {
    useAuth.mockReturnValue({
      ...authDefaults,
      departments: [
        { id: "dm-2", role: "coordenador", department: { id: "d-2", name: "Limpeza" } },
      ],
    });
    mockState.deptListResult = {
      data: [{ id: "d-2", name: "Limpeza", slug: "limpeza" }],
      error: null,
    };

    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText("Meu departamento")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Limpeza"));
    await waitFor(() => {
      expect(screen.getByText(/Painel de Controle/)).toBeDefined();
    });
    expect(screen.queryByText("Achados e Perdidos")).toBeNull();
    expect(screen.getByText("Gestão de Escalas")).toBeDefined();
  });
});
