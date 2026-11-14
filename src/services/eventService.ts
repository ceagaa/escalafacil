import { apiDelete, apiGet, apiPatch, apiPost } from "./api";
import { sanitizeError } from "../utils/errors";
import type { Evento, EventoTipo } from "../types";

function normalizeSlugPart(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^-|-$/g, "");
}

function normalizeIdentificacoes(identificacoes?: string[] | null): string {
  if (!Array.isArray(identificacoes) || identificacoes.length === 0) return "";
  return identificacoes
    .filter((id) => id && String(id).trim() !== "")
    .map((id) => normalizeSlugPart(id))
    .sort()
    .join("-");
}

const ASSEMBLEIA_TYPES = ["assembleia_circuito", "assembleia_representante"];

export function extractYearFromDate(data_evento?: string | null): number {
  if (!data_evento) return new Date().getFullYear();
  return new Date(data_evento + "T12:00:00").getFullYear();
}

export function generateEventSlug(
  tipo: EventoTipo,
  estado?: string | null,
  cidade?: string | null,
  circuito?: string | null,
  ano?: number,
  identificacoes?: string[] | null
): string {
  const t = normalizeSlugPart(tipo);
  const ids = normalizeIdentificacoes(identificacoes) || normalizeSlugPart(circuito);

  if (ASSEMBLEIA_TYPES.includes(String(tipo))) {
    return `${t}-${ids}-${ano}`;
  }

  const uf = normalizeSlugPart(estado);
  const c = normalizeSlugPart(cidade);
  return `${t}-${uf}-${c}-${ids}-${ano}`;
}

export interface UpsertEventoInput {
  tipo: EventoTipo;
  estado?: string | null;
  cidade?: string | null;
  circuito?: string | null;
  identificacoes?: string[] | null;
  data_evento?: string | null;
  userId?: string | null;
}

/**
 * Upsert por slug — o Worker sobrescreve os dados se o slug já existir e
 * define `criado_por` a partir da sessão (o `userId` é mantido na assinatura
 * por compatibilidade, mas a fonte de verdade é o servidor).
 */
export async function upsertEvento({
  tipo,
  estado,
  cidade,
  circuito,
  identificacoes,
  data_evento,
}: UpsertEventoInput): Promise<Evento> {
  const ano = extractYearFromDate(data_evento);
  const slug = generateEventSlug(tipo, estado, cidade, circuito, ano, identificacoes);

  try {
    return await apiPost<Evento>("/api/eventos", {
      slug,
      tipo,
      estado,
      cidade,
      circuito,
      ano,
      data_evento: data_evento || null,
    });
  } catch (error) {
    throw new Error(sanitizeError(error, "create"));
  }
}

export interface UpdateEventoInput {
  tipo: EventoTipo;
  estado?: string | null;
  cidade?: string | null;
  circuito?: string | null;
  data_evento?: string | null;
}

export async function updateEvento(id: string, {
  tipo,
  estado,
  cidade,
  circuito,
  data_evento,
}: UpdateEventoInput): Promise<Evento> {
  const ano = extractYearFromDate(data_evento);
  try {
    return await apiPatch<Evento>(`/api/eventos/${encodeURIComponent(id)}`, {
      tipo,
      estado,
      cidade,
      circuito,
      ano,
      data_evento: data_evento || null,
    });
  } catch (error) {
    throw new Error(sanitizeError(error, "update"));
  }
}

export async function deleteEvento(id: string): Promise<void> {
  try {
    await apiDelete(`/api/eventos/${encodeURIComponent(id)}`);
  } catch (error) {
    throw new Error(sanitizeError(error, "delete"));
  }
}

export async function listEventos(): Promise<Evento[]> {
  try {
    const data = await apiGet<Evento[]>("/api/eventos");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
}

/**
 * IDs de eventos que o usuário coordena:
 *   1. vínculos `department_members` onde é coordenador;
 *   2. departamentos com `coordenador_id` legado apontando para ele;
 *   3. eventos desses departamentos legados (via /api/departments/links).
 */
export async function getCoordinatedEventoIds(userId: string): Promise<string[]> {
  if (!userId) throw new Error("userId is required");

  try {
    const memberships = await apiGet<Array<{ evento_id?: string | null; department_id?: string | null }>>(
      `/api/members?user_id=${encodeURIComponent(userId)}&role=coordenador`
    );

    const eventoIds = new Set(
      (memberships || []).map((m) => m.evento_id).filter(Boolean) as string[]
    );
    const departmentIds = new Set(
      (memberships || [])
        .filter((m) => !m.evento_id)
        .map((m) => m.department_id)
        .filter(Boolean) as string[]
    );

    const ownedDepartments = await apiGet<Array<{ id?: string | null }>>(
      `/api/departments?coordenador_id=${encodeURIComponent(userId)}`
    );
    (ownedDepartments || []).forEach((department) => {
      if (department.id) departmentIds.add(department.id);
    });

    if (departmentIds.size === 0) return [...eventoIds];

    const links = await apiGet<Array<{ evento_id?: string | null }>>(
      `/api/departments/links?department_id_in=${[...departmentIds].map(encodeURIComponent).join(",")}`
    );
    (links || []).forEach((link) => {
      if (link.evento_id) eventoIds.add(link.evento_id);
    });

    return [...eventoIds];
  } catch (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
}

/** Vincula departamento ao evento — idempotente no Worker (duplicata é aceita). */
export async function linkDepartmentToEvento(eventoId: string, departmentId: string): Promise<void> {
  try {
    await apiPost(`/api/eventos/${encodeURIComponent(eventoId)}/departments`, {
      department_id: departmentId,
    });
  } catch (error) {
    throw new Error(sanitizeError(error, "create"));
  }
}

/** Histórico de coordenação do departamento em outros eventos. */
export async function getDepartmentHistory(departmentId: string, currentEventoId: string) {
  try {
    const data = await apiGet<Array<{ evento_id?: string | null; eventos?: unknown }>>(
      `/api/departments/${encodeURIComponent(departmentId)}/history?evento_id=${encodeURIComponent(currentEventoId)}`
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
}

export async function importVolunteersFromEvento(fromEventoId: string, departmentId: string) {
  console.log("[importVolunteersFromEvento] Mock:", { fromEventoId, departmentId });
  return { imported: 0, message: "Função de importação mockada. Será implementada posteriormente." };
}
