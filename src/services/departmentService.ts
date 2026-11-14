import { ApiError, apiDelete, apiGet, apiPost } from "./api";
import { sanitizeError } from "../utils/errors";
import type { DepartmentMemberRow, DepartmentRef } from "../types";

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

/** Nome do coordenador pelo slug (exibição em cartões públicos/admin). */
export async function getDepartmentOwnerBySlugRpc(slug: string) {
  try {
    const data = await apiGet<string | null>(
      `/api/departments/owner?slug=${encodeURIComponent(slug)}`
    );
    return data || null;
  } catch {
    return null;
  }
}

/** Nome do coordenador legado (`departments.coordenador_id`). */
export async function getDepartmentOwner(departmentId: string): Promise<string | null> {
  try {
    const data = await apiGet<{ userId: string | null; name: string | null } | null>(
      `/api/departments/${encodeURIComponent(departmentId)}/owner`
    );
    return data?.name || null;
  } catch {
    return null;
  }
}

export async function createDepartment(
  name: string,
  slug?: string,
  eventoId?: string | null
): Promise<DepartmentRef> {
  const departmentSlug =
    slug ||
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  try {
    // O Worker devolve o departamento existente quando o slug já está em uso
    // (e avisa com 409 se já houver coordenador no escopo do evento).
    return await apiPost<DepartmentRef>("/api/departments", {
      name,
      slug: departmentSlug,
      evento_id: eventoId ?? null,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "23505") {
      if (error.message.includes("Departamento já possui coordenador")) {
        throw new Error(error.message);
      }
      throw new Error(
        "Este nome de departamento já está em uso por outra equipe. Escolha outro nome ou contate os administradores."
      );
    }
    throw new Error(sanitizeError(error, "create"));
  }
}

/**
 * Define o usuário como coordenador do departamento (escopo legado quando
 * `eventoId` é nulo, escopo do evento quando informado). Só a si mesmo —
 * validado pelo Worker contra a sessão.
 */
export async function linkUserAsCoordinator(
  departmentId: string,
  userId: string,
  eventoId?: string | null
): Promise<void> {
  try {
    await apiPost(`/api/departments/${encodeURIComponent(departmentId)}/members`, {
      user_id: userId,
      role: "coordenador",
      evento_id: eventoId ?? null,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "23505") {
      throw new Error("Registro duplicado.");
    }
    throw new Error(sanitizeError(error, "create"));
  }
}

/**
 * Assume a coordenação do departamento num evento específico.
 * Escreve apenas em `department_members` (membership com escopo de evento).
 */
export async function claimDepartmentForEvento(
  departmentId: string,
  eventoId: string,
  _userId: string
) {
  if (!eventoId) throw new Error("Evento ID é obrigatório para assumir departamento.");

  const data = await apiPost<Record<string, unknown>>(
    `/api/departments/${encodeURIComponent(departmentId)}/claim`,
    { evento_id: eventoId }
  );
  return data;
}

/** Coordenador do departamento no escopo de um evento (fonte: department_members). */
export async function getEventoDepartmentOwner(
  departmentId: string,
  eventoId?: string | null
): Promise<{ name: string | null; userId: string | null } | null> {
  try {
    const query = eventoId ? `?evento_id=${encodeURIComponent(eventoId)}` : "";
    const data = await apiGet<{ userId: string | null; name: string | null } | null>(
      `/api/departments/${encodeURIComponent(departmentId)}/owner${query}`
    );
    return data;
  } catch {
    return null;
  }
}

export async function findProfileByEmail(email: string) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  try {
    return await apiGet<{ id: string; email: string | null; name: string | null } | null>(
      `/api/profiles?email=${encodeURIComponent(normalizedEmail)}`
    );
  } catch (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
}

export async function addDepartmentMember(
  departmentId: string,
  userId: string,
  role = "assistente"
): Promise<void> {
  try {
    await apiPost(`/api/departments/${encodeURIComponent(departmentId)}/members`, {
      user_id: userId,
      role,
      evento_id: null,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "23505") {
      throw new Error("Este usuário já faz parte do departamento.");
    }
    throw new Error(sanitizeError(error, "create"));
  }
}

export async function listDepartmentMembers(departmentId: string): Promise<DepartmentMemberRow[]> {
  try {
    const data = await apiGet<DepartmentMemberRow[]>(
      `/api/departments/${encodeURIComponent(departmentId)}/members`
    );
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throw new Error(sanitizeError(error, "fetch"));
  }
}

export async function removeDepartmentMember(membershipId: string): Promise<void> {
  try {
    await apiDelete(`/api/members/${encodeURIComponent(membershipId)}`);
  } catch (error) {
    throw new Error(sanitizeError(error, "delete"));
  }
}

/**
 * Revoga a coordenação do departamento. O Worker remove a linha de
 * `department_members` e limpa `departments.coordenador_id` legado.
 */
export async function revokeDepartmentCoordinator(
  departmentId: string,
  userId: string
): Promise<{ id: string }> {
  try {
    await apiDelete(
      `/api/departments/${encodeURIComponent(departmentId)}/coordinator?user_id=${encodeURIComponent(userId)}`
    );
    return { id: departmentId };
  } catch (error) {
    throw new Error(sanitizeError(error, "delete"));
  }
}

/**
 * Garante os departamentos padrão no evento. Se o evento já tem vínculos,
 * devolve os departamentos vinculados; caso contrário, o Worker cria os 12
 * padrão (upsert por slug) e vincula todos.
 */
export async function createStandardDepartmentsForEvento(
  eventoId?: string | null
): Promise<DepartmentRef[]> {
  if (!eventoId) return [];

  const eventPath = `/api/eventos/${encodeURIComponent(eventoId)}`;

  // 1. O evento já tem departamentos vinculados? (devolve-os sem recriar)
  try {
    const links = await apiGet<Array<{ department_id?: string | null }>>(
      `${eventPath}/department-links`
    );
    if (Array.isArray(links) && links.length > 0) {
      const existing = await apiGet<DepartmentRef[]>(`${eventPath}/departments`);
      return Array.isArray(existing) ? existing : [];
    }
  } catch {
    // Sem como verificar — tenta a garantia padrão abaixo.
  }

  // 2. Sem vínculos: cria os padrão e vincula de uma vez.
  try {
    const result = await apiPost<{ departments: DepartmentRef[] }>(
      `${eventPath}/departments/standard`
    );
    return Array.isArray(result?.departments) ? result.departments : [];
  } catch (error) {
    throw new Error(sanitizeError(error, "create"));
  }
}

/**
 * Repara em background os vínculos dos departamentos padrão que faltarem
 * no evento (preenche vínculos FALTANTES mesmo com outros links existentes).
 */
export async function linkStandardDepartmentsToEvento(
  eventoId?: string | null
): Promise<{ linked: number }> {
  if (!eventoId) return { linked: 0 };

  try {
    const result = await apiPost<{ linked: number }>(
      `/api/eventos/${encodeURIComponent(eventoId)}/departments/standard`
    );
    return { linked: result?.linked ?? 0 };
  } catch (error) {
    throw new Error(sanitizeError(error, "create"));
  }
}
