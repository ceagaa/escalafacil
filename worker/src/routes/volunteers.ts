/**
 * Rotas de voluntários.
 *
 * Regras portadas do RLS:
 *   SELECT público: apenas active=true | membro: todos
 *   INSERT público: apenas active=false (cadastro via link)
 *   UPDATE/DELETE: apenas membro do departamento
 */
import { get, post, patch, del } from "../router";
import { ApiError, json, mapRow, mapRows, readJson } from "../http";
import { requireMember } from "../guards";

/** GET /api/departments/:id/volunteers — lista (membro vê todos). */
get("/api/departments/:id/volunteers", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  await requireMember(env.DB, params.id, user.id);

  const rows = await env.DB.prepare(
    `SELECT * FROM volunteers WHERE department_id = ? ORDER BY created_at DESC`
  )
    .bind(params.id)
    .all();
  return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
});

/** GET /api/departments/:id/volunteers/stats — contagens do dashboard. */
get("/api/departments/:id/volunteers/stats", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  await requireMember(env.DB, params.id, user.id);

  const volunteers = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM volunteers WHERE department_id = ? AND active = 1`
  )
    .bind(params.id)
    .first<{ c: number }>();

  const shifts = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM shifts WHERE department_id = ?`
  )
    .bind(params.id)
    .first<{ c: number }>();

  return json({ data: { volunteers: volunteers?.c ?? 0, shifts: shifts?.c ?? 0 } });
});

/** POST /api/departments/:id/volunteers — cria (membro; ativo por padrão). */
post("/api/departments/:id/volunteers", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  await requireMember(env.DB, params.id, user.id);

  const b = await readJson<Record<string, unknown>>(request);
  const name = String(b.name ?? "").trim();
  if (!name) throw new ApiError("name é obrigatório.", 400);

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO volunteers (id, department_id, name, congregation, phone, availability, active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      params.id,
      name,
      (b.congregation as string) ?? null,
      (b.phone as string) ?? null,
      b.availability != null ? JSON.stringify(b.availability) : null,
      b.active === false ? 0 : 1
    )
    .run();

  const row = await env.DB.prepare(`SELECT * FROM volunteers WHERE id = ?`).bind(id).first();
  return json({ data: mapRow(row) }, 201);
});

/** PATCH /api/volunteers/:id — atualiza (membro do departamento dono). */
patch("/api/volunteers/:id", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);

  const existing = await env.DB.prepare(
    `SELECT id, department_id FROM volunteers WHERE id = ?`
  )
    .bind(params.id)
    .first<{ id: string; department_id: string }>();
  if (!existing) throw new ApiError("Voluntário não encontrado.", 404);
  await requireMember(env.DB, existing.department_id, user.id);

  const b = await readJson<Record<string, unknown>>(request);
  const sets: string[] = [];
  const binds: unknown[] = [];

  if (typeof b.name === "string") {
    sets.push("name = ?");
    binds.push(b.name);
  }
  if ("congregation" in b) {
    sets.push("congregation = ?");
    binds.push((b.congregation as string) ?? null);
  }
  if ("phone" in b) {
    sets.push("phone = ?");
    binds.push((b.phone as string) ?? null);
  }
  if ("availability" in b) {
    sets.push("availability = ?");
    binds.push(b.availability != null ? JSON.stringify(b.availability) : null);
  }
  if ("active" in b) {
    sets.push("active = ?");
    binds.push(b.active ? 1 : 0);
  }
  if (sets.length === 0) throw new ApiError("Nada para atualizar.", 400);

  binds.push(params.id);
  await env.DB.prepare(`UPDATE volunteers SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...(binds as never[]))
    .run();

  const row = await env.DB.prepare(`SELECT * FROM volunteers WHERE id = ?`).bind(params.id).first();
  return json({ data: mapRow(row) });
});

/** DELETE /api/volunteers/:id — membro do departamento dono. */
del("/api/volunteers/:id", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);

  const existing = await env.DB.prepare(
    `SELECT id, department_id FROM volunteers WHERE id = ?`
  )
    .bind(params.id)
    .first<{ id: string; department_id: string }>();
  if (!existing) throw new ApiError("Voluntário não encontrado.", 404);
  await requireMember(env.DB, existing.department_id, user.id);

  await env.DB.prepare(`DELETE FROM volunteers WHERE id = ?`).bind(params.id).run();
  return json({ data: { id: params.id } });
});
