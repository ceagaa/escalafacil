import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PublicCadastro from "../pages/PublicCadastro";

const mockInsert = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock("../services/supabase.js", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mockMaybeSingle,
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: mockInsert,
    })),
  },
}));

function renderWithSlug(slug = "indicadores") {
  return render(
    <MemoryRouter initialEntries={[`/${slug}/cadastro`]}>
      <PublicCadastro />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockMaybeSingle.mockReset();
});

describe("PublicCadastro", () => {
  it("shows loading state initially", () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    renderWithSlug();
    expect(screen.getByText("Carregando...")).toBeDefined();
  });

  it("shows not found when slug is invalid", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    renderWithSlug("invalid-slug");
    await waitFor(() => {
      expect(screen.getByText("Departamento não encontrado")).toBeDefined();
    });
  });

  it("renders form when department is found", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: "d-1", name: "Indicadores" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
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
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: "d-1", name: "Test Dept" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
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
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: "d-1", name: "Test Dept" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    renderWithSlug();
    await waitFor(() => {
      expect(screen.getAllByText("Sexta-feira").length).toBeGreaterThanOrEqual(1);
    });

    const sextaManha = screen.getAllByText("Manhã")[0].closest("button")!;
    fireEvent.click(sextaManha);
    expect(sextaManha.className).toContain("border-[#42d27b]");

    fireEvent.click(sextaManha);
    expect(sextaManha.className).toContain("border-slate-200");
  });

  it("shows validation error when submitting empty fields", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: "d-1", name: "Test Dept" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    renderWithSlug();
    await waitFor(() => {
      expect(screen.getByText("Cadastrar")).toBeDefined();
    });

    const submitBtn = screen.getByText("Cadastrar");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Preencha todos os campos obrigatórios.")).toBeDefined();
    });
  });

  it("submits form and shows success screen", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: "d-1", name: "Indicadores" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });

    renderWithSlug();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Seu nome")).toBeDefined();
    });

    fireEvent.change(screen.getByPlaceholderText("Seu nome"), { target: { value: "João Silva" } });
    fireEvent.change(screen.getByPlaceholderText("Nome da congregação"), { target: { value: "Igreja Central" } });
    fireEvent.change(screen.getByPlaceholderText("+55 99999-9999"), { target: { value: "+55119999888" } });

    fireEvent.click(screen.getByText("Cadastrar"));

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith({
        department_id: "d-1",
        name: "João Silva",
        congregation: "Igreja Central",
        phone: "+55 11999-9888",
        availability: "[]",
        active: false,
      });
      expect(screen.getByText("Cadastro recebido!")).toBeDefined();
      expect(screen.getByText(/Indicadores/)).toBeDefined();
    });
  });

  it("formats phone with DDI mask", async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: { id: "d-1", name: "Test" }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    renderWithSlug();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("+55 99999-9999")).toBeDefined();
    });

    const phoneInput = screen.getByPlaceholderText("+55 99999-9999");
    fireEvent.change(phoneInput, { target: { value: "55119999888" } });
    expect((phoneInput as HTMLInputElement).value).toBe("+55 11999-9888");
  });
});
