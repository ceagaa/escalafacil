import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PublicEscala from "../pages/PublicEscala";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
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
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiPut: vi.fn(),
    apiDelete: vi.fn(),
    apiData: vi.fn(),
    apiRequest: vi.fn(),
    ApiError,
  };
});

const scheduleBlocks = [
  { id: "sex-manha", day: "Sexta-feira", period: "Manhã", responsible: "Eduardo", accent: "sexta", department_id: "d-1" },
  { id: "sab-manha", day: "Sábado", period: "Manhã", responsible: "Carlos", accent: "sabado", department_id: "d-1" },
];

const shifts = [
  { id: "sex-m-1", block_id: "sex-manha", start_time: "8:00", end_time: "9:30", department_id: "d-1" },
  { id: "sab-m-1", block_id: "sab-manha", start_time: "8:00", end_time: "9:30", department_id: "d-1" },
];

const shiftVolunteers = [
  { shift_id: "sex-m-1", volunteer_id: "v-1", department_id: "d-1" },
];

const volunteers = [
  { id: "v-1", name: "João", active: true },
  { id: "v-2", name: "Maria", active: false },
];

function renderAt(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/${slug}/escala`]}>
      <Routes>
        <Route path="/:slug/escala" element={<PublicEscala />} />
      </Routes>
    </MemoryRouter>
  );
}

/** Responde GETs: departamento por slug e payload completo da escala. */
function configure({
  department,
  scheduleError,
}: {
  department: any;
  scheduleError?: unknown;
}) {
  mocks.apiGet.mockImplementation(async (path: string) => {
    if (path.endsWith("/schedule")) {
      if (scheduleError) throw scheduleError;
      return {
        blocks: scheduleBlocks,
        shifts,
        assignments: shiftVolunteers,
        volunteers,
      };
    }
    return department;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("PublicEscala", () => {
  it("shows loading state initially", () => {
    configure({ department: null });
    renderAt("indicadores");
    expect(screen.getByText("Carregando escala...")).toBeDefined();
  });

  it("shows not found for invalid slug", async () => {
    configure({ department: null });
    renderAt("slug-invalido");
    await waitFor(() => {
      expect(screen.getByText("Departamento não encontrado")).toBeDefined();
    });
  });

  it("renders the schedule with assigned volunteers, excluding inactive", async () => {
    configure({ department: { id: "d-1", name: "Indicadores" } });
    renderAt("indicadores");
    await waitFor(() => {
      expect(screen.getByText("Escala Geral")).toBeDefined();
      expect(screen.getByText("Indicadores")).toBeDefined();
      expect(screen.getByText("Sexta-feira")).toBeDefined();
      expect(screen.getByText("Sábado")).toBeDefined();
      expect(screen.getByText("João")).toBeDefined();
      expect(screen.queryByText("Maria")).toBeNull();
      expect(screen.getAllByText("Aguardando escala").length).toBeGreaterThan(0);
    });
    expect(mocks.apiGet).toHaveBeenCalledWith("/api/public/departments/indicadores");
    expect(mocks.apiGet).toHaveBeenCalledWith("/api/public/departments/d-1/schedule");
  });

  it("shows error message when schedule fails to load", async () => {
    configure({
      department: { id: "d-1", name: "Indicadores" },
      scheduleError: new Error("rls"),
    });
    renderAt("indicadores");
    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível carregar a escala deste departamento.")
      ).toBeDefined();
    });
  });
});
