import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublicCadastro from "../pages/PublicCadastro";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("../services/api", () => {
  class ApiError extends Error {
    status: number;
    code?: string;
    safe: boolean;
    constructor(message: string, status = 400, code?: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.safe = status > 0 && status < 500;
    }
  }
  return {
    apiGet: mocks.apiGet,
    apiPost: mocks.apiPost,
    apiPatch: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
    apiData: vi.fn(),
    apiRequest: vi.fn(),
    ApiError,
  };
});

import { ApiError } from "../services/api";

function renderWithSlug(slug = "indicadores") {
  return render(
    <MemoryRouter initialEntries={[`/${slug}/cadastro`]}>
      <PublicCadastro />
    </MemoryRouter>
  );
}

/** Responde GETs: departamento por slug, links do departamento, evento. */
function configureDept({
  department,
  links = null,
  evento = null,
}: {
  department: any;
  links?: any;
  evento?: any;
}) {
  mocks.apiGet.mockImplementation(async (path: string) => {
    if (path.endsWith("/links")) return links;
    if (path.startsWith("/api/public/eventos")) return evento;
    return department;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("PublicCadastro", () => {
  it("shows loading state initially", () => {
    configureDept({ department: null });
    renderWithSlug();
    expect(screen.getByText("Carregando...")).toBeDefined();
  });

  it("shows not found when slug is invalid", async () => {
    configureDept({ department: null });
    renderWithSlug("invalid-slug");
    await waitFor(() => {
      expect(screen.getByText("Departamento não encontrado")).toBeDefined();
    });
  });

  it("shows not found when the API answers 404", async () => {
    mocks.apiGet.mockRejectedValue(new ApiError("Departamento não encontrado.", 404));
    renderWithSlug("invalid-slug");
    await waitFor(() => {
      expect(screen.getByText("Departamento não encontrado")).toBeDefined();
    });
  });

  it("renders form when department is found", async () => {
    configureDept({ department: { id: "d-1", name: "Indicadores" } });
    renderWithSlug();
    await waitFor(() => {
      expect(screen.getByText("Seja um Voluntário")).toBeDefined();
      expect(screen.getByText("Indicadores")).toBeDefined();
      expect(screen.getByPlaceholderText("Seu nome")).toBeDefined();
      expect(screen.getByPlaceholderText("Nome da congregação")).toBeDefined();
      expect(screen.getByPlaceholderText("+55 99999-9999")).toBeDefined();
    });
  });

  it("renders all 6 availability slots for congresso (default)", async () => {
    configureDept({ department: { id: "d-1", name: "Test Dept" } });
    renderWithSlug();
    await waitFor(() => {
      expect(screen.getAllByText("Sexta-feira").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Sábado").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Domingo").length).toBeGreaterThanOrEqual(1);
    });
    const manhaButtons = screen.getAllByText("Manhã");
    const tardeButtons = screen.getAllByText("Tarde");
    expect(manhaButtons.length).toBe(3);
    expect(tardeButtons.length).toBe(3);
  });

  it("toggles availability slot on click", async () => {
    configureDept({ department: { id: "d-1", name: "Test Dept" } });
    renderWithSlug();
    await waitFor(() => {
      expect(screen.getAllByText("Sexta-feira").length).toBeGreaterThanOrEqual(1);
    });

    const sextaManha = screen.getAllByText("Manhã")[0].closest("button")!;
    fireEvent.click(sextaManha);
    expect(sextaManha.className).toContain("border-[var(--ef-accent)]");

    fireEvent.click(sextaManha);
    expect(sextaManha.className).toContain("border-slate-200");
  });

  it("shows validation error when submitting empty fields", async () => {
    configureDept({ department: { id: "d-1", name: "Test Dept" } });
    renderWithSlug();
    await waitFor(() => {
      expect(screen.getByText("Cadastrar")).toBeDefined();
    });

    const submitBtn = screen.getByText("Cadastrar");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Preencha todos os campos obrigatórios.")).toBeDefined();
    });
    expect(mocks.apiPost).not.toHaveBeenCalled();
  });

  it("submits form and shows success screen", async () => {
    configureDept({ department: { id: "d-1", name: "Indicadores" } });
    mocks.apiPost.mockResolvedValue({});

    renderWithSlug();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Seu nome")).toBeDefined();
    });

    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "João Silva" } });
    fireEvent.change(screen.getByPlaceholderText("Nome da congregação"), { target: { value: "Igreja Central" } });
    fireEvent.change(screen.getByPlaceholderText("+55 99999-9999"), { target: { value: "+55119999888" } });

    fireEvent.click(screen.getByText("Cadastrar"));

    await waitFor(() => {
      expect(mocks.apiPost).toHaveBeenCalledWith("/api/public/volunteers", {
        department_id: "d-1",
        name: "João Silva",
        congregation: "Igreja Central",
        phone: "+55 11999-9888",
        availability: [],
      });
      expect(screen.getByText("Cadastro recebido!")).toBeDefined();
      expect(screen.getByText(/Indicadores/)).toBeDefined();
    });
  });

  it("formats phone with DDI mask", async () => {
    configureDept({ department: { id: "d-1", name: "Test" } });
    renderWithSlug();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("+55 99999-9999")).toBeDefined();
    });

    const phoneInput = screen.getByPlaceholderText("+55 99999-9999");
    fireEvent.change(phoneInput, { target: { value: "55119999888" } });
    expect((phoneInput as HTMLInputElement).value).toBe("+55 11999-9888");
  });
});
