import { apiGet } from "./api";
import type { DepartmentOwner, DepartmentRecord } from "../types";

/**
 * Slugs dos departamentos padrão (espelha departmentService.STANDARD_DEPARTMENTS;
 * mantido local para o Dashboard não depender desse módulo).
 */
const STANDARD_SLUGS = [
  "contas",
  "indicadores",
  "audio-e-video",
  "batismo",
  "primeiros-socorros",
  "informacoes-e-servico-voluntario",
  "achados-perdidos-e-guarda-volumes",
  "montagem",
  "estacionamento",
  "hospedagem",
  "seguranca",
  "transporte-e-equipamentos",
];

/** Eventos já reparados nesta sessão (evita repetir escrita a cada load). */
const healedEventos = new Set<string>();

/**
 * Departamentos padrão lidos de `departments` (leitura autenticada).
 * Rede de segurança: a grade NUNCA pode ficar vazia por problemas em
 * evento_departamentos (links vazios/faltantes/ilegíveis).
 */
async function fetchStandardDepartments(): Promise<DepartmentRecord[]> {
  try {
    const data = await apiGet<DepartmentRecord[]>(
      `/api/departments/standard?slug_in=${STANDARD_SLUGS.join(",")}`
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("Falha ao buscar departamentos padrão:", (error as Error)?.message);
    return [];
  }
}

/**
 * Repara em background os vínculos padrão que faltarem no evento.
 * A exibição já foi resolvida antes (union) — isto só persiste a correção.
 */
function healEventLinks(eventoId: string): void {
  if (!eventoId || healedEventos.has(eventoId)) return;
  healedEventos.add(eventoId);
  import("./departmentService")
    .then((mod) => mod.linkStandardDepartmentsToEvento?.(eventoId))
    .then((result) => {
      if (result && result.linked > 0) {
        console.info("Vínculos de departamentos reparados no evento:", result.linked);
      }
    })
    .catch((error) => console.warn("Não foi possível reparar os vínculos do evento:", (error as Error)?.message));
}

/**
 * Consulta dos departamentos de um evento, já com o coordenador resolvido.
 *
 * Fica num módulo próprio (e não dentro de Dashboard.jsx) para poder ser
 * mockada nos testes de página — a mesma razão pela qual o Dashboard consome
 * `fetchEventDepartments` como dependência, e não como função local.
 */
export async function fetchOwnersMap(eventoId: string | null | undefined): Promise<Map<string, DepartmentOwner>> {
  if (!eventoId) return new Map();

  // O Worker resolve o coordenador (department_members + profiles) num único
  // endpoint; se falhar, devolvemos mapa vazio — os cards caem no fallback
  // de `departments.coordenador_id`.
  try {
    const rows = await apiGet<Array<{ department_id?: string | null; user_id?: string | null; name?: string | null }>>(
      `/api/eventos/${encodeURIComponent(eventoId)}/owners`
    );
    const map = new Map<string, DepartmentOwner>();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row?.department_id) return;
      map.set(row.department_id, { userId: row.user_id || null, name: row.name ?? null });
    });
    return map;
  } catch (error) {
    console.warn("Falha ao buscar coordenadores do evento:", (error as Error)?.message);
    return new Map();
  }
}

/**
 * Resolve o coordenador de um departamento.
 * Prioriza `department_members` do evento (fonte de verdade) e só recorre à
 * coluna legada `departments.coordenador_id` quando não há membership.
 */
export function applyEventOwner(dept: DepartmentRecord, owners: Map<string, DepartmentOwner>): DepartmentRecord {
  const owner = owners.get(dept.id);
  if (owner?.userId) {
    return { ...dept, coordenador_id: owner.userId, ownerName: owner.name, ownerId: owner.userId };
  }
  const fallbackId = dept.coordenador_id ?? null;
  return {
    ...dept,
    coordenador_id: fallbackId,
    ownerName: dept.coordenador?.name ?? null,
    ownerId: fallbackId,
  };
}

/**
 * Departamentos vinculados ao evento, com o coordenador do evento aplicado.
 *
 * A consulta é única e tolerante: se falhar, a lista fica vazia e o fallback
 * de departamentos padrão (abaixo) ainda roda para a grade não ficar em branco
 * para quem não tem vínculo.
 */
export async function fetchEventDepartments(eventoId: string | null | undefined): Promise<DepartmentRecord[]> {
  if (!eventoId) return [];

  const ownersPromise = fetchOwnersMap(eventoId);

  let list: DepartmentRecord[] = [];
  try {
    const data = await apiGet<DepartmentRecord[]>(
      `/api/eventos/${encodeURIComponent(eventoId)}/departments`
    );
    list = Array.isArray(data)
      ? data.filter((dept): dept is DepartmentRecord => Boolean(dept))
      : [];
  } catch (error) {
    console.warn("Falha ao listar departamentos do evento:", (error as Error)?.message);
    // Não damos return aqui: o fallback de departamentos padrão (abaixo)
    // ainda precisa rodar para a grade não ficar em branco.
  }

  // Grade completa: os departamentos padrão precisam aparecer em TODO evento,
  // mesmo que evento_departamentos esteja vazio ou incompleto.
  const standard = await fetchStandardDepartments();
  if (standard.length > 0) {
    const linkedIds = new Set(list.map((dept) => dept?.id).filter(Boolean) as string[]);
    const missing = standard.filter((dept) => !linkedIds.has(dept.id));
    if (missing.length > 0) {
      list = [...list, ...missing];
      healEventLinks(eventoId);
    }
  }

  const owners = await ownersPromise;
  return list.map((dept) => applyEventOwner(dept, owners));
}

/** Separa os departamentos em três grupos, conforme quem coordena cada um. */
export function groupDepartments(
  deptRecords: DepartmentRecord[],
  userId?: string | null
): { mine: DepartmentRecord[]; takenByOthers: DepartmentRecord[]; available: DepartmentRecord[] } {
  const mine: DepartmentRecord[] = [];
  const takenByOthers: DepartmentRecord[] = [];
  const available: DepartmentRecord[] = [];
  for (const dept of deptRecords) {
    if (!dept) continue;
    if (dept.coordenador_id && dept.coordenador_id === userId) mine.push(dept);
    else if (dept.coordenador_id) takenByOthers.push(dept);
    else available.push(dept);
  }
  return { mine, takenByOthers, available };
}

/** Rótulo do coordenador usado nos cards de departamento ocupado. */
export function ownerLabel(dept?: DepartmentRecord | null): string {
  return dept?.ownerName || dept?.coordenador?.name || "Coordenador";
}
