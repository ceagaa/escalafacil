import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShiftEditorModal from "../components/ShiftEditorModal";

const schedule = [
  {
    id: "sex-manha",
    day: "Sexta-feira",
    period: "Manhã",
    responsible: "Eduardo",
    accent: "sexta",
    shifts: [
      { id: "sex-m-1", start: "8:00", end: "9:30", description: "", volunteerIds: [], manualNames: [] },
    ],
  },
  {
    id: "sab-manha",
    day: "Sábado",
    period: "Manhã",
    responsible: "Carlos",
    accent: "sabado",
    shifts: [],
  },
];

const volunteers = [
  { id: "v-1", name: "João", congregation: "Centro", availability: '["sexta-manha"]' },
  { id: "v-2", name: "Maria", congregation: "Norte", availability: null },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ShiftEditorModal", () => {
  it("renders create mode with schedule fields", () => {
    render(
      <ShiftEditorModal
        shiftEditor={{ blockId: "sex-manha", shiftId: null }}
        volunteers={volunteers}
        schedule={schedule}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByRole("heading", { name: "Criar escala" })).toBeDefined();
    expect(screen.getByPlaceholderText("Ex: 8:00")).toBeDefined();
    expect(screen.getByPlaceholderText("Ex: 9:30")).toBeDefined();
    expect(screen.getByPlaceholderText("Ex: Guarda Volumes — Entrada principal")).toBeDefined();
    expect(screen.getByRole("combobox")).toBeDefined();
  });

  it("shows manual name input and hides volunteer list when checkbox is toggled", () => {
    render(
      <ShiftEditorModal
        shiftEditor={{ blockId: "sex-manha", shiftId: null }}
        volunteers={volunteers}
        schedule={schedule}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Adicionar nome não cadastrado (Avulso)"));
    expect(screen.getByPlaceholderText("Ex: Irmão Joãozinho")).toBeDefined();
    expect(screen.queryByText("João")).toBeNull();
  });

  it("saves manual assignment with null volunteer ids", async () => {
    const onSave = vi.fn();
    render(
      <ShiftEditorModal
        shiftEditor={{ blockId: "sex-manha", shiftId: null }}
        volunteers={volunteers}
        schedule={schedule}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Ex: 8:00"), { target: { value: "8:00" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: 9:30"), { target: { value: "9:30" } });
    fireEvent.click(screen.getByText("Adicionar nome não cadastrado (Avulso)"));
    fireEvent.change(screen.getByPlaceholderText("Ex: Irmão Joãozinho"), {
      target: { value: "Irmão Joãozinho" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar escala" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          shiftId: null,
          selectedIds: [],
          manualName: "Irmão Joãozinho",
          startTime: "8:00",
          endTime: "9:30",
        })
      );
    });
  });

  it("prefills values in edit mode", () => {
    render(
      <ShiftEditorModal
        shiftEditor={{ blockId: "sex-manha", shiftId: "sex-m-1" }}
        volunteers={volunteers}
        schedule={[
          {
            ...schedule[0],
            shifts: [
              {
                id: "sex-m-1",
                start: "8:00",
                end: "9:30",
                description: "Porta principal",
                volunteerIds: ["v-1"],
                manualNames: [],
              },
            ],
          },
          schedule[1],
        ]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByText("Editar turno")).toBeDefined();
    expect(screen.getByDisplayValue("8:00")).toBeDefined();
    expect(screen.getByDisplayValue("9:30")).toBeDefined();
    expect(screen.getByDisplayValue("Porta principal")).toBeDefined();
  });
});
