import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PublicEscala from "../pages/PublicEscala";

const mockState = vi.hoisted(() => ({ tableData: {} }));

vi.mock("../services/supabase.js", () => ({
  supabase: {
    from: vi.fn((table) => {
      const result = () => mockState.tableData[table] || { data: [], error: null };
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: vi.fn(() => Promise.resolve(result())),
        then: (resolve) => resolve(result()),
      };
      return builder;
    }),
  },
}));

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

function renderAt(slug) {
  return render(
    <MemoryRouter initialEntries={[`/p/${slug}/escala`]}>
      <Routes>
        <Route path="/p/:slug/escala" element={<PublicEscala />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockState.tableData = {
    departments: { data: { id: "d-1", name: "Achados Perdidos e Guarda Volumes" }, error: null },
    schedule_blocks: { data: scheduleBlocks, error: null },
    shifts: { data: shifts, error: null },
    shift_volunteers: { data: shiftVolunteers, error: null },
    volunteers: { data: volunteers, error: null },
  };
});

describe("PublicEscala", () => {
  it("shows loading state initially", () => {
    renderAt("achados-perdidos-guarda-volumes");
    expect(screen.getByText("Carregando escala...")).toBeDefined();
  });

  it("shows not found for invalid slug", async () => {
    mockState.tableData.departments = { data: null, error: null };
    renderAt("slug-invalido");
    await waitFor(() => {
      expect(screen.getByText("Departamento não encontrado")).toBeDefined();
    });
  });

  it("renders the schedule with assigned volunteers, excluding inactive", async () => {
    renderAt("achados-perdidos-guarda-volumes");
    await waitFor(() => {
      expect(screen.getByText("Escala Geral")).toBeDefined();
      expect(screen.getByText("Achados Perdidos e Guarda Volumes")).toBeDefined();
      expect(screen.getByText("Sexta-feira")).toBeDefined();
      expect(screen.getByText("Sábado")).toBeDefined();
      expect(screen.getByText("João")).toBeDefined();
      expect(screen.queryByText("Maria")).toBeNull();
      expect(screen.getAllByText("Aguardando escala").length).toBeGreaterThan(0);
    });
  });

  it("shows error message when schedule fails to load", async () => {
    mockState.tableData.schedule_blocks = { data: null, error: { message: "rls" } };
    renderAt("achados-perdidos-guarda-volumes");
    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível carregar a escala deste departamento.")
      ).toBeDefined();
    });
  });
});
