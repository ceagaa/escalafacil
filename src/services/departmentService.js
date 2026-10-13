import { supabase } from "./supabase";
import { sanitizeError } from "../utils/errors.js";

export const STANDARD_DEPARTMENTS = [
  { name: "Contas", slug: "contas" },
  { name: "Indicadores", slug: "indicadores" },
  { name: "Áudio e vídeo", slug: "audio-e-video" },
  { name: "Batismo", slug: "batismo" },
  { name: "Primeiros socorros", slug: "primeiros-socorros" },
  { name: "Informações e serviço voluntário", slug: "informacoes-e-servico-voluntario" },
  { name: "Achados/perdidos e guarda-volumes", slug: "achados-perdidos-e-guarda-volumes" },
  { name: "Montagem", slug: "montagem" },
  { name: "Estacionamento", slug: "estacionamento" },
  { name: "Hospedagem", slug: "hospedagem" },
  { name: "Segurança", slug: "seguranca" },
  { name: "Transporte e equipamentos", slug: "transporte-e-equipamentos" },
];

export async function getDashboardStats() {
  const { data, error } = await supabase.rpc("get_dashboard_stats");
  if (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
  return data;
}

export async function getDepartmentOwnerBySlugRpc(slug) {
  const { data, error } = await supabase.rpc("get_department_owner_by_slug", {
    p_slug: slug,
  });
  if (error) return null;
  return data || null;
}

export async function getDepartmentOwner(departmentId) {
  const { data, error } = await supabase
    .from("departments")
    .select("coordenador_id, profiles:coordenador_id(name)")
    .eq("id", departmentId)
    .not("coordenador_id", "is", null)
    .maybeSingle();

  if (error || !data) return null;

  return data.profiles?.name || null;
}

export async function getDepartmentOwnerBySlug(slug) {
  const { data: department, error } = await supabase
    .from("departments")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !department) return null;

  return getDepartmentOwner(department.id);
}

export async function createDepartment(name, slug, eventoId) {
  const departmentSlug =
    slug ||
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const { data, error } = await supabase
    .from("departments")
    .insert({ name, slug: departmentSlug })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing, error: fetchError } = await supabase
        .from("departments")
        .select("id, name, slug")
        .eq("slug", departmentSlug)
        .maybeSingle();

      if (!fetchError && existing) {
        if (eventoId) {
          const eventOwner = await getEventoDepartmentOwner(existing.id, eventoId);
          if (eventOwner) {
            throw new Error("Departamento já possui coordenador para este evento: " + eventOwner.name);
          }
        }
        return existing;
      }
      throw new Error(
        "Este nome de departamento já está em uso por outra equipe. Escolha outro nome ou contate os administradores."
      );
    }
    throw new Error(sanitizeError(error, "create"));
  }

  return data;
}

export async function linkUserAsCoordinator(departmentId, userId, eventoId) {
  const payload = {
    department_id: departmentId,
    user_id: userId,
    role: "coordenador",
  };
  if (eventoId) payload.evento_id = eventoId;

  const { error } = await supabase
    .from("department_members")
    .insert(payload);

  if (error) {
    throw new Error(sanitizeError(error, "create"));
  }
}

/**
 * Claim a department for a user as coordinator within a specific event.
 * Writes ONLY to department_members (event-scoped membership).
 * The departments table is left untouched — the UI updates optimistically.
 */
export async function claimDepartmentForEvento(departmentId, eventoId, userId) {
  if (!eventoId) throw new Error("Evento ID é obrigatório para assumir departamento.");

  const { data, error } = await supabase
    .from("department_members")
    .upsert({
      evento_id: eventoId,
      department_id: departmentId,
      user_id: userId,
      role: 'coordenador'
    }, { onConflict: 'evento_id,department_id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get the coordinator of a department for a specific event.
 * Reads from department_members (event-scoped) with profile join.
 */
export async function getEventoDepartmentOwner(departmentId, eventoId) {
  const { data, error } = await supabase
    .from("department_members")
    .select("user_id, profiles:user_id(name)")
    .eq("department_id", departmentId)
    .eq("role", "coordenador")
    .eq("evento_id", eventoId || null)
    .maybeSingle();

  if (error || !data) return null;
  return { name: data.profiles?.name || null, userId: data.user_id || null };
}

export async function updateDepartmentFeatures(departmentId, features) {
  const { data, error } = await supabase
    .from("departments")
    .update({ features })
    .eq("id", departmentId)
    .select()
    .single();

  if (error) {
    throw new Error(sanitizeError(error, "update"));
  }

  return data;
}

export async function findProfileByEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, name")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }

  return data;
}

export async function addDepartmentMember(departmentId, userId, role = "assistente") {
  const { error } = await supabase
    .from("department_members")
    .insert({ department_id: departmentId, user_id: userId, role });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Este usuário já faz parte do departamento.");
    }
    throw new Error(sanitizeError(error, "create"));
  }
}

export async function listDepartmentMembers(departmentId) {
  const { data, error } = await supabase
    .from("department_members")
    .select("*, profiles(id, email)")
    .eq("department_id", departmentId);

  if (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }

  return Array.isArray(data) ? data : [];
}

export async function removeDepartmentMember(membershipId) {
  const { error } = await supabase
    .from("department_members")
    .delete()
    .eq("id", membershipId);

  if (error) {
    throw new Error(sanitizeError(error, "delete"));
  }
}

/**
 * Revoke coordination of a department.
 * Removes the coordinator from department_members.
 * Also clears departments.coordenador_id if it matches.
 */
export async function revokeDepartmentCoordinator(departmentId, userId) {
  // 1. Remove from department_members
  const { data: removed, error: removeError } = await supabase
    .from("department_members")
    .delete()
    .eq("department_id", departmentId)
    .eq("user_id", userId)
    .eq("role", "coordenador")
    .select("id");

  if (removeError) {
    throw new Error(sanitizeError(removeError, "delete"));
  }

  if (!removed || removed.length === 0) {
    throw new Error("Não foi possível revogar a coordenação. Verifique se você ainda é o coordenador.");
  }

  // 2. Also clear departments.coordenador_id if it matches
  await supabase
    .from("departments")
    .update({ coordenador_id: null })
    .eq("id", departmentId)
    .eq("coordenador_id", userId);

  return { id: departmentId };
}

export async function createStandardDepartmentsForEvento(eventoId) {
  if (!eventoId) return [];

  // 1. Check if the event already has linked departments
  const { data: existingLinks } = await supabase
    .from("evento_departamentos")
    .select("department_id")
    .eq("evento_id", eventoId);

  if (existingLinks && existingLinks.length > 0) {
    // Departments already linked — return them without re-creating
    const { data: existingDepts } = await supabase
      .from("evento_departamentos")
      .select("department:departments(id, name, slug)")
      .eq("evento_id", eventoId);

    return (existingDepts || []).map((row) => row.department).filter(Boolean);
  }

  // 2. No departments exist for this event — create them
  const rows = STANDARD_DEPARTMENTS.map((dept) => ({
    name: dept.name,
    slug: dept.slug,
  }));

  const { data, error } = await supabase
    .from("departments")
    .upsert(rows, { onConflict: "slug" })
    .select("id, name, slug");

  if (error) throw new Error(sanitizeError(error, "create"));

  const created = Array.isArray(data) ? data : [];

  const linkRows = created.map((dept) => ({
    evento_id: eventoId,
    department_id: dept.id,
  }));

  if (linkRows.length > 0) {
    const { error: linkError } = await supabase
      .from("evento_departamentos")
      .upsert(linkRows, { onConflict: "evento_id,department_id" });

    if (linkError && linkError.code !== "23505") {
      console.error("Erro ao vincular departamentos ao evento:", linkError);
    }
  }

  return created;
}
