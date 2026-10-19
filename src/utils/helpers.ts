import { encryptData, decryptData, isLocalStorageAvailable } from "./crypto";
import type {
  AvailabilitySlot,
  DayThemeEntry,
  Evento,
  EventoTipo,
  NavigationItem,
  OfflineSnapshot,
  ScheduleBlock,
  Shift,
  Volunteer,
  VolunteerForm,
} from "../types";

function decodeContacts(encoded: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(encoded).map(([k, v]) => [k, atob(v)])
  );
}

export const responsibleContacts: Record<string, string> = decodeContacts({
  Carlos: "MTE5NTIzODk5MjI=",
  Adenilton: "ODM5OTExMzQwNjY=",
  David: "ODM5ODc2NzU1NjA=",
  Eduardo: "ODM5ODgxOTc0NDE=",
});

export const dayTheme: Record<string, DayThemeEntry> = {
  "Sexta-feira": { key: "sexta", color: "#D65A00", soft: "rgba(214, 90, 0, 0.10)", border: "rgba(214, 90, 0, 0.18)" },
  Sábado: { key: "sabado", color: "#345C3F", soft: "rgba(52, 92, 63, 0.10)", border: "rgba(52, 92, 63, 0.18)" },
  Domingo: { key: "domingo", color: "#0A5883", soft: "rgba(10, 88, 131, 0.10)", border: "rgba(10, 88, 131, 0.18)" },
  "Dia do Evento": { key: "evento", color: "#6D28D9", soft: "rgba(109, 40, 217, 0.10)", border: "rgba(109, 40, 217, 0.18)" },
  segunda: { key: "segunda", color: "#6D28D9", soft: "rgba(109, 40, 217, 0.10)", border: "rgba(109, 40, 217, 0.18)" },
  terça: { key: "terca", color: "#6D28D9", soft: "rgba(109, 40, 217, 0.10)", border: "rgba(109, 40, 217, 0.18)" },
  quarta: { key: "quarta", color: "#6D28D9", soft: "rgba(109, 40, 217, 0.10)", border: "rgba(109, 40, 217, 0.18)" },
  quinta: { key: "quinta", color: "#6D28D9", soft: "rgba(109, 40, 217, 0.10)", border: "rgba(109, 40, 217, 0.18)" },
  sexta: { key: "sexta2", color: "#D65A00", soft: "rgba(214, 90, 0, 0.10)", border: "rgba(214, 90, 0, 0.18)" },
  sábado: { key: "sabado2", color: "#345C3F", soft: "rgba(52, 92, 63, 0.10)", border: "rgba(52, 92, 63, 0.18)" },
  domingo: { key: "domingo2", color: "#0A5883", soft: "rgba(10, 88, 131, 0.10)", border: "rgba(10, 88, 131, 0.18)" },
};

export const UNASSIGNED_LABEL = "Aguardando escala";
export const OFFLINE_CACHE_KEY = "ap_offline_snapshot_v1";

export const initialSchedule: ScheduleBlock[] = [
  {
    id: "sex-manha",
    day: "Sexta-feira",
    period: "Manhã",
    responsible: "Eduardo",
    accent: "sexta",
    shifts: [
      { id: "sex-m-1", start: "8:00", end: "9:30 Cântico 160", volunteerIds: [] },
      { id: "sex-m-2", start: "9:30 Cântico 160", end: "11:05 Cântico 17", volunteerIds: [] },
      { id: "sex-m-3", start: "11:05 Cântico 17", end: "12:50", volunteerIds: [] },
    ],
  },
  {
    id: "sex-tarde",
    day: "Sexta-feira",
    period: "Tarde",
    responsible: "Adenilton",
    accent: "sexta",
    shifts: [
      { id: "sex-t-1", start: "12:50", end: "14:10 Série de Discursos", volunteerIds: [] },
      { id: "sex-t-2", start: "14:10 Série de Discursos", end: "15:30 Cântico 155 e oração final", volunteerIds: [] },
    ],
  },
  {
    id: "sab-manha",
    day: "Sábado",
    period: "Manhã",
    responsible: "Carlos",
    accent: "sabado",
    shifts: [
      { id: "sab-m-1", start: "8:00", end: "9:30 Cântico 111", volunteerIds: [] },
      { id: "sab-m-2", start: "9:30 Cântico 111", end: "11:15 Série de Discursos", volunteerIds: [] },
      { id: "sab-m-3", start: "11:15 Série de Discursos", end: "12:50", volunteerIds: [] },
    ],
  },
  {
    id: "sab-tarde",
    day: "Sábado",
    period: "Tarde",
    responsible: "David",
    accent: "sabado",
    shifts: [
      { id: "sab-t-1", start: "12:50", end: "13:50 Série de Discursos", volunteerIds: [] },
      { id: "sab-t-2", start: "13:50 Série de Discursos", end: "15:20 Cântico 81", volunteerIds: [] },
      { id: "sab-t-3", start: "15:20 Cântico 81", end: "16:30 Cântico 21 e oração final", volunteerIds: [] },
    ],
  },
  {
    id: "dom-manha",
    day: "Domingo",
    period: "Manhã",
    responsible: "Adenilton e Carlos",
    accent: "domingo",
    shifts: [
      { id: "dom-m-1", start: "8:00", end: "9:30 Cântico 68", volunteerIds: [] },
      { id: "dom-m-2", start: "9:30 Cântico 68", end: "11:00 Cântico 64 e anúncios", volunteerIds: [] },
      { id: "dom-m-3", start: "11:00 Cântico 64 e anúncios", end: "12:50", volunteerIds: [] },
    ],
  },
  {
    id: "dom-tarde",
    day: "Domingo",
    period: "Tarde",
    responsible: "Eduardo e David",
    accent: "domingo",
    shifts: [
      { id: "dom-t-1", start: "12:50", end: "13:50 VÍDEO PRINCIPAL", volunteerIds: [] },
      { id: "dom-t-2", start: "13:50 VÍDEO PRINCIPAL", end: "14:45 O que você aprendeu?", volunteerIds: [] },
      { id: "dom-t-3", start: "14:45 O que você aprendeu?", end: "15:45 Cântico 163 e oração final", volunteerIds: [] },
    ],
  },
];

export const initialVolunteers: Volunteer[] = [];

export function emptyVolunteer(): VolunteerForm {
  return { id: "", name: "", congregation: "", phone: "", active: true };
}

export function sanitizeSchedule(schedule: unknown): ScheduleBlock[] {
  if (!Array.isArray(schedule) || schedule.length === 0) return initialSchedule;
  return isValidSchedule(schedule) ? (schedule as ScheduleBlock[]) : initialSchedule;
}

/**
 * Aceita a escala persistida (localStorage) ou a resposta do banco.
 * A escala vinda do Supabase pode ter qualquer número de blocos — quem decide
 * se há escala é `dayCards.length`, não um limite mínimo de turnos.
 */
export function sanitizeLoadedSchedule(schedule: unknown): ScheduleBlock[] {
  if (!Array.isArray(schedule)) return initialSchedule;
  const blocks = schedule.filter(
    (block): block is ScheduleBlock => Boolean(block) && Array.isArray((block as ScheduleBlock).shifts)
  );
  return blocks.length > 0 ? blocks : initialSchedule;
}

export function isValidSchedule(schedule: unknown): boolean {
  if (!Array.isArray(schedule)) return false;
  if (schedule.length < 6) return false;
  const totalShifts = schedule.reduce(
    (total: number, block) => total + (Array.isArray((block as ScheduleBlock).shifts) ? (block as ScheduleBlock).shifts.length : 0),
    0
  );
  return totalShifts >= 16;
}

export function sortScheduleBlocks<T extends { id: string }>(blocks: T[]): T[] {
  return [...blocks].sort(sortByKnownOrder(SCHEDULE_BLOCK_ORDER));
}

export function sortShifts<T extends { id: string }>(shifts: T[]): T[] {
  const order = initialSchedule.flatMap((block) => block.shifts.map((shift) => shift.id));
  return [...shifts].sort(sortByKnownOrder(order));
}

const SCHEDULE_BLOCK_ORDER = ["sex-manha", "sex-tarde", "sab-manha", "sab-tarde", "dom-manha", "dom-tarde"];

/**
 * Comparador que ordena pelos ids conhecidos e joga os desconhecidos para o fim,
 * preservando a ordem relativa (ids de banco são UUIDs, não a ordem de exibição).
 */
function sortByKnownOrder(order: string[]) {
  return (a: { id: string }, b: { id: string }) => {
    const indexA = order.indexOf(a.id);
    const indexB = order.indexOf(b.id);
    return (indexA < 0 ? order.length : indexA) - (indexB < 0 ? order.length : indexB);
  };
}

export function mapAppVolunteerToDb(volunteer: VolunteerForm | Volunteer) {
  return {
    name: volunteer.name,
    congregation: volunteer.congregation || "",
    phone: volunteer.phone || "",
    active: volunteer.active !== false,
  };
}

export function createWhatsAppUrl(phone: unknown): string {
  const onlyNumbers = String(phone || "").replace(/\D/g, "");
  if (!onlyNumbers) return "";
  const withCountryCode = onlyNumbers.startsWith("55") ? onlyNumbers : "55" + onlyNumbers;
  return "https://api.whatsapp.com/send?phone=" + withCountryCode;
}

export function createWaMeLink(phone: unknown, text?: string): string {
  const onlyNumbers = String(phone || "").replace(/\D/g, "");
  if (!onlyNumbers) return "";
  const withCountryCode = onlyNumbers.startsWith("55") ? onlyNumbers : "55" + onlyNumbers;
  const suffix = text ? "?text=" + encodeURIComponent(text) : "";
  return "https://wa.me/" + withCountryCode + suffix;
}

export const AVAILABILITY_SLOT_LABELS: Record<string, string> = {
  "sexta-manha": "Sexta · Manhã",
  "sexta-tarde": "Sexta · Tarde",
  "sabado-manha": "Sábado · Manhã",
  "sabado-tarde": "Sábado · Tarde",
  "domingo-manha": "Domingo · Manhã",
  "domingo-tarde": "Domingo · Tarde",
};

export const ASSEMBLEIA_SLOTS: AvailabilitySlot[] = [
  { id: "manha", label: "Manhã" },
  { id: "tarde", label: "Tarde" },
];

export const CONGRESSO_SLOTS: AvailabilitySlot[] = [
  { id: "sexta-manha", day: "Sexta-feira", period: "Manhã" },
  { id: "sexta-tarde", day: "Sexta-feira", period: "Tarde" },
  { id: "sabado-manha", day: "Sábado", period: "Manhã" },
  { id: "sabado-tarde", day: "Sábado", period: "Tarde" },
  { id: "domingo-manha", day: "Domingo", period: "Manhã" },
  { id: "domingo-tarde", day: "Domingo", period: "Tarde" },
];

const ASSEMBLEIA_TYPES = ["assembleia_circuito", "assembleia_representante"];

export function getAvailabilitySlots(eventoTipo?: EventoTipo | null): AvailabilitySlot[] {
  return ASSEMBLEIA_TYPES.includes(String(eventoTipo)) ? ASSEMBLEIA_SLOTS : CONGRESSO_SLOTS;
}

export function isAssembleiaType(eventoTipo?: EventoTipo | null): boolean {
  return ASSEMBLEIA_TYPES.includes(String(eventoTipo));
}

export function parseAvailability(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function getAvailabilitySlotId(day?: string | null, period?: string | null): string {
  const key = dayTheme[day || ""]?.key || "";
  if (!key) return "";
  const periodKey = String(period || "").toLowerCase().trim() === "tarde" ? "tarde" : "manha";
  return key + "-" + periodKey;
}

export function volunteerIsAvailable(
  volunteer: Pick<Volunteer, "availability"> | null | undefined,
  day: string,
  period: string
): boolean {
  const slotId = getAvailabilitySlotId(day, period);
  if (!slotId) return false;
  return parseAvailability(volunteer?.availability).includes(slotId);
}

export function buildAssignmentMessage(
  volunteer: Pick<Volunteer, "name">,
  { day, period, start, end }: { day: string; period: string; start: string; end: string },
  departmentName = ""
): string {
  const local = departmentName ? ` Local: ${departmentName}.` : "";
  return `Olá ${volunteer.name}, sua designação para ${day} - ${period} está confirmada para as ${start} até ${end}.${local}`;
}

export function buildDaySummary(
  schedule: ScheduleBlock[],
  day: string,
  volunteers: Volunteer[],
  departmentName = ""
): string {
  const blocks = schedule.filter((block) => block.day === day);
  const lines = [`*Escala ${day}*${departmentName ? " — " + departmentName : ""}`];
  for (const block of blocks) {
    lines.push("");
    lines.push(`*${block.day} · ${block.period}*${block.responsible ? " (Resp.: " + block.responsible + ")" : ""}`);
    block.shifts.forEach((shift) => {
      const names = shift.volunteerIds
        .map((id) => volunteers.find((volunteer) => String(volunteer.id) === String(id)))
        .filter((volunteer): volunteer is Volunteer => Boolean(volunteer))
        .map((volunteer) => volunteer.name);
      const manualNames = (shift.manualNames || []).map((name) => name + " (Avulso)");
      const allNames = [...names, ...manualNames];
      lines.push(`• ${shift.start} às ${shift.end}: ${allNames.length ? allNames.join(", ") : "Aguardando escala"}`);
    });
  }
  return lines.join("\n");
}

export function makeId(prefix: string): string {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

export function extractTimeMinutes(value: unknown): number | null {
  const firstPart = String(value || "").trim().split(" ")[0];
  const parts = firstPart.split(":");
  if (parts.length !== 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function getCurrentMinutes(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function getTodayScheduleDay(date: Date = new Date()): string {
  const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  return days[date.getDay()];
}

export function isCurrentShift(shift: Pick<Shift, "start" | "end">, currentMinutes: number): boolean {
  const start = extractTimeMinutes(shift.start);
  const end = extractTimeMinutes(shift.end);
  if (start === null || end === null) return false;
  return currentMinutes >= start && currentMinutes < end;
}

export function findActiveShiftId(
  blocks: ScheduleBlock[],
  scheduleDay: string,
  todayDay: string,
  currentMinutes: number
): string | null {
  if (scheduleDay !== todayDay) return null;
  for (const block of blocks) {
    const activeShift = block.shifts.find((shift) => isCurrentShift(shift, currentMinutes));
    if (activeShift) return activeShift.id;
  }
  return null;
}

export function hexToRgba(hex: string | null | undefined, alpha: number | string): string {
  const cleanHex = String(hex || "").replace("#", "");
  if (cleanHex.length !== 6) return "rgba(15, 23, 42, " + alpha + ")";
  const red = parseInt(cleanHex.slice(0, 2), 16);
  const green = parseInt(cleanHex.slice(2, 4), 16);
  const blue = parseInt(cleanHex.slice(4, 6), 16);
  return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
}

export function buildOfflineSnapshot(schedule: ScheduleBlock[], volunteers: Volunteer[]): OfflineSnapshot {
  return { schedule, volunteers, savedAt: new Date().toISOString() };
}

export async function saveOfflineSnapshot(snapshot: OfflineSnapshot): Promise<void> {
  try {
    if (typeof window === "undefined" || !isLocalStorageAvailable()) return;
    const json = JSON.stringify(snapshot);
    const encrypted = await encryptData(json);
    window.localStorage.setItem(OFFLINE_CACHE_KEY, encrypted);
  } catch {
    console.warn("Não foi possível salvar o backup offline.");
  }
}

export async function loadOfflineSnapshot(): Promise<OfflineSnapshot | null> {
  try {
    if (typeof window === "undefined" || !isLocalStorageAvailable()) return null;
    const raw = window.localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return null;
    try {
      const decrypted = await decryptData(raw);
      return JSON.parse(decrypted) as OfflineSnapshot;
    } catch {
      return JSON.parse(raw) as OfflineSnapshot;
    }
  } catch {
    return null;
  }
}

export function formatCurrentDate(date: Date = new Date()): string {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export const navigationItems: NavigationItem[] = [
  { path: "/", label: "Resumo", iconClass: "fi fi-rr-home" },
  { path: "/programacao", label: "Escala", iconClass: "fi fi-rr-calendar-lines", requiresDepartment: true },
  { path: "/voluntarios", label: "Voluntários", iconClass: "fi fi-rr-users", requiresDepartment: true },
  {
    path: "/meus-departamentos",
    label: "Meus departamentos",
    iconClass: "fi fi-rr-building",
  },
  {
    path: "/departamentos",
    label: "Departamentos",
    iconClass: "fi fi-rr-apps",
  },
  {
    path: "/configuracoes",
    label: "Configurações",
    iconClass: "fi fi-rr-settings",
    requiresDepartment: true,
    coordinatorOnly: true,
  },
];

export function getResponsibleNames(responsible?: string | null): string[] {
  if (!responsible) return [];
  return responsible.split(/\s+e\s+/).map((name) => name.trim()).filter(Boolean);
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  assembleia_circuito: "Assembleia com o Superintendente de Circuito",
  assembleia_representante: "Assembleia com o Representante de Betel",
  congresso_regional: "Congresso Regional",
};

export function getEventoTipoLabel(tipo?: EventoTipo | null): string {
  return EVENT_TYPE_LABELS[String(tipo)] || String(tipo ?? "");
}

function extractYearFromDate(data_evento?: string | null): number {
  if (!data_evento) return new Date().getFullYear();
  return new Date(data_evento + "T12:00:00").getFullYear();
}

function parseCircuitos(circuito?: string | null): string[] {
  if (!circuito) return [];
  return circuito.split(" / ").map((s) => s.trim()).filter(Boolean);
}

const ASSEMBLEIA_NOMENCLATURE: Record<string, string> = {
  assembleia_circuito: "Assembleia de circuito com o superintendente de circuito",
  assembleia_representante: "Assembleia de circuito com o representante de betel",
};

export function formatEventoNome(evento?: Evento | null): string {
  if (!evento) return "";
  const tipo = evento.tipo;
  const label = getEventoTipoLabel(tipo);

  if (ASSEMBLEIA_TYPES.includes(String(tipo))) {
    const nomeBase = ASSEMBLEIA_NOMENCLATURE[String(tipo)] || label;
    const circuitos = parseCircuitos(evento.circuito);
    return circuitos.length > 0
      ? `${nomeBase} - ${circuitos.join(", ")}`
      : nomeBase;
  }

  const parts = [label];
  if (evento.cidade) parts.push(evento.cidade);
  if (evento.estado) parts.push(evento.estado);
  if (evento.circuito) parts.push(`(${evento.circuito})`);
  const ano = extractYearFromDate(evento.data_evento);
  if (ano) parts.push(String(ano));
  return parts.join(" ");
}

export function formatEventoDate(evento?: Evento | null): string {
  if (!evento?.data_evento) return "";
  return new Date(evento.data_evento + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatEventoSubtitle(evento?: Evento | null): string {
  if (!evento) return "";
  const parts: string[] = [];
  if (evento.cidade && evento.estado) {
    parts.push(`${evento.cidade}/${evento.estado}`);
  } else if (evento.estado) {
    parts.push(evento.estado);
  }
  if (evento.circuito) parts.push(evento.circuito);
  return parts.join(" - ");
}

export function formatEventoFull(evento?: Evento | null): string {
  if (!evento) return "";
  const nome = formatEventoNome(evento);
  const dateStr = formatEventoDate(evento);
  return dateStr ? `${nome} - ${dateStr}` : nome;
}

export const STAT_ICON_PATHS: Record<string, string> = {
  clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
};
