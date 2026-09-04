import { encryptData, decryptData, isLocalStorageAvailable } from "./crypto.js";

function decodeContacts(encoded) {
  return Object.fromEntries(
    Object.entries(encoded).map(([k, v]) => [k, atob(v)])
  );
}

export const responsibleContacts = decodeContacts({
  Carlos: "MTE5NTIzODk5MjI=",
  Adenilton: "ODM5OTExMzQwNjY=",
  David: "ODM5ODc2NzU1NjA=",
  Eduardo: "ODM5ODgxOTc0NDE=",
});

export const dayTheme = {
  "Sexta-feira": { key: "sexta", color: "#D65A00", soft: "rgba(214, 90, 0, 0.10)", border: "rgba(214, 90, 0, 0.18)" },
  Sábado: { key: "sabado", color: "#345C3F", soft: "rgba(52, 92, 63, 0.10)", border: "rgba(52, 92, 63, 0.18)" },
  Domingo: { key: "domingo", color: "#0A5883", soft: "rgba(10, 88, 131, 0.10)", border: "rgba(10, 88, 131, 0.18)" },
};

export const UNASSIGNED_LABEL = "Aguardando escala";
export const OFFLINE_CACHE_KEY = "ap_offline_snapshot_v1";

export const initialSchedule = [
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

export const initialVolunteers = [];

export const initialItems = [
  { id: "i-1", person: "Maria S.", item: "Bolsa preta", day: "Sexta-feira", status: "Guardado", photo: "" },
  { id: "i-2", person: "João P.", item: "Chaveiro", day: "Sábado", status: "Guardado", photo: "" },
  { id: "i-3", person: "Ana L.", item: "Óculos", day: "Domingo", status: "Entregue", photo: "" },
];

export function emptyVolunteer() {
  return { id: "", name: "", congregation: "", phone: "", active: true };
}

export function emptyItem() {
  return { id: "", person: "", item: "", day: "Sexta-feira", status: "Guardado", photo: "" };
}

export function sanitizeSchedule(schedule) {
  if (!Array.isArray(schedule) || schedule.length === 0) return initialSchedule;
  return isValidSchedule(schedule) ? schedule : initialSchedule;
}

export function isValidSchedule(schedule) {
  if (!Array.isArray(schedule)) return false;
  if (schedule.length < 6) return false;
  const totalShifts = schedule.reduce((total, block) => total + (Array.isArray(block.shifts) ? block.shifts.length : 0), 0);
  return totalShifts >= 16;
}

export function sortScheduleBlocks(blocks) {
  const order = ["sex-manha", "sex-tarde", "sab-manha", "sab-tarde", "dom-manha", "dom-tarde"];
  return [...blocks].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

export function sortShifts(shifts) {
  const order = initialSchedule.flatMap((block) => block.shifts.map((shift) => shift.id));
  return [...shifts].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

export function mapDbItemToApp(item) {
  return {
    id: item.id,
    item: item.item || "",
    person: item.person || "",
    day: item.day || "Sexta-feira",
    status: item.status || "Guardado",
    photo: item.photo_url || "",
  };
}

export function mapAppItemToDb(item) {
  return {
    item: item.item,
    person: item.person,
    day: item.day,
    status: item.status,
    photo_url: item.photo || "",
  };
}

export function mapAppVolunteerToDb(volunteer) {
  return {
    name: volunteer.name,
    congregation: volunteer.congregation || "",
    phone: volunteer.phone || "",
    active: volunteer.active !== false,
  };
}

export function getResponsibleNames(responsible) {
  return String(responsible || "")
    .replaceAll("Carlos Henrique", "Carlos")
    .replaceAll(" e ", ",")
    .replaceAll("/", ",")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

export function createWhatsAppUrl(phone) {
  const onlyNumbers = String(phone || "").replace(/\D/g, "");
  if (!onlyNumbers) return "";
  const withCountryCode = onlyNumbers.startsWith("55") ? onlyNumbers : "55" + onlyNumbers;
  return "https://api.whatsapp.com/send?phone=" + withCountryCode;
}

export function createWaMeLink(phone, text) {
  const onlyNumbers = String(phone || "").replace(/\D/g, "");
  if (!onlyNumbers) return "";
  const withCountryCode = onlyNumbers.startsWith("55") ? onlyNumbers : "55" + onlyNumbers;
  const suffix = text ? "?text=" + encodeURIComponent(text) : "";
  return "https://wa.me/" + withCountryCode + suffix;
}

export const AVAILABILITY_SLOT_LABELS = {
  "sexta-manha": "Sexta · Manhã",
  "sexta-tarde": "Sexta · Tarde",
  "sabado-manha": "Sábado · Manhã",
  "sabado-tarde": "Sábado · Tarde",
  "domingo-manha": "Domingo · Manhã",
  "domingo-tarde": "Domingo · Tarde",
};

export function parseAvailability(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function getAvailabilitySlotId(day, period) {
  const key = dayTheme[day]?.key || "";
  if (!key) return "";
  const periodKey = String(period || "").toLowerCase().trim() === "tarde" ? "tarde" : "manha";
  return key + "-" + periodKey;
}

export function volunteerIsAvailable(volunteer, day, period) {
  const slotId = getAvailabilitySlotId(day, period);
  if (!slotId) return false;
  return parseAvailability(volunteer?.availability).includes(slotId);
}

export function buildAssignmentMessage(volunteer, { day, period, start, end }, departmentName = "") {
  const local = departmentName ? ` Local: ${departmentName}.` : "";
  return `Olá ${volunteer.name}, sua designação para ${day} - ${period} está confirmada para as ${start} até ${end}.${local}`;
}

export function buildDaySummary(schedule, day, volunteers, departmentName = "") {
  const blocks = schedule.filter((block) => block.day === day);
  const lines = [`*Escala ${day}*${departmentName ? " — " + departmentName : ""}`];
  for (const block of blocks) {
    lines.push("");
    lines.push(`*${block.day} · ${block.period}*${block.responsible ? " (Resp.: " + block.responsible + ")" : ""}`);
    block.shifts.forEach((shift) => {
      const names = shift.volunteerIds
        .map((id) => volunteers.find((volunteer) => String(volunteer.id) === String(id)))
        .filter(Boolean)
        .map((volunteer) => volunteer.name);
      const manualNames = (shift.manualNames || []).map((name) => name + " (Avulso)");
      const allNames = [...names, ...manualNames];
      lines.push(`• ${shift.start} às ${shift.end}: ${allNames.length ? allNames.join(", ") : "Aguardando escala"}`);
    });
  }
  return lines.join("\n");
}

export function makeId(prefix) {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

export function statusClass(status) {
  if (status === "Entregue") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

export function extractTimeMinutes(value) {
  const firstPart = String(value || "").trim().split(" ")[0];
  const parts = firstPart.split(":");
  if (parts.length !== 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function getCurrentMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

export function getTodayScheduleDay(date = new Date()) {
  const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  return days[date.getDay()];
}

export function isCurrentShift(shift, currentMinutes) {
  const start = extractTimeMinutes(shift.start);
  const end = extractTimeMinutes(shift.end);
  if (start === null || end === null) return false;
  return currentMinutes >= start && currentMinutes < end;
}

export function findActiveShiftId(blocks, scheduleDay, todayDay, currentMinutes) {
  if (scheduleDay !== todayDay) return null;
  for (const block of blocks) {
    const activeShift = block.shifts.find((shift) => isCurrentShift(shift, currentMinutes));
    if (activeShift) return activeShift.id;
  }
  return null;
}

export function hexToRgba(hex, alpha) {
  const cleanHex = String(hex || "").replace("#", "");
  if (cleanHex.length !== 6) return "rgba(15, 23, 42, " + alpha + ")";
  const red = parseInt(cleanHex.slice(0, 2), 16);
  const green = parseInt(cleanHex.slice(2, 4), 16);
  const blue = parseInt(cleanHex.slice(4, 6), 16);
  return "rgba(" + red + ", " + green + ", " + blue + ", " + alpha + ")";
}

export function buildOfflineSnapshot(schedule, volunteers, items) {
  return { schedule, volunteers, items, savedAt: new Date().toISOString() };
}

export async function saveOfflineSnapshot(snapshot) {
  try {
    if (typeof window === "undefined" || !isLocalStorageAvailable()) return;
    const json = JSON.stringify(snapshot);
    const encrypted = await encryptData(json);
    window.localStorage.setItem(OFFLINE_CACHE_KEY, encrypted);
  } catch {
    console.warn("Não foi possível salvar o backup offline.");
  }
}

export async function loadOfflineSnapshot() {
  try {
    if (typeof window === "undefined" || !isLocalStorageAvailable()) return null;
    const raw = window.localStorage.getItem(OFFLINE_CACHE_KEY);
    if (!raw) return null;
    try {
      const decrypted = await decryptData(raw);
      return JSON.parse(decrypted);
    } catch {
      return JSON.parse(raw);
    }
  } catch {
    return null;
  }
}

export function formatCurrentDate(date = new Date()) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export const navigationItems = [
  { path: "/", label: "Início", iconClass: "fi fi-rr-home" },
  { path: "/programacao", label: "Escala", iconClass: "fi fi-rr-calendar-lines" },
  { path: "/voluntarios", label: "Voluntários", iconClass: "fi fi-rr-users" },
  { path: "/itens", label: "Itens Perdidos", iconClass: "fi fi-rr-ballot-check" },
  { path: "/configuracoes", label: "Configurações", iconClass: "fi fi-rr-settings" },
];

export const STAT_ICON_PATHS = {
  clock: "M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  checklist: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
};
