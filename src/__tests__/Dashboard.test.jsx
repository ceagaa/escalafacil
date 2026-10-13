import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "../pages/Dashboard";

const mockState = vi.hoisted(() => ({
  deptListResult: { data: [], error: null },
  deptBySlugResult: { data: null, error: null },
  deptMembersResult: { data: null, error: null },
  eventoDeptsResult: { data: [], error: null },
}));

vi.mock("../services/supabase.js", () => ({
  supabase: {
    from: vi.fn((table) => {
      let callCount = 0;
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        is: vi.fn(() => builder),
        maybeSingle: vi.fn(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve(mockState.deptBySlugResult);
          return Promise.resolve(mockState.deptMembersResult);
        }),
        then: (resolve) => {
          const result = table === "evento_departamentos"
            ? mockState.eventoDeptsResult
            : mockState.deptListResult;
          return resolve(result);
        },
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
  ],
  createDepartment: vi.fn(),
  linkUserAsCoordinator: vi.fn(),
  claimDepartmentForEvento: vi.fn(),
  getEventoDepartmentOwner: vi.fn().mockResolvedValue(null),
  revokeDepartmentCoordinator: vi.fn(),
}));

vi.mock("../services/eventService", () => ({
  linkDepartmentToEvento: vi.fn().mockResolvedValue(),
  getDepartmentHistory: vi.fn().mockResolvedValue([]),
  importVolunteersFromEvento: vi.fn().mockResolvedValue({ imported: 0 }),
}));

vi.mock("../context/EventContext", () => ({
  useEvent: vi.fn(),
}));

vi.mock("../components/ConfirmModal", () => ({
  __esModule: true,
  default: ({ title, message, onCancel, onConfirm }) => (
    <div data-testid="confirm-modal">
      <p>{title}</p>
      <p>{message}</p>
      <button onClick={onCancel}>Cancelar</button>
      <button onClick={onConfirm}>Confirmar</button>
    </div>
  ),
}));

import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { supabase } from "../services/supabase";
import { createDepartment, getEventoDepartmentOwner } from "../services/departmentService";

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
  useEvent.mockReturnValue({ activeEvent: null, eventoId: null, clearEvent: vi.fn() });
  getEventoDepartmentOwner.mockResolvedValue(null);
  mockState.deptListResult = { data: [], error: null };
  mockState.eventoDeptsResult = { data: [], error: null };
  mockState.deptBySlugResult = { data: null, error: null };
});

describe("Dashboard", () => {
  describe("empty state (no department selected)", () => {
    it("renders welcome message and selection cards", async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Indicadores")).toBeDefined();
      });
      expect(screen.getByText("Bem-vindo!")).toBeDefined();
      expect(screen.getByText("Escolha o departamento da sua equipe para começar.")).toBeDefined();
      expect(screen.getByText("Contas")).toBeDefined();
    });

    it("does not query the database while there is no active event", async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Indicadores")).toBeDefined();
      });
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("shows claim hint for available departments", async () => {
      renderDashboard();
      await waitFor(() => {
        expect(screen.getAllByText("Disponível").length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.getAllByText("Ao reivindicar, você será o coordenador deste departamento.").length).toBeGreaterThanOrEqual(1);
    });

    it("shows owner name for taken departments", async () => {
      useEvent.mockReturnValue({ activeEvent: { id: "ev-1" }, eventoId: "ev-1", clearEvent: vi.fn() });
      mockState.eventoDeptsResult = {
        data: [{
          department: {
            id: "d-1", name: "Indicadores", slug: "indicadores",
            coordenador_id: "other-user",
            coordenador: { name: "Ana Souza" },
          },
        }],
        error: null,
      };

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Responsável: Ana Souza.")).toBeDefined();
      });
      expect(screen.getAllByText("Ocupado").length).toBeGreaterThanOrEqual(1);
    });

    it("claims a free department and switches to active state", async () => {
      createDepartment.mockResolvedValue({ id: "d-3", name: "Contas", slug: "contas" });
      mockState.deptBySlugResult = {
        data: { id: "d-3", name: "Contas", slug: "contas" },
        error: null,
      };

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Contas/ })).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: /Contas/ }));

      await waitFor(() => {
        expect(screen.getByTestId("confirm-modal")).toBeDefined();
      });

      fireEvent.click(screen.getByText("Confirmar"));

      await waitFor(() => {
        expect(createDepartment).toHaveBeenCalledWith("Contas", "contas", null);
        expect(authDefaults.selectDepartment).toHaveBeenCalled();
      });
    });

    it("shows toast when clicking a taken department", async () => {
      useEvent.mockReturnValue({ activeEvent: { id: "ev-1" }, eventoId: "ev-1", clearEvent: vi.fn() });
      mockState.eventoDeptsResult = {
        data: [{
          department: {
            id: "d-1", name: "Indicadores", slug: "indicadores",
            coordenador_id: "other-user",
            coordenador: { name: "Ana Souza" },
          },
        }],
        error: null,
      };

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Ocupado")).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: /Indicadores/ }));

      await waitFor(() => {
        expect(screen.getByText("Este departamento já possui um coordenador. Ana Souza.")).toBeDefined();
      });
    });

    it("shows Ocupado even when coordenador name is null (profile join failed)", async () => {
      useEvent.mockReturnValue({ activeEvent: { id: "ev-1" }, eventoId: "ev-1", clearEvent: vi.fn() });
      mockState.eventoDeptsResult = {
        data: [{
          department: {
            id: "d-1", name: "Indicadores", slug: "indicadores",
            coordenador_id: "other-user",
            coordenador: null,
          },
        }],
        error: null,
      };

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Ocupado")).toBeDefined();
      });
      const indicadoresCard = screen.getByRole("button", { name: /Indicadores/ });
      expect(indicadoresCard.textContent).toContain("Ocupado");
      expect(indicadoresCard.textContent).not.toContain("Disponível");
      expect(indicadoresCard.textContent).toContain("Responsável: Coordenador.");
    });

    it("does NOT open claim modal when clicking occupied department", async () => {
      useEvent.mockReturnValue({ activeEvent: { id: "ev-1" }, eventoId: "ev-1", clearEvent: vi.fn() });
      mockState.eventoDeptsResult = {
        data: [{
          department: {
            id: "d-1", name: "Indicadores", slug: "indicadores",
            coordenador_id: "other-user",
            coordenador: { name: "Ana Souza" },
          },
        }],
        error: null,
      };

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Ocupado")).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: /Indicadores/ }));

      await waitFor(() => {
        expect(screen.getByText("Este departamento já possui um coordenador. Ana Souza.")).toBeDefined();
      });
      expect(screen.queryByTestId("confirm-modal")).toBeNull();
    });

    it("shows Disponível for departments with coordenador_id null", async () => {
      useEvent.mockReturnValue({ activeEvent: { id: "ev-1" }, eventoId: "ev-1", clearEvent: vi.fn() });
      mockState.eventoDeptsResult = {
        data: [{
          department: {
            id: "d-1", name: "Indicadores", slug: "indicadores",
            coordenador_id: null,
            coordenador: null,
          },
        }],
        error: null,
      };

      renderDashboard();
      await waitFor(() => {
        const indicadoresCard = screen.getByRole("button", { name: /Indicadores/ });
        expect(indicadoresCard.textContent).toContain("Disponível");
        expect(indicadoresCard.textContent).not.toContain("Ocupado");
      });
    });

    it("selects own department on click directly", async () => {
      useEvent.mockReturnValue({ activeEvent: { id: "ev-1" }, eventoId: "ev-1", clearEvent: vi.fn() });
      useAuth.mockReturnValue({
        ...authDefaults,
        departments: [
          { id: "dm-1", role: "coordenador", evento_id: "ev-1", user_id: "user-1", department: { id: "d-1", name: "Indicadores", slug: "indicadores" } },
        ],
      });
      mockState.eventoDeptsResult = {
        data: [{
          department: {
            id: "d-1", name: "Indicadores", slug: "indicadores",
            coordenador_id: "user-1",
            coordenador: { name: "Carlos" },
          },
        }],
        error: null,
      };

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Seu departamento")).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: /Indicadores/ }));

      await waitFor(() => {
        expect(authDefaults.selectDepartment).toHaveBeenCalled();
      });
      expect(screen.queryByTestId("confirm-modal")).toBeNull();
    });
  });

  describe("active state (department selected)", () => {
    const deptAuth = {
      ...authDefaults,
      departments: [
        { id: "dm-1", role: "coordenador", department: { id: "d-1", name: "Indicadores", slug: "indicadores" } },
      ],
      activeDepartment: { id: "dm-1", role: "coordenador", department: { id: "d-1", name: "Indicadores", slug: "indicadores" } },
    };

    it("shows department name as title", () => {
      useAuth.mockReturnValue(deptAuth);
      renderDashboard();
      expect(screen.getByText("Indicadores")).toBeDefined();
      expect(screen.getByText("Painel do Coordenador")).toBeDefined();
    });

    it("shows stat cards for the department", async () => {
      useAuth.mockReturnValue(deptAuth);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Voluntários")).toBeDefined();
      });
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

    it("shows event type label from context", () => {
      useAuth.mockReturnValue(deptAuth);
      renderDashboard();
      expect(screen.getByText("Painel do Coordenador")).toBeDefined();
    });
  });
});
