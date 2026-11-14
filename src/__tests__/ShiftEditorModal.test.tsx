import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShiftEditorModal from "../components/ShiftEditorModal";

vi.mock("../services/departmentService", () => ({
  listDepartmentMembers: vi.fn(),
}));

import { listDepartmentMembers } from "../services/departmentService";

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
  (listDepartmentMembers as any).mockResolvedValue([]);
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
    expect(screen.getByRole("heading", { name: "Criar turno" })).toBeDefined();
    expect(screen.getByPlaceholderText("Ex: 8:00")).toBeDefined();
    expect(screen.getByPlaceholderText("Ex: 9:30")).toBeDefined();
    expect(screen.getByPlaceholderText("Ex: Guarda Volumes — Entrada principal")).toBeDefined();
    // Dia + Período (criação) e Responsável
    expect(screen.getByLabelText("Dia")).toBeDefined();
    expect(screen.getByLabelText("Período")).toBeDefined();
    expect(screen.getByLabelText("Responsável")).toBeDefined();
  });

  it("limita o período a Manhã/Tarde e resolve o bloco por dia + período", async () => {
    const fullSchedule = [
      schedule[0],
      { id: "sex-tarde", day: "Sexta-feira", period: "Tarde", shifts: [] },
      schedule[1],
    ];
    const onSave = vi.fn();
    render(
      <ShiftEditorModal
        shiftEditor={{ blockId: "sex-manha", shiftId: null }}
        volunteers={[]}
        schedule={fullSchedule}
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const dia = screen.getByLabelText("Dia") as HTMLSelectElement;
    const periodo = screen.getByLabelText("Período") as HTMLSelectElement;
    expect(Array.from(dia.options).map((option) => option.value)).toEqual([
      "Sexta-feira",
      "Sábado",
    ]);
    expect(Array.from(periodo.options).map((option) => option.value)).toEqual(["Manhã", "Tarde"]);

    // Escolhe Tarde -> bloco sex-tarde
    fireEvent.change(periodo, { target: { value: "Tarde" } });
    // Muda o dia para Sábado (sem Tarde) -> volta ao primeiro bloco do dia (Manhã)
    fireEvent.change(dia, { target: { value: "Sábado" } });
    expect((screen.getByLabelText("Período") as HTMLSelectElement).value).toBe("Manhã");

    fireEvent.change(screen.getByPlaceholderText("Ex: 8:00"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: 9:30"), { target: { value: "11:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar turno" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ blockId: "sab-manha" }));
    });
  });

  it("oferece coordenador, voluntários e assistentes no Responsável", async () => {
    (listDepartmentMembers as any).mockResolvedValue([
      { id: "dm-1", role: "coordenador", profiles: { name: "Rita" } },
      { id: "dm-2", role: "assistente", profiles: { name: "Carla" } },
    ]);
    const onSave = vi.fn();
    render(
      <ShiftEditorModal
        shiftEditor={{ blockId: "sex-manha", shiftId: null }}
        volunteers={volunteers}
        schedule={schedule}
        departmentId="d-1"
        coordinatorName="Paulo"
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    const select = await waitFor(() => {
      const el = screen.getByLabelText("Responsável") as HTMLSelectElement;
      expect(Array.from(el.options).map((option) => option.value)).toContain("Carla");
      return el;
    });
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues[0]).toBe(""); // "Sem responsável"
    expect(optionValues).toEqual(expect.arrayContaining(["Paulo", "Rita", "João", "Maria", "Carla"]));

    fireEvent.change(select, { target: { value: "Carla" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: 8:00"), { target: { value: "8:00" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: 9:30"), { target: { value: "9:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar turno" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ responsible: "Carla" }));
    });
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
    // some a lista de voluntários (congregação some; "João" pode aparecer no select Responsável)
    expect(screen.queryByText("Centro")).toBeNull();
    expect(screen.queryByText("Norte")).toBeNull();
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
    fireEvent.click(screen.getByRole("button", { name: "Criar turno" }));

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
                responsible: "Maria",
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
    expect((screen.getByLabelText("Responsável") as HTMLSelectElement).value).toBe("Maria");
    // modo edição não mostra Dia/Período
    expect(screen.queryByLabelText("Dia")).toBeNull();
    expect(screen.queryByLabelText("Período")).toBeNull();
  });
});
