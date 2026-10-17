import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useEvent: vi.fn(),
  deleteEvento: vi.fn(),
  listEventos: vi.fn(),
  getCoordinatedEventoIds: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({ useAuth: mocks.useAuth }));
vi.mock("../context/EventContext", () => ({ useEvent: mocks.useEvent }));
vi.mock("../services/eventService", () => ({
  upsertEvento: vi.fn(),
  updateEvento: vi.fn(),
  deleteEvento: mocks.deleteEvento,
  getCoordinatedEventoIds: mocks.getCoordinatedEventoIds,
  listEventos: mocks.listEventos,
}));
vi.mock("../services/departmentService", () => ({
  createStandardDepartmentsForEvento: vi.fn(),
}));

import EventSelector from "../pages/EventSelector";

const testEvent = {
  id: "event-1",
  tipo: "congresso_regional",
  estado: "PB",
  cidade: "João Pessoa",
  circuito: "027 (B)",
  ano: 2099,
  data_evento: "2099-10-17",
  criado_por: "creator-1",
};

describe("EventSelector event deletion permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }));
    mocks.useAuth.mockReturnValue({
      user: { id: "user-1" },
      selectDepartment: vi.fn(),
    });
    mocks.useEvent.mockReturnValue({
      selectEvent: vi.fn(),
    });
    mocks.deleteEvento.mockResolvedValue(undefined);
    mocks.listEventos.mockResolvedValue([testEvent]);
    mocks.getCoordinatedEventoIds.mockResolvedValue([]);
  });

  it("shows a visible delete action to an event coordinator but keeps edit creator-only", async () => {
    mocks.getCoordinatedEventoIds.mockResolvedValue(["event-1"]);

    render(<EventSelector />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Excluir evento/ })).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Opções do evento" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Evento" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Excluir evento/ }));
    expect(screen.getByRole("dialog", { name: "Excluir evento" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Digite Congresso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir Evento" })).toBeDisabled();
  });

  it("requires typing the event category before deletion", async () => {
    mocks.useAuth.mockReturnValue({
      user: { id: "creator-1" },
      selectDepartment: vi.fn(),
    });

    render(<EventSelector />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Excluir evento/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Excluir evento/ }));

    const input = screen.getByRole("textbox", { name: "Digite Congresso" });
    fireEvent.change(input, { target: { value: "Assembleia" } });
    expect(screen.getByRole("button", { name: "Excluir Evento" })).toBeDisabled();

    fireEvent.change(input, { target: { value: " congresso " } });
    expect(screen.getByRole("button", { name: "Excluir Evento" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Excluir Evento" }));

    await waitFor(() => {
      expect(mocks.deleteEvento).toHaveBeenCalledWith("event-1");
    });
  });

  it("asks for Assembleia when deleting an assembly event", async () => {
    mocks.useAuth.mockReturnValue({
      user: { id: "creator-1" },
      selectDepartment: vi.fn(),
    });
    mocks.listEventos.mockResolvedValue([{ ...testEvent, tipo: "assembleia_circuito" }]);

    render(<EventSelector />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Excluir evento/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Excluir evento/ }));

    expect(screen.getByRole("textbox", { name: "Digite Assembleia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir Evento" })).toBeDisabled();
  });

  it("shows visible delete and edit options to the event creator", async () => {
    mocks.useAuth.mockReturnValue({
      user: { id: "creator-1" },
      selectDepartment: vi.fn(),
    });

    render(<EventSelector />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Excluir evento/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Opções do evento" }));

    expect(screen.getByRole("button", { name: "Editar Evento" })).toBeInTheDocument();
  });

  it("does not show event actions to other users", async () => {
    render(<EventSelector />);

    await waitFor(() => {
      expect(screen.getByText(/Congresso Regional/)).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /Excluir evento/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Opções do evento" })).not.toBeInTheDocument();
  });
});
