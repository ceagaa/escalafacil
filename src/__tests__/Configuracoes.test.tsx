import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Configuracoes from "../pages/Configuracoes";
import { ThemeProvider } from "../context/ThemeContext";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../services/departmentService", () => ({
  findProfileByEmail: vi.fn(),
  addDepartmentMember: vi.fn(),
  listDepartmentMembers: vi.fn().mockResolvedValue([]),
  removeDepartmentMember: vi.fn(),
}));

import { useAuth } from "../context/AuthContext";
import {
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
      name: "Indicadores",
      slug: "indicadores",
    },
  },
  refreshDepartments: vi.fn().mockResolvedValue([]),
};

beforeEach(() => {
  vi.clearAllMocks();
  (listDepartmentMembers as any).mockResolvedValue([]);
  Object.defineProperty(window.navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

function renderConfiguracoes() {
  return render(
    <ThemeProvider>
      <Configuracoes />
    </ThemeProvider>
  );
}

describe("Configuracoes", () => {
  it("blocks access for non-coordinators", () => {
    (useAuth as any).mockReturnValue({
      ...coordinatorAuth,
      activeDepartment: { ...coordinatorAuth.activeDepartment, role: "assistente" },
    });
    renderConfiguracoes();
    expect(screen.getByText("Acesso restrito a coordenadores")).toBeDefined();
    expect(screen.getByRole("group", { name: "Tema do aplicativo" })).toBeDefined();
    expect(screen.queryByText("Gestão de Equipe")).toBeNull();
  });

  it("renders team management for coordinators", async () => {
    (useAuth as any).mockReturnValue(coordinatorAuth);
    renderConfiguracoes();
    await waitFor(() => {
      expect(screen.getByText("Gestão de Equipe")).toBeDefined();
    });
  });

  it("shows app version and opens the privacy policy", () => {
    (useAuth as any).mockReturnValue(coordinatorAuth);
    renderConfiguracoes();

    expect(screen.getByText("Versão do aplicativo")).toBeDefined();
    expect(screen.getByText("1.2.1")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Política de Privacidade/ }));
    expect(screen.getByRole("dialog", { name: "Política de Privacidade e LGPD" })).toBeDefined();
  });

  it("renders the public scale link section", () => {
    (useAuth as any).mockReturnValue(coordinatorAuth);
    renderConfiguracoes();
    expect(screen.getByText("Link público da escala")).toBeDefined();
    expect(screen.getByText(/indicadores\/escala/)).toBeDefined();
    expect(screen.getByText("Compartilhar no WhatsApp")).toBeDefined();
  });

  it("copies the public scale link to clipboard", async () => {
    (useAuth as any).mockReturnValue(coordinatorAuth);
    renderConfiguracoes();
    fireEvent.click(screen.getByText("Copiar"));
    await waitFor(() => {
      expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("/indicadores/escala")
      );
      expect(screen.getByText("Copiado!")).toBeDefined();
    });
  });

  it("shows fallback when department has no slug", () => {
    (useAuth as any).mockReturnValue({
      ...coordinatorAuth,
      activeDepartment: {
        ...coordinatorAuth.activeDepartment,
        department: { id: "dept-1", name: "Indicadores", slug: null },
      },
    });
    renderConfiguracoes();
    expect(
      screen.getByText("Este departamento ainda não possui um link público.")
    ).toBeDefined();
  });

  it("lists existing members with roles", async () => {
    (useAuth as any).mockReturnValue(coordinatorAuth);
    (listDepartmentMembers as any).mockResolvedValue([
      { id: "dm-1", role: "coordenador", profiles: { email: "coord@example.com" } },
      { id: "dm-2", role: "assistente", profiles: { email: "assist@example.com" } },
    ]);
    renderConfiguracoes();
    await waitFor(() => {
      expect(screen.getByText("coord@example.com")).toBeDefined();
      expect(screen.getByText("assist@example.com")).toBeDefined();
    });
  });

  it("adds an assistant by email", async () => {
    (useAuth as any).mockReturnValue(coordinatorAuth);
    (findProfileByEmail as any).mockResolvedValue({ id: "user-2", email: "assist@example.com" });
    (addDepartmentMember as any).mockResolvedValue();
    (listDepartmentMembers as any).mockResolvedValue([
      { id: "dm-2", role: "assistente", profiles: { email: "assist@example.com" } },
    ]);
    renderConfiguracoes();
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
    (useAuth as any).mockReturnValue(coordinatorAuth);
    (findProfileByEmail as any).mockResolvedValue(null);
    renderConfiguracoes();
    const input = screen.getByPlaceholderText("email@exemplo.com");
    fireEvent.change(input, { target: { value: "nobody@example.com" } });
    fireEvent.click(screen.getByText("Adicionar"));
    await waitFor(() => {
      expect(screen.getByText("Nenhum usuário encontrado com este e-mail.")).toBeDefined();
    });
    expect(addDepartmentMember).not.toHaveBeenCalled();
  });
});
