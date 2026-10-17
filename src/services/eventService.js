import { supabase } from "./supabase";
import { sanitizeError } from "../utils/errors.js";

function normalizeSlugPart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^-|-$/g, "");
}

function normalizeIdentificacoes(identificacoes) {
  if (!Array.isArray(identificacoes) || identificacoes.length === 0) return "";
  return identificacoes
    .filter((id) => id && String(id).trim() !== "")
    .map((id) => normalizeSlugPart(id))
    .sort()
    .join("-");
}

const ASSEMBLEIA_TYPES = ["assembleia_circuito", "assembleia_representante"];

export function extractYearFromDate(data_evento) {
  if (!data_evento) return new Date().getFullYear();
  return new Date(data_evento + "T12:00:00").getFullYear();
}

export function generateEventSlug(tipo, estado, cidade, circuito, ano, identificacoes) {
  const t = normalizeSlugPart(tipo);
  const ids = normalizeIdentificacoes(identificacoes) || normalizeSlugPart(circuito);

  if (ASSEMBLEIA_TYPES.includes(tipo)) {
    return `${t}-${ids}-${ano}`;
  }

  const uf = normalizeSlugPart(estado);
  const c = normalizeSlugPart(cidade);
  return `${t}-${uf}-${c}-${ids}-${ano}`;
}

export async function upsertEvento({ tipo, estado, cidade, circuito, identificacoes, data_evento, userId }) {
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
  return data;
}

export async function updateEvento(id, { tipo, estado, cidade, circuito, data_evento }) {
  const ano = extractYearFromDate(data_evento);
  const { data, error } = await supabase
    .from("eventos")
    .update({ tipo, estado, cidade, circuito, ano, data_evento: data_evento || null })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(sanitizeError(error, "update"));
  return data;
}

export async function deleteEvento(id) {
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

export async function listEventos() {
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .order("ano", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(sanitizeError(error, "fetch"));
  return Array.isArray(data) ? data : [];
}

export async function getCoordinatedEventoIds(userId) {
  if (!userId) throw new Error("userId is required");

  const { data: memberships, error: membershipError } = await supabase
    .from("department_members")
    .select("evento_id, department_id")
    .eq("user_id", userId)
    .eq("role", "coordenador");

  if (membershipError) throw new Error(sanitizeError(membershipError, "fetch"));

  const eventoIds = new Set((memberships || []).map((membership) => membership.evento_id).filter(Boolean));
  const departmentIds = new Set(
    (memberships || [])
      .filter((membership) => !membership.evento_id)
      .map((membership) => membership.department_id)
      .filter(Boolean)
  );

  const { data: ownedDepartments, error: departmentsError } = await supabase
    .from("departments")
    .select("id")
    .eq("coordenador_id", userId);

  if (departmentsError) throw new Error(sanitizeError(departmentsError, "fetch"));
  (ownedDepartments || []).forEach((department) => {
    if (department.id) departmentIds.add(department.id);
  });

  if (departmentIds.size === 0) return [...eventoIds];

  const { data: eventDepartments, error: eventDepartmentsError } = await supabase
    .from("evento_departamentos")
    .select("evento_id")
    .in("department_id", [...departmentIds]);

  if (eventDepartmentsError) throw new Error(sanitizeError(eventDepartmentsError, "fetch"));
  (eventDepartments || []).forEach((link) => {
    if (link.evento_id) eventoIds.add(link.evento_id);
  });

  return [...eventoIds];
}

export async function getEventoById(id) {
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(sanitizeError(error, "fetch"));
  return data;
}

export async function linkDepartmentToEvento(eventoId, departmentId) {
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

export async function getEventDepartments(eventoId) {
  const { data, error } = await supabase
    .from("evento_departamentos")
    .select("*, department:departments(id, name, slug, features)")
    .eq("evento_id", eventoId);

  if (error) throw new Error(sanitizeError(error, "fetch"));
  return Array.isArray(data) ? data : [];
}

export async function getUserEvents(userId) {
  const { data, error } = await supabase
    .from("department_members")
    .select("evento_id, eventos!inner(id, tipo, estado, cidade, circuito, ano, slug)")
    .eq("user_id", userId)
    .not("evento_id", "is", null);

  if (error) throw new Error(sanitizeError(error, "fetch"));
  return Array.isArray(data) ? data : [];
}

export async function getDepartmentHistory(departmentId, currentEventoId) {
  const { data, error } = await supabase
    .from("department_members")
    .select("evento_id, eventos!inner(id, tipo, estado, cidade, ano, slug)")
    .eq("department_id", departmentId)
    .not("evento_id", "is", null)
    .neq("evento_id", currentEventoId);

  if (error) throw new Error(sanitizeError(error, "fetch"));
  return Array.isArray(data) ? data : [];
}

export async function importVolunteersFromEvento(fromEventoId, departmentId) {
  console.log("[importVolunteersFromEvento] Mock:", { fromEventoId, departmentId });
  return { imported: 0, message: "Função de importação mockada. Será implementada posteriormente." };
}
