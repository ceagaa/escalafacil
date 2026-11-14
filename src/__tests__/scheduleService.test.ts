import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("../services/api", () => ({
  apiGet: mocks.apiGet,
  apiPost: mocks.apiPost,
  apiPatch: mocks.apiPatch,
  apiPut: mocks.apiPut,
  apiDelete: mocks.apiDelete,
  apiData: vi.fn(),
  apiRequest: vi.fn(),
  ApiError: class ApiError extends Error {
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
  },
}));

vi.mock("../services/volunteersService", () => ({
  getVolunteers: vi.fn().mockResolvedValue([]),
}));

import {
  getScheduleBlocks,
  getAllShifts,
  getShiftVolunteers,
  assignVolunteersToShift,
  saveShiftAssignments,
  createShift,
  updateShift,
  deleteShift,
  defaultBlockSpecs,
  ensureDefaultBlocks,
  fetchDepartmentData,
  sortBlocksForDisplay,
} from "../services/scheduleService";

const DEPT_ID = "dept-test-1";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiGet.mockResolvedValue([]);
  mocks.apiPost.mockResolvedValue({});
  mocks.apiPatch.mockResolvedValue({});
  mocks.apiPut.mockResolvedValue(undefined);
  mocks.apiDelete.mockResolvedValue(undefined);
});

describe("scheduleService", () => {
  describe("getScheduleBlocks", () => {
    it("throws when departmentId is missing", async () => {
      await expect((getScheduleBlocks as any)()).rejects.toThrow("departmentId is required");
      await expect((getScheduleBlocks as any)(null)).rejects.toThrow("departmentId is required");
      expect(mocks.apiGet).not.toHaveBeenCalled();
    });

    it("queries blocks filtered by department_id", async () => {
      mocks.apiGet.mockResolvedValue([{ id: "sex-manha" }]);
      const result = await getScheduleBlocks(DEPT_ID);
      expect(result).toEqual([{ id: "sex-manha" }]);
      expect(mocks.apiGet).toHaveBeenCalledWith(`/api/departments/${DEPT_ID}/blocks`);
    });
  });

  describe("getAllShifts", () => {
    it("throws when departmentId is missing", async () => {
      await expect((getAllShifts as any)()).rejects.toThrow("departmentId is required");
      expect(mocks.apiGet).not.toHaveBeenCalled();
    });

    it("queries shifts filtered by department_id", async () => {
      mocks.apiGet.mockResolvedValue([{ id: "sex-m-1" }]);
      const result = await getAllShifts(DEPT_ID);
      expect(result).toEqual([{ id: "sex-m-1" }]);
      expect(mocks.apiGet).toHaveBeenCalledWith(`/api/departments/${DEPT_ID}/shifts`);
    });
  });

  describe("getShiftVolunteers", () => {
    it("throws when departmentId is missing", async () => {
      await expect((getShiftVolunteers as any)()).rejects.toThrow("departmentId is required");
      expect(mocks.apiGet).not.toHaveBeenCalled();
    });

    it("queries shift assignments for the department", async () => {
      mocks.apiGet.mockResolvedValue([{ shift_id: "s-1", volunteer_id: "v-1" }]);
      const result = await getShiftVolunteers(DEPT_ID);
      expect(result).toEqual([{ shift_id: "s-1", volunteer_id: "v-1" }]);
      expect(mocks.apiGet).toHaveBeenCalledWith(`/api/departments/${DEPT_ID}/assignments`);
    });
  });

  describe("assignVolunteersToShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect((assignVolunteersToShift as any)("s-1", ["v-1"])).rejects.toThrow(
        "departmentId is required"
      );
      expect(mocks.apiPut).not.toHaveBeenCalled();
    });

    it("replaces the shift assignments with the given volunteers", async () => {
      await assignVolunteersToShift("s-1", ["v-1", "v-2"], DEPT_ID);

      expect(mocks.apiPut).toHaveBeenCalledWith("/api/shifts/s-1/assignments", {
        volunteer_ids: ["v-1", "v-2"],
      });
    });

    it("clears volunteers when empty array provided", async () => {
      await assignVolunteersToShift("s-1", [], DEPT_ID);

      expect(mocks.apiPut).toHaveBeenCalledWith("/api/shifts/s-1/assignments", {
        volunteer_ids: [],
      });
    });
  });

  describe("saveShiftAssignments", () => {
    it("throws when departmentId is missing", async () => {
      await expect((saveShiftAssignments as any)("s-1", [], null)).rejects.toThrow(
        "departmentId is required"
      );
      expect(mocks.apiPut).not.toHaveBeenCalled();
    });

    it("replaces assignments with volunteers and manual names", async () => {
      await saveShiftAssignments(
        "s-1",
        [
          { volunteer_id: "v-1", manual_name: null },
          { volunteer_id: null, manual_name: "Irmão Joãozinho" },
        ],
        DEPT_ID
      );

      expect(mocks.apiPut).toHaveBeenCalledWith("/api/shifts/s-1/assignments", {
        assignments: [
          { volunteer_id: "v-1", manual_name: null },
          { volunteer_id: null, manual_name: "Irmão Joãozinho" },
        ],
      });
    });

    it("clears assignments when the list is empty", async () => {
      await saveShiftAssignments("s-1", [], DEPT_ID);

      expect(mocks.apiPut).toHaveBeenCalledWith("/api/shifts/s-1/assignments", {
        assignments: [],
      });
    });
  });

  describe("createShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect((createShift as any)(null, "b-1", {})).rejects.toThrow("departmentId is required");
      expect(mocks.apiPost).not.toHaveBeenCalled();
    });

    it("posts a shift with generated id", async () => {
      mocks.apiPost.mockResolvedValue({
        id: "shift-123",
        block_id: "sex-manha",
        start_time: "8:00",
        end_time: "9:30",
        description: "Porta",
      });
      const result = await createShift(DEPT_ID, "sex-manha", {
        start_time: "8:00",
        end_time: "9:30",
        description: "Porta",
      });
      expect(result.id).toBe("shift-123");
      expect(mocks.apiPost).toHaveBeenCalledWith(`/api/departments/${DEPT_ID}/shifts`, {
        id: expect.stringContaining("shift"),
        block_id: "sex-manha",
        start_time: "8:00",
        end_time: "9:30",
        description: "Porta",
        vagas: 0,
      });
    });
  });

  describe("updateShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect((updateShift as any)(null, "s-1", {})).rejects.toThrow("departmentId is required");
      expect(mocks.apiPatch).not.toHaveBeenCalled();
    });

    it("patches a shift", async () => {
      mocks.apiPatch.mockResolvedValue({ id: "s-1", start_time: "9:00" });
      const result = await updateShift(DEPT_ID, "s-1", {
        start_time: "9:00",
        end_time: "10:00",
        description: "Porta 2",
      });
      expect(result).toEqual({ id: "s-1", start_time: "9:00" });
      expect(mocks.apiPatch).toHaveBeenCalledWith("/api/shifts/s-1", {
        start_time: "9:00",
        end_time: "10:00",
        description: "Porta 2",
        vagas: 0,
      });
    });
  });

  describe("deleteShift", () => {
    it("throws when departmentId is missing", async () => {
      await expect((deleteShift as any)(null, "s-1")).rejects.toThrow("departmentId is required");
      expect(mocks.apiDelete).not.toHaveBeenCalled();
    });

    it("deletes a shift", async () => {
      await expect(deleteShift(DEPT_ID, "s-1")).resolves.not.toThrow();
      expect(mocks.apiDelete).toHaveBeenCalledWith("/api/shifts/s-1");
    });
  });

  describe("defaultBlockSpecs", () => {
    it("gera Manhã/Tarde nos 3 dias para congresso regional", () => {
      const specs = defaultBlockSpecs(DEPT_ID, "congresso_regional");
      expect(specs).toHaveLength(6);
      expect(specs.map((s) => `${s.day}/${s.period}`)).toEqual([
        "Sexta-feira/Manhã",
        "Sexta-feira/Tarde",
        "Sábado/Manhã",
        "Sábado/Tarde",
        "Domingo/Manhã",
        "Domingo/Tarde",
      ]);
      expect(specs[0].accent).toBe("sexta");
      expect(specs[2].accent).toBe("sabado");
      expect(specs[4].accent).toBe("domingo");
    });

    it("gera Manhã/Tarde em 'Dia do Evento' para assembleia", () => {
      const specs = defaultBlockSpecs(DEPT_ID, "assembleia_circuito");
      expect(specs).toHaveLength(2);
      expect(specs.map((s) => `${s.day}/${s.period}`)).toEqual([
        "Dia do Evento/Manhã",
        "Dia do Evento/Tarde",
      ]);
      expect(specs.every((s) => s.accent === null)).toBe(true);
    });

    it("IDs são determinísticos (idempotentes) e únicos por departamento", () => {
      const a1 = defaultBlockSpecs(DEPT_ID, "congresso_regional");
      const a2 = defaultBlockSpecs(DEPT_ID, "congresso_regional");
      const b = defaultBlockSpecs("outro-depto", "congresso_regional");
      expect(a1.map((s) => s.id)).toEqual(a2.map((s) => s.id));
      expect(a1.some((s, i) => s.id === b[i].id)).toBe(false);
      // Sem acentos/espaços no id
      expect(a1[2].id).toBe(`blk-${DEPT_ID}-sabado-manha`);
    });
  });

  describe("ensureDefaultBlocks", () => {
    it("cria os blocos padrão quando não há nenhum período", async () => {
      const specs = defaultBlockSpecs(DEPT_ID, "congresso_regional");
      let blocksCalls = 0;
      mocks.apiGet.mockImplementation((url: string) => {
        if (url.endsWith("/blocks")) {
          blocksCalls += 1;
          return Promise.resolve(blocksCalls === 1 ? [] : specs);
        }
        return Promise.resolve([]);
      });

      const result = await ensureDefaultBlocks(DEPT_ID, "congresso_regional");
      expect(mocks.apiPost).toHaveBeenCalledTimes(6);
      expect(mocks.apiPost).toHaveBeenCalledWith(
        `/api/departments/${DEPT_ID}/blocks`,
        expect.objectContaining({ day: "Sexta-feira", period: "Manhã" })
      );
      expect(result).toHaveLength(6);
    });

    it("não cria nada quando já existem períodos", async () => {
      const existing = [{ id: "b1", day: "Sexta-feira", period: "Manhã" }];
      mocks.apiGet.mockResolvedValue(existing);

      const result = await ensureDefaultBlocks(DEPT_ID, "congresso_regional");
      expect(mocks.apiPost).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it("devolve o que existir mesmo se alguma criação falhar", async () => {
      const specs = defaultBlockSpecs(DEPT_ID, "assembleia_circuito");
      let blocksCalls = 0;
      mocks.apiGet.mockImplementation((url: string) => {
        if (url.endsWith("/blocks")) {
          blocksCalls += 1;
          return Promise.resolve(blocksCalls === 1 ? [] : specs.slice(0, 1));
        }
        return Promise.resolve([]);
      });
      mocks.apiPost.mockRejectedValueOnce(new Error("conflito"));

      const result = await ensureDefaultBlocks(DEPT_ID, "assembleia_circuito");
      expect(result).toHaveLength(1);
    });
  });

  describe("sortBlocksForDisplay", () => {
    it("ordena por dia canônico e período (Manhã antes de Tarde)", () => {
      const shuffled = [
        { id: "b6", day: "Domingo", period: "Tarde" },
        { id: "b3", day: "Sexta-feira", period: "Tarde" },
        { id: "b5", day: "Domingo", period: "Manhã" },
        { id: "b2", day: "Sábado", period: "Manhã" },
        { id: "b4", day: "Sexta-feira", period: "Manhã" },
        { id: "b1", day: "Sábado", period: "Tarde" },
      ];
      const sorted = sortBlocksForDisplay(shuffled);
      expect(sorted.map((b) => `${b.day}/${b.period}`)).toEqual([
        "Sexta-feira/Manhã",
        "Sexta-feira/Tarde",
        "Sábado/Manhã",
        "Sábado/Tarde",
        "Domingo/Manhã",
        "Domingo/Tarde",
      ]);
      // não muta a entrada
      expect(shuffled[0].id).toBe("b6");
    });

    it("'Dia do Evento' vem depois dos dias da semana e dias desconhecidos no fim", () => {
      const blocks = [
        { id: "x", day: "Dia do Evento", period: "Manhã" },
        { id: "y", day: "Sexta-feira", period: "Manhã" },
        { id: "z", day: "Feriado", period: "Manhã" },
      ];
      expect(sortBlocksForDisplay(blocks).map((b) => b.id)).toEqual(["y", "x", "z"]);
    });
  });

  describe("fetchDepartmentData", () => {
    it("semeia Manhã/Tarde quando o departamento está sem períodos", async () => {
      const specs = defaultBlockSpecs(DEPT_ID, "congresso_regional");
      let blocksCalls = 0;
      mocks.apiGet.mockImplementation((url: string) => {
        if (url.endsWith("/blocks")) {
          blocksCalls += 1;
          return Promise.resolve(blocksCalls === 1 ? [] : specs);
        }
        return Promise.resolve([]);
      });

      const result = await fetchDepartmentData(DEPT_ID, [], "congresso_regional");
      expect(mocks.apiPost).toHaveBeenCalledTimes(6);
      expect(result.schedule).toHaveLength(6);
      expect(result.schedule[0]).toMatchObject({
        day: "Sexta-feira",
        period: "Manhã",
        shifts: [],
      });
    });

    it("mantém os períodos existentes sem recriar", async () => {
      mocks.apiGet.mockImplementation((url: string) => {
        if (url.endsWith("/blocks")) {
          return Promise.resolve([{ id: "b1", day: "Sexta-feira", period: "Manhã" }]);
        }
        return Promise.resolve([]);
      });

      const result = await fetchDepartmentData(DEPT_ID, [], "congresso_regional");
      expect(mocks.apiPost).not.toHaveBeenCalled();
      expect(result.schedule).toHaveLength(1);
      expect(result.schedule[0].id).toBe("b1");
    });
  });
});
