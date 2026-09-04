import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VolunteersView from "../components/VolunteersView";

const baseProps = {
  volunteers: [],
  volunteerForm: { id: "", name: "", congregation: "", phone: "", active: true },
  setVolunteerForm: vi.fn(),
  onSave: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onCancel: vi.fn(),
  onApprove: vi.fn(),
  onReject: vi.fn(),
  departmentName: "Achados e Perdidos",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("VolunteersView", () => {
  it("renders the volunteer form and tabs", () => {
    render(<VolunteersView {...baseProps} />);
    expect(screen.getByText("Novo voluntário")).toBeDefined();
    expect(screen.getByText(/Ativos \(0\)/)).toBeDefined();
    expect(screen.getByText(/Fila de Aprovação \(0\)/)).toBeDefined();
  });

  it("shows active volunteers in the Ativos tab", () => {
    render(
      <VolunteersView
        {...baseProps}
        volunteers={[{ id: "v-1", name: "Carlos", congregation: "Bancários", phone: "83999990000", active: true }]}
      />
    );
    expect(screen.getByText("Carlos")).toBeDefined();
    expect(screen.getByText("Bancários")).toBeDefined();
  });

  it("shows pending volunteers with availability in the Fila tab", async () => {
    render(
      <VolunteersView
        {...baseProps}
        volunteers={[
          {
            id: "v-2",
            name: "João",
            congregation: "Centro",
            phone: "83999991111",
            active: false,
            availability: '["sexta-manha","domingo-tarde"]',
          },
        ]}
      />
    );
    fireEvent.click(screen.getByText(/Fila de Aprovação \(1\)/));
    await waitFor(() => {
      expect(screen.getByText("João")).toBeDefined();
      expect(screen.getByText("Sexta · Manhã")).toBeDefined();
      expect(screen.getByText("Domingo · Tarde")).toBeDefined();
      expect(screen.getByText("Aprovar")).toBeDefined();
      expect(screen.getByText("Recusar")).toBeDefined();
    });
  });

  it("calls onApprove and shows WhatsApp shortcut after approval", async () => {
    const onApprove = vi.fn().mockResolvedValue();
    render(
      <VolunteersView
        {...baseProps}
        onApprove={onApprove}
        volunteers={[
          {
            id: "v-2",
            name: "João",
            congregation: "Centro",
            phone: "83999991111",
            active: false,
            availability: "[]",
          },
        ]}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Fila de Aprovação/ }));
    await waitFor(() => {
      expect(screen.getByText("Aprovar")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Aprovar"));
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith("v-2");
      const waLink = screen.getByText("Avisar no WhatsApp").closest("a");
      expect(waLink).toBeDefined();
      expect(waLink.href).toContain("wa.me/5583999991111");
      expect(decodeURIComponent(waLink.href)).toContain(
        "seu cadastro no departamento Achados e Perdidos foi aprovado"
      );
    });
  });

  it("calls onReject when Recusar is clicked", async () => {
    const onReject = vi.fn();
    render(
      <VolunteersView
        {...baseProps}
        onReject={onReject}
        volunteers={[
          { id: "v-3", name: "Maria", congregation: "", phone: "", active: false, availability: "[]" },
        ]}
      />
    );
    fireEvent.click(screen.getByText(/Fila de Aprovação \(1\)/));
    await waitFor(() => {
      expect(screen.getByText("Recusar")).toBeDefined();
    });
    fireEvent.click(screen.getByText("Recusar"));
    expect(onReject).toHaveBeenCalledWith("v-3");
  });

  it("shows empty state when there are no pending volunteers", async () => {
    render(<VolunteersView {...baseProps} />);
    fireEvent.click(screen.getByText(/Fila de Aprovação \(0\)/));
    await waitFor(() => {
      expect(screen.getByText("Nenhum cadastro aguardando aprovação.")).toBeDefined();
    });
  });
});
