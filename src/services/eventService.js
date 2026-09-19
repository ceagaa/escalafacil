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

export async function upsertEvento({ tipo, estado, cidade, circuito, ano, identificacoes }) {
  const slug = generateEventSlug(tipo, estado, cidade, circuito, ano, identificacoes);

  const { data, error } = await supabase
    .from("eventos")
    .upsert(
      { slug, tipo, estado, cidade, circuito, ano },
      { onConflict: "slug" }
    )
    .select()
    .single();

  if (error) throw new Error(sanitizeError(error, "create"));
  return data;
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
  const { error } = await supabase
    .from("evento_departamentos")
    .insert({ evento_id: eventoId, department_id: departmentId });

  if (error) {
    if (error.code === "23505") return;
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
