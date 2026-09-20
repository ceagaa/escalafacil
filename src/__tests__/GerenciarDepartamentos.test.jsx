import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import GerenciarDepartamentos from "../pages/GerenciarDepartamentos";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "user-1" },
    departments: [],
    refreshSession: vi.fn().mockResolvedValue([]),
    selectDepartment: vi.fn(),
  })),
}));

vi.mock("../context/EventContext", () => ({
  useEvent: vi.fn(() => ({ activeEvent: null, eventoId: null, clearEvent: vi.fn() })),
}));

vi.mock("../services/departmentService", () => ({
  STANDARD_DEPARTMENTS: [
    { name: "Indicadores", slug: "indicadores" },
    { name: "Limpeza", slug: "limpeza" },
  ],
  createDepartment: vi.fn(),
  linkUserAsCoordinator: vi.fn(),
}));

vi.mock("../services/eventService", () => ({
  linkDepartmentToEvento: vi.fn(),
}));

import { useAuth } from "../context/AuthContext";
import { createDepartment, linkUserAsCoordinator } from "../services/departmentService";

beforeEach(() => {
  vi.clearAllMocks();
});

function selectOption(value) {
  const select = screen.getByRole("combobox");
  fireEvent.change(select, { target: { value } });
}

describe("GerenciarDepartamentos", () => {
  it("renders the claim form with a strict select of the 2 standard departments", () => {
    render(<GerenciarDepartamentos />);
    expect(
      screen.getByRole("heading", { name: "Reivindicar Departamento" })
    ).toBeDefined();
    expect(screen.getByRole("option", { name: "Indicadores" })).toBeDefined();
    expect(screen.getByRole("option", { name: "Limpeza" })).toBeDefined();
    expect(screen.queryByPlaceholderText("Ex: Indicadores")).toBeNull();
    expect(screen.getByRole("combobox").options).toHaveLength(3);
  });

  it("does not submit without a selected department", () => {
    render(<GerenciarDepartamentos />);
    fireEvent.click(screen.getByRole("button", { name: "Reivindicar Departamento" }));
    expect(createDepartment).not.toHaveBeenCalled();
  });

  it("calls createDepartment and linkUserAsCoordinator on submit", async () => {
    createDepartment.mockResolvedValue({
      id: "d-1",
      name: "Indicadores",
      slug: "indicadores",
    });
    linkUserAsCoordinator.mockResolvedValue();

    render(<GerenciarDepartamentos />);
    selectOption("indicadores");
    fireEvent.click(screen.getByRole("button", { name: "Reivindicar Departamento" }));

    await waitFor(() => {
      expect(createDepartment).toHaveBeenCalledWith("Indicadores", "indicadores");
      expect(linkUserAsCoordinator).toHaveBeenCalledWith("d-1", "user-1", null);
    });
  });

  it("displays the coordinator name on conflict message", async () => {
    createDepartment.mockRejectedValue(
      new Error("Departamento já criado. Responsável: Carlos Henrique")
    );

    render(<GerenciarDepartamentos />);
    selectOption("limpeza");
    fireEvent.click(screen.getByRole("button", { name: "Reivindicar Departamento" }));

    await waitFor(() => {
      expect(
        screen.getByText("Departamento já criado. Responsável: Carlos Henrique")
      ).toBeDefined();
    });
  });

  it("shows existing departments list", () => {
    useAuth.mockReturnValue({
      user: { id: "user-1" },
      departments: [
        { id: "dm-1", role: "coordenador", department: { id: "d-1", name: "Indicadores" } },
      ],
      refreshSession: vi.fn(),
      selectDepartment: vi.fn(),
    });

    render(<GerenciarDepartamentos />);
    const list = screen.getByText("Seus departamentos").closest("div");
    expect(within(list).getByText("Indicadores")).toBeDefined();
    expect(within(list).getByText("coordenador")).toBeDefined();
  });
});
