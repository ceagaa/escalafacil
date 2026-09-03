import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GerenciarDepartamentos from "../pages/GerenciarDepartamentos";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1" },
    departments: [],
    refreshSession: vi.fn().mockResolvedValue(),
    selectDepartment: vi.fn(),
  })),
}));

vi.mock("../services/departmentService", () => ({
  createDepartment: vi.fn(),
  linkUserAsCoordinator: vi.fn(),
}));

import { useAuth } from "../context/AuthContext";
import { createDepartment, linkUserAsCoordinator } from "../services/departmentService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GerenciarDepartamentos", () => {
  it("renders the creation form", () => {
    render(<GerenciarDepartamentos />);
    expect(screen.getByText("Criar Departamento")).toBeDefined();
    expect(screen.getByPlaceholderText("Ex: Achados e Perdidos")).toBeDefined();
  });

  it("shows slug preview while typing", () => {
    render(<GerenciarDepartamentos />);
    const input = screen.getByPlaceholderText("Ex: Achados e Perdidos");
    fireEvent.change(input, { target: { value: "Achados e Perdidos" } });
    expect(screen.getByText("achados-e-perdidos")).toBeDefined();
  });

  it("calls createDepartment and linkUserAsCoordinator on submit", async () => {
    createDepartment.mockResolvedValue({ id: "d-1", name: "Achados e Perdidos" });
    linkUserAsCoordinator.mockResolvedValue();

    render(<GerenciarDepartamentos />);
    const input = screen.getByPlaceholderText("Ex: Achados e Perdidos");
    fireEvent.change(input, { target: { value: "Achados e Perdidos" } });
    fireEvent.click(screen.getByText("Criar e Vincular"));

    await waitFor(() => {
      expect(createDepartment).toHaveBeenCalledWith("Achados e Perdidos");
      expect(linkUserAsCoordinator).toHaveBeenCalledWith("d-1", "user-1");
    });
  });

  it("displays error message on unique constraint violation", async () => {
    createDepartment.mockRejectedValue(
      new Error("Este nome de departamento já está em uso por outra equipe. Escolha outro nome ou contate os administradores.")
    );

    render(<GerenciarDepartamentos />);
    const input = screen.getByPlaceholderText("Ex: Achados e Perdidos");
    fireEvent.change(input, { target: { value: "Achados e Perdidos" } });
    fireEvent.click(screen.getByText("Criar e Vincular"));

    await waitFor(() => {
      expect(screen.getByText(/já está em uso/)).toBeDefined();
    });
  });

  it("shows existing departments list", () => {
    useAuth.mockReturnValue({
      user: { id: "user-1" },
      departments: [
        { id: "dm-1", role: "coordenador", department: { id: "d-1", name: "Ministério Jovem" } },
      ],
      refreshSession: vi.fn(),
      selectDepartment: vi.fn(),
    });

    render(<GerenciarDepartamentos />);
    expect(screen.getByText("Ministério Jovem")).toBeDefined();
    expect(screen.getByText("coordenador")).toBeDefined();
  });
});
