import { describe, it, expect } from "vitest";
import {
  sanitizeSchedule,
  isValidSchedule,
  extractTimeMinutes,
  getCurrentMinutes,
  getTodayScheduleDay,
  isCurrentShift,
  findActiveShiftId,
  mapDbItemToApp,
  mapAppItemToDb,
  mapAppVolunteerToDb,
  makeId,
  createWhatsAppUrl,
  getResponsibleNames,
  hexToRgba,
  buildOfflineSnapshot,
  formatCurrentDate,
  initialSchedule,
  emptyVolunteer,
  emptyItem,
} from "../utils/helpers";

describe("sanitizeSchedule", () => {
  it("returns initialSchedule for invalid input", () => {
    expect(sanitizeSchedule(null)).toEqual(initialSchedule);
    expect(sanitizeSchedule([])).toEqual(initialSchedule);
    expect(sanitizeSchedule("string")).toEqual(initialSchedule);
  });

  it("returns the schedule if valid", () => {
    const valid = initialSchedule;
    expect(sanitizeSchedule(valid)).toEqual(valid);
  });
});

describe("isValidSchedule", () => {
  it("returns false for non-array", () => {
    expect(isValidSchedule(null)).toBe(false);
    expect(isValidSchedule("test")).toBe(false);
  });

  it("returns false if less than 6 blocks", () => {
    expect(isValidSchedule([{ shifts: [{}, {}, {}, {}, {}] }])).toBe(false);
  });

  it("returns false if less than 16 total shifts", () => {
    const blocks = Array(6).fill({ shifts: [{}] });
    expect(isValidSchedule(blocks)).toBe(false);
  });

  it("returns true for a valid schedule", () => {
    expect(isValidSchedule(initialSchedule)).toBe(true);
  });
});

describe("extractTimeMinutes", () => {
  it("parses time correctly", () => {
    expect(extractTimeMinutes("8:00")).toBe(480);
    expect(extractTimeMinutes("12:50")).toBe(770);
    expect(extractTimeMinutes("9:30 Cântico 160")).toBe(570);
  });

  it("returns null for invalid input", () => {
    expect(extractTimeMinutes("")).toBe(null);
    expect(extractTimeMinutes("abc")).toBe(null);
    expect(extractTimeMinutes(null)).toBe(null);
  });
});

describe("getCurrentMinutes", () => {
  it("returns correct minutes for a given date", () => {
    const date = new Date(2024, 0, 1, 14, 30);
    expect(getCurrentMinutes(date)).toBe(870);
  });
});

describe("getTodayScheduleDay", () => {
  it("returns correct day name", () => {
    const sunday = new Date(2024, 0, 7);
    expect(getTodayScheduleDay(sunday)).toBe("Domingo");
    const saturday = new Date(2024, 0, 6);
    expect(getTodayScheduleDay(saturday)).toBe("Sábado");
  });
});

describe("isCurrentShift", () => {
  it("returns true when within shift window", () => {
    const shift = { start: "9:30", end: "11:05" };
    expect(isCurrentShift(shift, 600)).toBe(true);
  });

  it("returns false when outside shift window", () => {
    const shift = { start: "9:30", end: "11:05" };
    expect(isCurrentShift(shift, 500)).toBe(false);
    expect(isCurrentShift(shift, 700)).toBe(false);
  });
});

describe("findActiveShiftId", () => {
  it("returns null if schedule day does not match today", () => {
    const blocks = initialSchedule.slice(0, 2);
    expect(findActiveShiftId(blocks, "Sexta-feira", "Domingo", 600)).toBe(null);
  });

  it("returns the active shift id when within range", () => {
    const blocks = initialSchedule.slice(0, 2);
    const active = findActiveShiftId(blocks, "Sexta-feira", "Sexta-feira", 600);
    expect(active).toBe("sex-m-2");
  });
});

describe("mapDbItemToApp", () => {
  it("maps database fields to app fields", () => {
    const dbItem = { id: "1", item: "Bolsa", person: "Maria", day: "Sexta", status: "Guardado", photo_url: "http://img.com" };
    const app = mapDbItemToApp(dbItem);
    expect(app).toEqual({ id: "1", item: "Bolsa", person: "Maria", day: "Sexta", status: "Guardado", photo: "http://img.com" });
  });

  it("handles missing fields gracefully", () => {
    const app = mapDbItemToApp({});
    expect(app.photo).toBe("");
    expect(app.day).toBe("Sexta-feira");
  });
});

describe("mapAppItemToDb", () => {
  it("maps app fields to database fields", () => {
    const appItem = { id: "1", item: "Chave", person: "João", day: "Sábado", status: "Entregue", photo: "http://img.com" };
    const db = mapAppItemToDb(appItem);
    expect(db).toEqual({ item: "Chave", person: "João", day: "Sábado", status: "Entregue", photo_url: "http://img.com" });
  });
});

describe("mapAppVolunteerToDb", () => {
  it("maps volunteer fields correctly", () => {
    const vol = { id: "1", name: "Carlos", congregation: "Bancários", phone: "119999", active: true };
    const db = mapAppVolunteerToDb(vol);
    expect(db).toEqual({ name: "Carlos", congregation: "Bancários", phone: "119999", active: true });
  });

  it("defaults active to true when undefined", () => {
    const db = mapAppVolunteerToDb({ name: "Test" });
    expect(db.active).toBe(true);
  });
});

describe("makeId", () => {
  it("generates id with prefix", () => {
    const id = makeId("test");
    expect(id.startsWith("test-")).toBe(true);
    expect(id.length).toBeGreaterThan(10);
  });
});

describe("createWhatsAppUrl", () => {
  it("creates URL with country code", () => {
    const url = createWhatsAppUrl("83999999999");
    expect(url).toBe("https://api.whatsapp.com/send?phone=5583999999999");
  });

  it("preserves existing country code", () => {
    const url = createWhatsAppUrl("55839999999");
    expect(url).toBe("https://api.whatsapp.com/send?phone=55839999999");
  });

  it("returns empty string for no phone", () => {
    expect(createWhatsAppUrl("")).toBe("");
    expect(createWhatsAppUrl(null)).toBe("");
  });
});

describe("getResponsibleNames", () => {
  it("splits multiple names", () => {
    expect(getResponsibleNames("Carlos e David")).toEqual(["Carlos", "David"]);
  });

  it("normalizes Carlos Henrique to Carlos", () => {
    expect(getResponsibleNames("Carlos Henrique")).toEqual(["Carlos"]);
  });
});

describe("hexToRgba", () => {
  it("converts hex to rgba", () => {
    expect(hexToRgba("#000000", 0.5)).toBe("rgba(0, 0, 0, 0.5)");
  });

  it("returns fallback for invalid hex", () => {
    expect(hexToRgba("invalid", 0.5)).toContain("rgba");
  });
});

describe("buildOfflineSnapshot", () => {
  it("creates snapshot with timestamp", () => {
    const snap = buildOfflineSnapshot([], [], []);
    expect(snap).toHaveProperty("savedAt");
    expect(Array.isArray(snap.schedule)).toBe(true);
  });
});

describe("formatCurrentDate", () => {
  it("returns a string in pt-BR format", () => {
    const result = formatCurrentDate(new Date(2024, 0, 1));
    expect(result).toContain("2024");
  });
});

describe("emptyVolunteer", () => {
  it("returns empty volunteer object", () => {
    const v = emptyVolunteer();
    expect(v.name).toBe("");
    expect(v.active).toBe(true);
  });
});

describe("emptyItem", () => {
  it("returns empty item object with defaults", () => {
    const i = emptyItem();
    expect(i.item).toBe("");
    expect(i.status).toBe("Guardado");
    expect(i.day).toBe("Sexta-feira");
  });
});
