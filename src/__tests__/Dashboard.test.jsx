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
        neq: vi.fn(() => builder),
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
  getDepartmentOwnerBySlugRpc,
} from "../services/departmentService";

const authDefaults = {
  user: { id: "user-1" },
  departments: [],
  activeDepartment: null,
  selectDepartment: vi.fn(),
  refreshSession: vi.fn().mockResolvedValue([]),
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
  getDepartmentOwnerBySlugRpc.mockResolvedValue(null);
  mockState.deptListResult = { data: [], error: null };
});

describe("Dashboard", () => {
  describe("empty state (no department selected)", () => {
    it("renders welcome message and selection cards", () => {
      renderDashboard();
      expect(screen.getByText("Bem-vindo!")).toBeDefined();
      expect(screen.getByText("Escolha o departamento da sua equipe para começar.")).toBeDefined();
      expect(screen.getByText("Achados Perdidos e Guarda Volumes")).toBeDefined();
      expect(screen.getByText("Indicadores")).toBeDefined();
      expect(screen.getByText("Limpeza")).toBeDefined();
    });

    it("shows claim hint for available departments", () => {
      renderDashboard();
      expect(screen.getAllByText("Ao reivindicar, você será o coordenador deste departamento.").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Disponível").length).toBeGreaterThanOrEqual(1);
    });

    it("shows owner name for taken departments", async () => {
      mockState.deptListResult = {
        data: [{ id: "d-1", name: "Indicadores", slug: "indicadores" }],
        error: null,
      };
      getDepartmentOwnerBySlugRpc.mockResolvedValue("Ana Souza");

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Responsável: Ana Souza.")).toBeDefined();
      });
      expect(screen.getAllByText("Ocupado").length).toBeGreaterThanOrEqual(1);
    });

    it("claims a free department and switches to active state", async () => {
      createDepartment.mockResolvedValue({ id: "d-3", name: "Limpeza", slug: "limpeza" });
      linkUserAsCoordinator.mockResolvedValue();

      renderDashboard();

      fireEvent.click(screen.getByRole("button", { name: /Limpeza/ }));

      await waitFor(() => {
        expect(createDepartment).toHaveBeenCalledWith("Limpeza", "limpeza");
        expect(linkUserAsCoordinator).toHaveBeenCalledWith("d-3", "user-1");
        expect(authDefaults.selectDepartment).toHaveBeenCalled();
      });
    });

    it("shows toast when clicking a taken department", async () => {
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
        expect(screen.getByText("Departamento já criado. Responsável: Ana Souza")).toBeDefined();
      });
    });

    it("selects own department on click", async () => {
      useAuth.mockReturnValue({
        ...authDefaults,
        departments: [
          { id: "dm-1", role: "coordenador", department: { id: "d-1", name: "Limpeza", slug: "limpeza" } },
        ],
      });
      mockState.deptListResult = {
        data: [{ id: "d-1", name: "Limpeza", slug: "limpeza" }],
        error: null,
      };
      getDepartmentOwnerBySlugRpc.mockResolvedValue("Carlos");

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Seu departamento")).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: /Limpeza/ }));

      expect(authDefaults.selectDepartment).toHaveBeenCalled();
    });
  });

  describe("active state (department selected)", () => {
    const deptAuth = {
      ...authDefaults,
      departments: [
        { id: "dm-1", role: "coordenador", department: { id: "d-1", name: "Limpeza", slug: "limpeza", features: { lostItems: false } } },
      ],
      activeDepartment: { id: "dm-1", role: "coordenador", department: { id: "d-1", name: "Limpeza", slug: "limpeza", features: { lostItems: false } } },
    };

    it("shows department name as title", () => {
      useAuth.mockReturnValue(deptAuth);
      renderDashboard();
      expect(screen.getByText("Limpeza")).toBeDefined();
      expect(screen.getByText("Painel do coordenador")).toBeDefined();
    });

    it("shows stat cards for the department", () => {
      useAuth.mockReturnValue(deptAuth);
      renderDashboard();
      expect(screen.getByText("Voluntários")).toBeDefined();
      expect(screen.getByText("Turnos")).toBeDefined();
    });

    it("shows share links with WhatsApp buttons", () => {
      useAuth.mockReturnValue(deptAuth);
      renderDashboard();
      expect(screen.getByText("Cadastro de Voluntários")).toBeDefined();
      expect(screen.getByText("Escala Pública")).toBeDefined();
      expect(screen.getAllByText("WhatsApp").length).toBeGreaterThanOrEqual(2);
    });

    it("shows module shortcuts", () => {
      useAuth.mockReturnValue(deptAuth);
      renderDashboard();
      expect(screen.getByText("Gestão de Escalas")).toBeDefined();
      expect(screen.getByText("Equipe e Aprovação")).toBeDefined();
      expect(screen.getByText("Configurações")).toBeDefined();
    });

    it("shows Achados e Perdidos for that department", () => {
      useAuth.mockReturnValue({
        ...deptAuth,
        activeDepartment: {
          ...deptAuth.activeDepartment,
          department: { id: "d-ap", name: "Achados Perdidos", slug: "achados-perdidos-guarda-volumes" },
        },
      });
      renderDashboard();
      expect(screen.getByText("Achados e Perdidos")).toBeDefined();
    });

    it("hides Achados e Perdidos for other departments", () => {
      useAuth.mockReturnValue(deptAuth);
      renderDashboard();
      expect(screen.queryByText("Achados e Perdidos")).toBeNull();
    });

    it("shows Trocar de departamento when user has multiple depts", () => {
      useAuth.mockReturnValue({
        ...deptAuth,
        departments: [
          { id: "dm-1", role: "coordenador", department: { id: "d-1", name: "Limpeza", slug: "limpeza" } },
          { id: "dm-2", role: "coordenador", department: { id: "d-2", name: "Indicadores", slug: "indicadores" } },
        ],
      });
      renderDashboard();
      expect(screen.getByText("Trocar de departamento")).toBeDefined();
    });

    it("hides Trocar de departamento when user has only one dept", () => {
      useAuth.mockReturnValue(deptAuth);
      renderDashboard();
      expect(screen.queryByText("Trocar de departamento")).toBeNull();
    });
  });
});
