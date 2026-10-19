import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockFetchEventDepartments = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../services/departmentService", () => ({
  createDepartment: vi.fn(),
  linkUserAsCoordinator: vi.fn(),
  claimDepartmentForEvento: vi.fn(),
  getEventoDepartmentOwner: vi.fn().mockResolvedValue(null),
  revokeDepartmentCoordinator: vi.fn(),
}));

vi.mock("../services/eventService", () => ({
  linkDepartmentToEvento: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../context/EventContext", () => ({
  useEvent: vi.fn(),
}));

vi.mock("../components/ConfirmModal", () => ({
  __esModule: true,
  default: ({ title, message, onCancel, onConfirm }: any) => (
    <div data-testid="confirm-modal">
      <p>{title}</p>
      <p>{message}</p>
      <button onClick={onCancel}>Cancelar</button>
      <button onClick={onConfirm}>Confirmar</button>
    </div>
  ),
}));

import Dashboard from "../pages/Dashboard";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";
import { claimDepartmentForEvento, getEventoDepartmentOwner } from "../services/departmentService";
import { groupDepartments } from "../services/dashboardDepartments";

vi.mock("../services/dashboardDepartments", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return { ...actual, fetchEventDepartments: mockFetchEventDepartments };
});

const authDefaults = {
  user: { id: "user-1" },
  profile: { id: "user-1", name: "Carlos" },
  departments: [],
  activeDepartment: null,
  selectDepartment: vi.fn(),
  refreshSession: vi.fn().mockResolvedValue([]),
  fetchCoordinatedDepartmentIds: vi.fn().mockResolvedValue([]),
};

function dept(id: any, name: any, slug: any, owner: any = null, ownerName: any = null) {
  return {
    id,
    name,
    slug,
    coordenador_id: owner,
    coordenador: ownerName ? { name: ownerName } : null,
  };
}

function renderDashboard(props = {}) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Dashboard {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (useAuth as any).mockReturnValue(authDefaults);
  (useEvent as any).mockReturnValue({ activeEvent: null, eventoId: null, clearEvent: vi.fn() });
  (getEventoDepartmentOwner as any).mockResolvedValue(null);
  mockFetchEventDepartments.mockResolvedValue([]);
});

describe("groupDepartments", () => {
  it("separa em meus, disponíveis e em uso por outros", () => {
    const list = [
      dept("d-1", "Contas", "contas", "user-1", "Carlos"),
      dept("d-2", "Indicadores", "indicadores", "user-2", "Ana"),
      dept("d-3", "Batismo", "batismo"),
    ];
    const { mine, takenByOthers, available } = groupDepartments(list, "user-1");
    expect(mine.map((d) => d.id)).toEqual(["d-1"]);
    expect(takenByOthers.map((d) => d.id)).toEqual(["d-2"]);
    expect(available.map((d) => d.id)).toEqual(["d-3"]);
  });

  it("ignora registros nulos", () => {
    const { available } = groupDepartments([null, dept("d-3", "Batismo", "batismo")] as any, "user-1");
    expect(available).toHaveLength(1);
  });
});

describe("Dashboard", () => {
  describe("tela de escolha de departamento", () => {
    beforeEach(() => {
      (useEvent as any).mockReturnValue({ activeEvent: { id: "ev-1" }, eventoId: "ev-1", clearEvent: vi.fn() });
    });

    it("mostra as três seções conforme quem coordena", async () => {
      mockFetchEventDepartments.mockResolvedValue([
        dept("d-1", "Contas", "contas", "user-1", "Carlos"),
        dept("d-2", "Indicadores", "indicadores", "user-2", "Ana Souza"),
        dept("d-3", "Batismo", "batismo"),
      ]);

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("Contas")).toBeDefined();
      });
      expect(screen.getByText(/Meus departamentos/)).toBeDefined();
      expect(screen.getByText(/Disponíveis/)).toBeDefined();
      expect(screen.getByText(/Ocupados/)).toBeDefined();
    });

    it("marca o departamento próprio como Coordenando", async () => {
      mockFetchEventDepartments.mockResolvedValue([dept("d-1", "Contas", "contas", "user-1", "Carlos")]);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Coordenando")).toBeDefined();
      });
    });

    it("mostra o nome do coordenador no card de departamento ocupado", async () => {
      mockFetchEventDepartments.mockResolvedValue([dept("d-2", "Indicadores", "indicadores", "user-2", "Ana Souza")]);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Coordenador: Ana Souza.")).toBeDefined();
      });
      expect(screen.getByText("Ocupado")).toBeDefined();
    });

    it("não permite assumir um departamento ocupado por outro (card inerte)", async () => {
      mockFetchEventDepartments.mockResolvedValue([dept("d-2", "Indicadores", "indicadores", "user-2", "Ana Souza")]);
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("Ocupado")).toBeDefined();
      });

      const card = screen.getByRole("button", { name: "Indicadores" });
      expect((card as HTMLButtonElement).disabled).toBe(true);

      fireEvent.click(card);
      expect(screen.queryByTestId("confirm-modal")).toBeNull();
    });

    it("mostra 'Você já está coordenando este departamento.' no card próprio", async () => {
      mockFetchEventDepartments.mockResolvedValue([dept("d-1", "Contas", "contas", "user-1", "Carlos")]);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Você já está coordenando este departamento.")).toBeDefined();
      });
    });

    it("reconhece o próprio departamento mesmo quando o fetch principal não traz o coordenador", async () => {
      // Simula o cenário do bug: o join/fetch de owners falhou e o card vem
      // sem coordenador — a rede de segurança (fetchCoordinatedDepartmentIds)
      // precisa marcá-lo como "Coordenando", nunca "Disponível".
      mockFetchEventDepartments.mockResolvedValue([dept("d-1", "Contas", "contas")]);
      (useAuth as any).mockReturnValue({
        ...authDefaults,
        fetchCoordinatedDepartmentIds: vi.fn().mockResolvedValue(["d-1"]),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("Coordenando")).toBeDefined();
      });
      expect(screen.queryByText("Disponível")).toBeNull();
    });

    it("mostra card ocupado SEM nome quando o perfil do coordenador não pôde ser lido", async () => {
      mockFetchEventDepartments.mockResolvedValue([dept("d-2", "Indicadores", "indicadores", "user-2")]);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Ocupado")).toBeDefined();
      });
      expect(screen.getByText("Já possui um coordenador neste evento.")).toBeDefined();
      expect((screen.getByRole("button", { name: "Indicadores" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("abre o painel direto ao clicar no próprio departamento, sem confirmação", async () => {
      mockFetchEventDepartments.mockResolvedValue([dept("d-1", "Contas", "contas", "user-1", "Carlos")]);
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("Coordenando")).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: "Contas" }));

      await waitFor(() => {
        expect(authDefaults.selectDepartment).toHaveBeenCalled();
      });
      expect(screen.queryByTestId("confirm-modal")).toBeNull();
    });

    it("pede confirmação para assumir um departamento disponível", async () => {
      mockFetchEventDepartments.mockResolvedValue([dept("d-3", "Batismo", "batismo")]);

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("Disponível")).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: "Batismo" }));

      await waitFor(() => {
        expect(screen.getByTestId("confirm-modal")).toBeDefined();
      });

      fireEvent.click(screen.getByText("Confirmar"));

      await waitFor(() => {
        expect(claimDepartmentForEvento).toHaveBeenCalledWith("d-3", "ev-1", "user-1");
      });
    });

    it("entra direto no painel quando o usuário coordena exatamente um departamento do evento", async () => {
      mockFetchEventDepartments.mockResolvedValue([
        dept("d-1", "Contas", "contas", "user-1", "Carlos"),
        dept("d-2", "Indicadores", "indicadores", "user-2", "Ana Souza"),
      ]);

      renderDashboard();

      await waitFor(() => {
        expect(authDefaults.selectDepartment).toHaveBeenCalled();
      });
      const membership = authDefaults.selectDepartment.mock.calls[0][0];
      expect(membership.department_id).toBe("d-1");
      expect(membership.role).toBe("coordenador");
    });

    it("NÃO entra automaticamente quando o usuário coordena mais de um departamento", async () => {
      mockFetchEventDepartments.mockResolvedValue([
        dept("d-1", "Contas", "contas", "user-1", "Carlos"),
        dept("d-2", "Batismo", "batismo", "user-1", "Carlos"),
      ]);

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("Contas")).toBeDefined();
      });
      expect(authDefaults.selectDepartment).not.toHaveBeenCalled();
    });

    it("não consulta o banco enquanto não há evento ativo", async () => {
      (useEvent as any).mockReturnValue({ activeEvent: null, eventoId: null, clearEvent: vi.fn() });
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText("Bem-vindo!")).toBeDefined();
      });
      expect(mockFetchEventDepartments).not.toHaveBeenCalled();
    });
  });

  describe("grade forçada (/departamentos)", () => {
    const deptAuth = {
      ...authDefaults,
      activeDepartment: {
        id: "dm-1",
        role: "coordenador",
        department: { id: "d-1", name: "Contas", slug: "contas" },
      },
    };

    beforeEach(() => {
      (useEvent as any).mockReturnValue({ activeEvent: { id: "ev-1" }, eventoId: "ev-1", clearEvent: vi.fn() });
      (useAuth as any).mockReturnValue(deptAuth);
    });

    it("mostra a grade de departamentos mesmo com departamento ativo", async () => {
      mockFetchEventDepartments.mockResolvedValue([
        dept("d-1", "Contas", "contas", "user-1", "Carlos"),
        dept("d-3", "Batismo", "batismo"),
      ]);

      renderDashboard({ forcePicker: true });

      await waitFor(() => {
        expect(screen.getByText("Departamentos")).toBeDefined();
      });
      expect(screen.queryByText("Painel do Coordenador")).toBeNull();
      expect(screen.getByText("Coordenando")).toBeDefined();
      expect(screen.getByText("Disponível")).toBeDefined();
    });

    it("volta para o Resumo ao clicar no próprio departamento, sem confirmação", async () => {
      mockFetchEventDepartments.mockResolvedValue([dept("d-1", "Contas", "contas", "user-1", "Carlos")]);

      renderDashboard({ forcePicker: true });

      await waitFor(() => {
        expect(screen.getByText("Coordenando")).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: "Contas" }));

      expect(mockNavigate).toHaveBeenCalledWith("/");
      expect(screen.queryByTestId("confirm-modal")).toBeNull();
    });

    it("assume um disponível e vai direto para o Resumo", async () => {
      mockFetchEventDepartments.mockResolvedValue([dept("d-3", "Batismo", "batismo")]);

      renderDashboard({ forcePicker: true });

      await waitFor(() => {
        expect(screen.getByText("Disponível")).toBeDefined();
      });

      fireEvent.click(screen.getByRole("button", { name: "Batismo" }));
      await waitFor(() => {
        expect(screen.getByTestId("confirm-modal")).toBeDefined();
      });
      fireEvent.click(screen.getByText("Confirmar"));

      await waitFor(() => {
        expect(claimDepartmentForEvento).toHaveBeenCalledWith("d-3", "ev-1", "user-1");
      });
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    it("NÃO troca o departamento ativo automaticamente na grade", async () => {
      mockFetchEventDepartments.mockResolvedValue([dept("d-1", "Contas", "contas", "user-1", "Carlos")]);

      renderDashboard({ forcePicker: true });

      await waitFor(() => {
        expect(screen.getByText("Coordenando")).toBeDefined();
      });
      expect(authDefaults.selectDepartment).not.toHaveBeenCalled();
    });
  });

  describe("painel do coordenador", () => {
    const deptAuth = {
      ...authDefaults,
      departments: [
        { id: "dm-1", role: "coordenador", department: { id: "d-1", name: "Indicadores", slug: "indicadores" } },
      ],
      activeDepartment: {
        id: "dm-1",
        role: "coordenador",
        department: { id: "d-1", name: "Indicadores", slug: "indicadores" },
      },
    };

    it("mostra o nome do departamento como título", () => {
      (useAuth as any).mockReturnValue(deptAuth);
      renderDashboard();
      expect(screen.getByText("Indicadores")).toBeDefined();
      expect(screen.getByText("Painel do Coordenador")).toBeDefined();
    });

    it("mostra os cards de voluntários e turnos", async () => {
      (useAuth as any).mockReturnValue(deptAuth);
      renderDashboard();
      await waitFor(() => {
        expect(screen.getByText("Voluntários")).toBeDefined();
      });
      expect(screen.getByText("Turnos")).toBeDefined();
    });

    it("mostra os links públicos com botões de WhatsApp", () => {
      (useAuth as any).mockReturnValue(deptAuth);
      renderDashboard();
      expect(screen.getByText("Cadastro de Voluntários")).toBeDefined();
      expect(screen.getByText("Escala Pública")).toBeDefined();
      expect(screen.getAllByText("WhatsApp").length).toBeGreaterThanOrEqual(2);
    });

    it("mostra os atalhos de módulo", () => {
      (useAuth as any).mockReturnValue(deptAuth);
      renderDashboard();
      expect(screen.getByText("Gestão de Escalas")).toBeDefined();
      expect(screen.getByText("Equipe e Aprovação")).toBeDefined();
      expect(screen.getByText("Configurações")).toBeDefined();
    });
  });
});
