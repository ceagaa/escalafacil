import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Configuracoes from "../pages/Configuracoes";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../services/departmentService", () => ({
  updateDepartmentFeatures: vi.fn(),
  findProfileByEmail: vi.fn(),
  addDepartmentMember: vi.fn(),
  listDepartmentMembers: vi.fn().mockResolvedValue([]),
  removeDepartmentMember: vi.fn(),
}));

import { useAuth } from "../context/AuthContext";
import {
  updateDepartmentFeatures,
  findProfileByEmail,
  addDepartmentMember,
  listDepartmentMembers,
} from "../services/departmentService";

const coordinatorAuth = {
  user: { id: "user-1" },
  activeDepartment: {
    id: "dm-1",
    role: "coordenador",
    department: {
      id: "dept-1",
      name: "Achados e Perdidos",
      slug: "achados-perdidos-guarda-volumes",
      features: { lostItems: true },
    },
  },
  refreshDepartments: vi.fn().mockResolvedValue([]),
};

beforeEach(() => {
  vi.clearAllMocks();
  listDepartmentMembers.mockResolvedValue([]);
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue() },
    configurable: true,
  });
});

describe("Configuracoes", () => {
  it("blocks access for non-coordinators", () => {
    useAuth.mockReturnValue({
      ...coordinatorAuth,
      activeDepartment: { ...coordinatorAuth.activeDepartment, role: "assistente" },
    });
    render(<Configuracoes />);
    expect(screen.getByText("Acesso restrito a coordenadores")).toBeDefined();
    expect(screen.queryByText("Módulos do departamento")).toBeNull();
  });

  it("renders feature flags and team management for coordinators", async () => {
    useAuth.mockReturnValue(coordinatorAuth);
    render(<Configuracoes />);
    await waitFor(() => {
      expect(screen.getByText("Módulo de Achados e Perdidos")).toBeDefined();
      expect(screen.getByText("Gestão de Equipe")).toBeDefined();
    });
  });

  it("renders the public scale link section", () => {
    useAuth.mockReturnValue(coordinatorAuth);
    render(<Configuracoes />);
    expect(screen.getByText("Link público da escala")).toBeDefined();
    expect(screen.getByText(/achados-perdidos-guarda-volumes\/escala/)).toBeDefined();
    expect(screen.getByText("Compartilhar no WhatsApp")).toBeDefined();
  });

  it("copies the public scale link to clipboard", async () => {
    useAuth.mockReturnValue(coordinatorAuth);
    render(<Configuracoes />);
    fireEvent.click(screen.getByText("Copiar"));
    await waitFor(() => {
      expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("/achados-perdidos-guarda-volumes/escala")
      );
      expect(screen.getByText("Copiado!")).toBeDefined();
    });
  });

  it("shows fallback when department has no slug", () => {
    useAuth.mockReturnValue({
      ...coordinatorAuth,
      activeDepartment: {
        ...coordinatorAuth.activeDepartment,
        department: { id: "dept-1", name: "Achados e Perdidos", features: { lostItems: true } },
      },
    });
    render(<Configuracoes />);
    expect(
      screen.getByText("Este departamento ainda não possui um link público.")
    ).toBeDefined();
  });

  it("lists existing members with roles", async () => {
    useAuth.mockReturnValue(coordinatorAuth);
    listDepartmentMembers.mockResolvedValue([
      { id: "dm-1", role: "coordenador", profiles: { email: "coord@example.com" } },
      { id: "dm-2", role: "assistente", profiles: { email: "assist@example.com" } },
    ]);
    render(<Configuracoes />);
    await waitFor(() => {
      expect(screen.getByText("coord@example.com")).toBeDefined();
      expect(screen.getByText("assist@example.com")).toBeDefined();
    });
  });

  it("toggles the lost items feature flag", async () => {
    useAuth.mockReturnValue(coordinatorAuth);
    updateDepartmentFeatures.mockResolvedValue({});
    render(<Configuracoes />);
    const toggle = screen.getByLabelText("Alternar módulo de achados e perdidos");
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(updateDepartmentFeatures).toHaveBeenCalledWith("dept-1", { lostItems: false });
      expect(coordinatorAuth.refreshDepartments).toHaveBeenCalled();
    });
  });

  it("adds an assistant by email", async () => {
    useAuth.mockReturnValue(coordinatorAuth);
    findProfileByEmail.mockResolvedValue({ id: "user-2", email: "assist@example.com" });
    addDepartmentMember.mockResolvedValue();
    listDepartmentMembers.mockResolvedValue([
      { id: "dm-2", role: "assistente", profiles: { email: "assist@example.com" } },
    ]);
    render(<Configuracoes />);
    const input = screen.getByPlaceholderText("email@exemplo.com");
    fireEvent.change(input, { target: { value: "assist@example.com" } });
    fireEvent.click(screen.getByText("Adicionar"));
    await waitFor(() => {
      expect(findProfileByEmail).toHaveBeenCalledWith("assist@example.com");
      expect(addDepartmentMember).toHaveBeenCalledWith("dept-1", "user-2", "assistente");
      expect(screen.getByText("Assistente adicionado com sucesso!")).toBeDefined();
    });
  });

  it("shows error when the email is not found", async () => {
    useAuth.mockReturnValue(coordinatorAuth);
    findProfileByEmail.mockResolvedValue(null);
    render(<Configuracoes />);
    const input = screen.getByPlaceholderText("email@exemplo.com");
    fireEvent.change(input, { target: { value: "nobody@example.com" } });
    fireEvent.click(screen.getByText("Adicionar"));
    await waitFor(() => {
      expect(screen.getByText("Nenhum usuário encontrado com este e-mail.")).toBeDefined();
    });
    expect(addDepartmentMember).not.toHaveBeenCalled();
  });
});
