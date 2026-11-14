/**
 * Camada de autorização — substitui o RLS do Supabase.
 *
 * Cada função replica a política equivalente do Postgres. As regras vigentes
 * (derivadas de rls_policies.sql + fixes) são:
 *
 *   profiles        SELECT: qualquer autenticado | INSERT/UPDATE: própria linha
 *   departments     SELECT: público | INSERT: autenticado | UPDATE: coordenador
 *                   ou coordenador_id IS NULL
 *   dept_members    SELECT: própria linha, coordenador do dept, ou qualquer
 *                   linha role='coordenador' (visibilidade da grade)
 *                   INSERT claim: eu mesmo + coordenador + sem coordenador no escopo
 *                   INSERT assistente: só coordenador
 *                   DELETE: coordenador (não-coordenador) ou própria linha
 *   volunteers      SELECT público: apenas active=true | membro: tudo
 *                   INSERT público: apenas active=false
 *                   UPDATE/DELETE: membro
 *   schedule_*      SELECT: público | ALL: membro do departamento
 *   eventos         SELECT/INSERT: autenticado | UPDATE: criador
 *                   DELETE: criador ou coordenador do evento
 *   event_depts     SELECT/INSERT: autenticado | DELETE: coordenador do dept
 *
 * Nota de desvio consciente: no Supabase havia uma política permissiva
 * `FOR ALL USING(true)` criada em 02_fix_department_members_rls.sql que
 * anulava as regras acima. Aqui NÃO reproduzimos esse furo — usamos as
 * regras granulares originais.
 */
import { ApiError } from "./http";
import type { AuthUser } from "./env";

export interface GuardsDeps {
  DB: D1Database;
  user: AuthUser;
}

/** Exige sessão autenticada — lança 401. */
export function requireUser(user: AuthUser | null): AuthUser {
  if (!user) throw new ApiError("Não autenticado.", 401);
  return user;
}

/**
 * É membro do departamento? (qualquer papel, qualquer evento)
 * Equivale a `is_department_member()` + coluna legada `departments.coordenador_id`.
 */
export async function isMember(db: D1Database, departmentId: string, userId: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM department_members
        WHERE department_id = ? AND user_id = ?
        LIMIT 1`
    )
    .bind(departmentId, userId)
    .first<{ ok: number }>();
  if (row) return true;

  const legacy = await db
    .prepare(`SELECT 1 AS ok FROM departments WHERE id = ? AND coordenador_id = ? LIMIT 1`)
    .bind(departmentId, userId)
    .first<{ ok: number }>();
  return Boolean(legacy);
}

/**
 * É coordenador do departamento?
 *
 * @param eventoId escopo do evento. Quando informado, aceita vínculo daquele
 *   evento OU vínculo legado (evento_id NULL) OU a coluna legada
 *   `departments.coordenador_id`. Sem eventoId, aceita qualquer vínculo.
 */
export async function isCoordinator(
  db: D1Database,
  departmentId: string,
  userId: string,
  eventoId?: string | null
): Promise<boolean> {
  if (eventoId) {
    const scoped = await db
      .prepare(
        `SELECT 1 AS ok FROM department_members
          WHERE department_id = ? AND user_id = ? AND role = 'coordenador'
            AND (evento_id = ? OR evento_id IS NULL)
          LIMIT 1`
      )
      .bind(departmentId, userId, eventoId)
      .first<{ ok: number }>();
    if (scoped) return true;
  } else {
    const any = await db
      .prepare(
        `SELECT 1 AS ok FROM department_members
          WHERE department_id = ? AND user_id = ? AND role = 'coordenador'
          LIMIT 1`
      )
      .bind(departmentId, userId)
      .first<{ ok: number }>();
    if (any) return true;
  }

  const legacy = await db
    .prepare(`SELECT 1 AS ok FROM departments WHERE id = ? AND coordenador_id = ? LIMIT 1`)
    .bind(departmentId, userId)
    .first<{ ok: number }>();
  return Boolean(legacy);
}

/** Lança 403 se não for membro do departamento. */
export async function requireMember(db: D1Database, departmentId: string, userId: string): Promise<void> {
  if (!departmentId) throw new ApiError("departmentId é obrigatório.", 400);
  if (!(await isMember(db, departmentId, userId))) {
    throw new ApiError("Você não faz parte deste departamento.", 403);
  }
}

/** Lança 403 se não for coordenador do departamento (no escopo informado). */
export async function requireCoordinator(
  db: D1Database,
  departmentId: string,
  userId: string,
  eventoId?: string | null
): Promise<void> {
  if (!departmentId) throw new ApiError("departmentId é obrigatório.", 400);
  if (!(await isCoordinator(db, departmentId, userId, eventoId))) {
    throw new ApiError("Apenas o coordenador pode realizar esta ação.", 403);
  }
}

/** Já existe coordenador neste escopo (evento ou legado)? */
export async function hasCoordinatorInScope(
  db: D1Database,
  departmentId: string,
  eventoId?: string | null
): Promise<boolean> {
  const row =
    eventoId != null
      ? await db
          .prepare(
            `SELECT 1 AS ok FROM department_members
              WHERE department_id = ? AND role = 'coordenador'
                AND (evento_id = ? OR evento_id IS NULL)
              LIMIT 1`
          )
          .bind(departmentId, eventoId)
          .first<{ ok: number }>()
      : await db
          .prepare(
            `SELECT 1 AS ok FROM department_members
              WHERE department_id = ? AND role = 'coordenador' AND evento_id IS NULL
              LIMIT 1`
          )
          .bind(departmentId)
          .first<{ ok: number }>();
  return Boolean(row);
}

/** Criador do evento? */
export async function isEventCreator(db: D1Database, eventoId: string, userId: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS ok FROM eventos WHERE id = ? AND criado_por = ? LIMIT 1`)
    .bind(eventoId, userId)
    .first<{ ok: number }>();
  return Boolean(row);
}

/**
 * Pode excluir o evento? (regra do `eventos_delete_creator`)
 * criador OU coordenador de departamento vinculado ao evento (3 caminhos).
 */
export async function canDeleteEvent(db: D1Database, eventoId: string, userId: string): Promise<boolean> {
  if (await isEventCreator(db, eventoId, userId)) return true;

  const row = await db
    .prepare(
      `SELECT 1 AS ok
         FROM department_members dm
        WHERE dm.user_id = ?
          AND dm.role = 'coordenador'
          AND (
            -- coordenador nomeado para o evento
            dm.evento_id = ?
            -- coordenador legado de departamento vinculado ao evento
            OR (dm.evento_id IS NULL AND EXISTS (
                  SELECT 1 FROM evento_departamentos ed
                   WHERE ed.evento_id = ? AND ed.department_id = dm.department_id))
            -- coluna legada departments.coordenador_id
            OR EXISTS (
                  SELECT 1 FROM evento_departamentos ed
                    JOIN departments d ON d.id = ed.department_id
                   WHERE ed.evento_id = ? AND d.coordenador_id = ?)
          )
        LIMIT 1`
    )
    .bind(userId, eventoId, eventoId, eventoId, userId)
    .first<{ ok: number }>();
  return Boolean(row);
}

/** Pode alterar departamentos? (coordenador, ou departamento sem coordenador) */
export async function canUpdateDepartment(
  db: D1Database,
  departmentId: string,
  userId: string
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM departments
        WHERE id = ? AND (coordenador_id IS NULL OR coordenador_id = ?)
        LIMIT 1`
    )
    .bind(departmentId, userId)
    .first<{ ok: number }>();
  return Boolean(row);
}
