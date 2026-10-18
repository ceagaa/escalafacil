import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../context/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../context/EventContext", () => ({ useEvent: vi.fn() }));

import MeusDepartamentos from "../pages/MeusDepartamentos";
import { useAuth } from "../context/AuthContext";
import { useEvent } from "../context/EventContext";

const authDefaults = {
  user: { id: "user-1" },
  departments: [],
  activeDepartment: null,
  selectDepartment: vi.fn(),
};

function membership(id, deptId, name, role, eventoId = "ev-1") {
  return {
    id,
    role,
    evento_id: eventoId,
    department: { id: deptId, name, slug: name.toLowerCase() },
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/meus-departamentos"]}>
      <MeusDepartamentos />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue(authDefaults);
  useEvent.mockReturnValue({ eventoId: "ev-1" });
});

describe("MeusDepartamentos", () => {
  it("lista os departamentos assumidos pelo usuário", () => {
    useAuth.mockReturnValue({
      ...authDefaults,
      departments: [
        membership("dm-1", "d-1", "Contas", "coordenador"),
        membership("dm-2", "d-2", "Batismo", "assistente"),
      ],
    });

    renderPage();

    expect(screen.getByText("Contas")).toBeDefined();
    expect(screen.getByText("Batismo")).toBeDefined();
    expect(screen.getByText("Coordenador")).toBeDefined();
    expect(screen.getByText("Assistente")).toBeDefined();
  });

  it("troca o departamento ativo e vai para o Resumo sem confirmação", () => {
    const dm = membership("dm-1", "d-1", "Contas", "coordenador");
    useAuth.mockReturnValue({ ...authDefaults, departments: [dm] });

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Contas" }));

    expect(authDefaults.selectDepartment).toHaveBeenCalledWith(dm);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("marca o departamento ativo", () => {
    const dm = membership("dm-1", "d-1", "Contas", "coordenador");
    useAuth.mockReturnValue({
      ...authDefaults,
      departments: [dm],
      activeDepartment: dm,
    });

    renderPage();
    expect(screen.getByText("Ativo agora")).toBeDefined();
  });

  it("mostra estado vazio com atalho para departamentos disponíveis", () => {
    renderPage();

    expect(screen.getByText("Nenhum departamento assumido ainda")).toBeDefined();
    fireEvent.click(screen.getByText("Ver departamentos disponíveis"));
    expect(mockNavigate).toHaveBeenCalledWith("/departamentos");
  });
});
