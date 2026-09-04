import { supabase } from "./supabase";

export const STANDARD_DEPARTMENTS = [
  { name: "Achados Perdidos e Guarda Volumes", slug: "achados-perdidos-guarda-volumes" },
  { name: "Indicadores", slug: "indicadores" },
  { name: "Limpeza", slug: "limpeza" },
];

export async function getDashboardStats() {
  const { data, error } = await supabase.rpc("get_dashboard_stats");
  if (error) {
    throw new Error(error.message || "Erro ao carregar estatísticas.");
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
    .from("department_members")
    .select("role, profiles(name)")
    .eq("department_id", departmentId)
    .eq("role", "coordenador")
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

export async function createDepartment(name, slug) {
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
        const ownerName = await getDepartmentOwner(existing.id);
        if (ownerName) {
          throw new Error("Departamento já criado. Responsável: " + ownerName);
        }
        // Departamento órfão (existe, mas sem coordenador): permite reivindicar.
        return existing;
      }
      throw new Error(
        "Este nome de departamento já está em uso por outra equipe. Escolha outro nome ou contate os administradores."
      );
    }
    throw new Error(error.message || "Erro ao criar departamento.");
  }

  return data;
}

export async function linkUserAsCoordinator(departmentId, userId) {
  const { error } = await supabase
    .from("department_members")
    .insert({
      department_id: departmentId,
      user_id: userId,
      role: "coordenador",
    });

  if (error) {
    throw new Error(error.message || "Erro ao vincular ao departamento.");
  }
}

export async function updateDepartmentFeatures(departmentId, features) {
  const { data, error } = await supabase
    .from("departments")
    .update({ features })
    .eq("id", departmentId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Erro ao atualizar configurações do departamento.");
  }

  return data;
}

export async function findProfileByEmail(email) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("email", String(email || "").trim())
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Erro ao buscar usuário.");
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
    throw new Error(error.message || "Erro ao adicionar membro.");
  }
}

export async function listDepartmentMembers(departmentId) {
  const { data, error } = await supabase
    .from("department_members")
    .select("*, profiles(id, email)")
    .eq("department_id", departmentId);

  if (error) {
    throw new Error(error.message || "Erro ao listar membros.");
  }

  return Array.isArray(data) ? data : [];
}

export async function removeDepartmentMember(membershipId) {
  const { error } = await supabase
    .from("department_members")
    .delete()
    .eq("id", membershipId);

  if (error) {
    throw new Error(error.message || "Erro ao remover membro.");
  }
}
