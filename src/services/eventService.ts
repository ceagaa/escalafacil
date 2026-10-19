import { supabase } from "./supabase";
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

export async function upsertEvento({
  tipo,
  estado,
  cidade,
  circuito,
  identificacoes,
  data_evento,
  userId,
}: UpsertEventoInput): Promise<Evento> {
  const ano = extractYearFromDate(data_evento);
  const slug = generateEventSlug(tipo, estado, cidade, circuito, ano, identificacoes);

  const { data, error } = await supabase
    .from("eventos")
    .upsert(
      { slug, tipo, estado, cidade, circuito, ano, data_evento: data_evento || null, criado_por: userId || null },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (error) throw new Error(sanitizeError(error, "create"));
  return data as Evento;
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
  const { data, error } = await supabase
    .from("eventos")
    .update({ tipo, estado, cidade, circuito, ano, data_evento: data_evento || null })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(sanitizeError(error, "update"));
  return data as Evento;
}

export async function deleteEvento(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("eventos")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) throw new Error(sanitizeError(error, "delete"));
  if (!data || data.length === 0) {
    throw new Error("Não foi possível excluir: você não é criador nem coordenador deste evento, ou ele já foi removido.");
  }
}

export async function listEventos(): Promise<Evento[]> {
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .order("ano", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(sanitizeError(error, "fetch"));
  return Array.isArray(data) ? (data as Evento[]) : [];
}

export async function getCoordinatedEventoIds(userId: string): Promise<string[]> {
  if (!userId) throw new Error("userId is required");

  const { data: memberships, error: membershipError } = await supabase
    .from("department_members")
    .select("evento_id, department_id")
    .eq("user_id", userId)
    .eq("role", "coordenador");

  if (membershipError) throw new Error(sanitizeError(membershipError, "fetch"));

  const eventoIds = new Set(
    (memberships || []).map((membership: { evento_id?: string | null }) => membership.evento_id).filter(Boolean) as string[]
  );
  const departmentIds = new Set(
    (memberships || [])
      .filter((membership: { evento_id?: string | null }) => !membership.evento_id)
      .map((membership: { department_id?: string | null }) => membership.department_id)
      .filter(Boolean) as string[]
  );

  const { data: ownedDepartments, error: departmentsError } = await supabase
    .from("departments")
    .select("id")
    .eq("coordenador_id", userId);

  if (departmentsError) throw new Error(sanitizeError(departmentsError, "fetch"));
  (ownedDepartments || []).forEach((department: { id?: string | null }) => {
    if (department.id) departmentIds.add(department.id);
  });

  if (departmentIds.size === 0) return [...eventoIds];

  const { data: eventDepartments, error: eventDepartmentsError } = await supabase
    .from("evento_departamentos")
    .select("evento_id")
    .in("department_id", [...departmentIds]);

  if (eventDepartmentsError) throw new Error(sanitizeError(eventDepartmentsError, "fetch"));
  (eventDepartments || []).forEach((link: { evento_id?: string | null }) => {
    if (link.evento_id) eventoIds.add(link.evento_id);
  });

  return [...eventoIds];
}


export async function linkDepartmentToEvento(eventoId: string, departmentId: string): Promise<void> {
  let { error } = await supabase
    .from("evento_departamentos")
    .insert({ evento_id: eventoId, department_id: departmentId });

  if (error) {
    if (error.code === "23505") return;
    if (error.message?.includes("department_id")) {
      const { error: fallbackErr } = await supabase
        .from("evento_departamentos")
        .insert({ evento_id: eventoId });
      if (fallbackErr && fallbackErr.code !== "23505") {
        throw new Error(sanitizeError(fallbackErr, "create"));
      }
      return;
    }
    throw new Error(sanitizeError(error, "create"));
  }
}



export async function getDepartmentHistory(departmentId: string, currentEventoId: string) {
  const { data, error } = await supabase
    .from("department_members")
    .select("evento_id, eventos!inner(id, tipo, estado, cidade, ano, slug)")
    .eq("department_id", departmentId)
    .not("evento_id", "is", null)
    .neq("evento_id", currentEventoId);

  if (error) throw new Error(sanitizeError(error, "fetch"));
  return Array.isArray(data) ? data : [];
}

export async function importVolunteersFromEvento(fromEventoId: string, departmentId: string) {
  console.log("[importVolunteersFromEvento] Mock:", { fromEventoId, departmentId });
  return { imported: 0, message: "Função de importação mockada. Será implementada posteriormente." };
}
