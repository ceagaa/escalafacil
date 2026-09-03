import { supabase } from "./supabase";

export async function createDepartment(name) {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const { data, error } = await supabase
    .from("departments")
    .insert({ name, slug })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
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
