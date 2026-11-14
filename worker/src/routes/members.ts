/**
 * Rotas de perfis e membros de departamento.
 *
 * Equivale a: profiles (SELECT/UPDATE próprio), department_members
 * (claim, assistente, listagem, remoção).
 */
import { get, post, put, del } from "../router";
import { ApiError, json, mapRow, mapRows, readJson } from "../http";
import { isCoordinator, requireCoordinator, requireMember, hasCoordinatorInScope } from "../guards";

// ---------------------------------------------------------------- profiles

/** GET /api/profiles?id=in,a,b  |  ?email=x@y.z  |  ?id=abc */
get("/api/profiles", async ({ env, url, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);

  const email = url.searchParams.get("email");
  const idIn = url.searchParams.get("id_in");
  const id = url.searchParams.get("id");

  if (email) {
    const row = await env.DB.prepare(
      `SELECT id, email, name, is_super_admin FROM profiles WHERE email = ? LIMIT 1`
    )
      .bind(email.trim().toLowerCase())
      .first();
    return json({ data: mapRow(row) });
  }

  if (idIn) {
    const ids = idIn.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
    if (ids.length === 0) return json({ data: [] });
    const placeholders = ids.map(() => "?").join(",");
    const rows = await env.DB.prepare(
      `SELECT id, email, name, is_super_admin FROM profiles WHERE id IN (${placeholders})`
    )
      .bind(...ids)
      .all();
    return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
  }

  if (id) {
    const row = await env.DB.prepare(
      `SELECT id, email, name, is_super_admin FROM profiles WHERE id = ?`
    )
      .bind(id)
      .first();
    return json({ data: mapRow(row) });
  }

  throw new ApiError("Informe email, id ou id_in.", 400);
});

/** PUT /api/profiles/me — upsert do próprio perfil. */
put("/api/profiles/me", async ({ env, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const body = await readJson<{ name?: string; email?: string }>(request);
  const name = typeof body.name === "string" ? body.name : null;

  await env.DB.prepare(
    `INSERT INTO profiles (id, email, name) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = COALESCE(excluded.name, profiles.name),
       email = COALESCE(profiles.email, excluded.email)`
  )
    .bind(user.id, user.email, name)
    .run();

  const row = await env.DB.prepare(
    `SELECT id, email, name, is_super_admin FROM profiles WHERE id = ?`
  )
    .bind(user.id)
    .first();
  return json({ data: mapRow(row) });
});

// ------------------------------------------------------- department_members

/**
 * GET /api/members?user_id=&evento_id=&role=&department_id=
 * Usado pelo AuthContext (vínculos do usuário), pelo Dashboard (mapa de
 * coordenadores do evento) e por fetchCoordinatedDepartmentIds.
 */
get("/api/members", async ({ env, url, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);

  const userId = url.searchParams.get("user_id");
  const eventoId = url.searchParams.get("evento_id");
  const role = url.searchParams.get("role");
  const departmentId = url.searchParams.get("department_id");

  // Sem user_id explícito, só o próprio usuário pode listar seus vínculos.
  const targetUser = userId ?? user.id;
  if (targetUser !== user.id && !user.is_super_admin) {
    throw new ApiError("Sem permissão para listar vínculos de outro usuário.", 403);
  }

  const where: string[] = ["user_id = ?"];
  const binds: unknown[] = [targetUser];
  if (eventoId) {
    where.push("evento_id = ?");
    binds.push(eventoId);
  }
  if (role) {
    where.push("role = ?");
    binds.push(role);
  }
  if (departmentId) {
    where.push("department_id = ?");
    binds.push(departmentId);
  }

  const rows = await env.DB.prepare(
    `SELECT id, department_id, evento_id, user_id, role, created_at
       FROM department_members
      WHERE ${where.join(" AND ")}
      ORDER BY created_at ASC`
  )
    .bind(...(binds as never[]))
    .all();

  return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
});

/** GET /api/departments/:id/members — membros + profiles (listDepartmentMembers). */
get("/api/departments/:id/members", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  await requireMember(env.DB, params.id, user.id);

  const rows = await env.DB.prepare(
    `SELECT dm.id, dm.department_id, dm.evento_id, dm.user_id, dm.role, dm.created_at,
            p.id AS p_id, p.email AS p_email, p.name AS p_name
       FROM department_members dm
       LEFT JOIN profiles p ON p.id = dm.user_id
      WHERE dm.department_id = ?
      ORDER BY dm.role DESC, dm.created_at ASC`
  )
    .bind(params.id)
    .all();

  const data = (rows.results as Record<string, unknown>[]).map((row) => ({
    id: row.id,
    department_id: row.department_id,
    evento_id: row.evento_id,
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
    profiles: row.p_id ? { id: row.p_id, email: row.p_email, name: row.p_name } : null,
  }));

  return json({ data });
});

/**
 * POST /api/departments/:id/members — adiciona assistente (ou claim legado).
 * Regra RLS: insert de assistente exige ser coordenador do departamento.
 */
post("/api/departments/:id/members", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const body = await readJson<{ user_id?: string; role?: string; evento_id?: string | null }>(request);

  const role = body.role ?? "assistente";
  const targetUserId = body.user_id;
  if (!targetUserId) throw new ApiError("user_id é obrigatório.", 400);

  if (role === "coordenador") {
    // Claim: só a si mesmo e só se não houver coordenador no escopo.
    if (targetUserId !== user.id) throw new ApiError("Só é possível assumir para si mesmo.", 403);
    if (await hasCoordinatorInScope(env.DB, params.id, body.evento_id ?? null)) {
      throw new ApiError("Departamento já possui coordenador neste evento.", 409, "23505");
    }
  } else {
    await requireCoordinator(env.DB, params.id, user.id, body.evento_id ?? null);
  }

  // Evita duplicata (unique legado department_id+user_id quando evento_id NULL).
  const existing = await env.DB.prepare(
    `SELECT id FROM department_members
      WHERE department_id = ? AND user_id = ?
        AND ${body.evento_id ? "evento_id = ?" : "evento_id IS NULL"}
      LIMIT 1`
  )
    .bind(...((body.evento_id ? [params.id, targetUserId, body.evento_id] : [params.id, targetUserId]) as never[]))
    .first<{ id: string }>();

  if (existing) throw new ApiError("Este usuário já faz parte do departamento.", 409, "23505");

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO department_members (id, department_id, user_id, role, evento_id) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id, params.id, targetUserId, role, body.evento_id ?? null)
    .run();

  return json({ data: { id, department_id: params.id, user_id: targetUserId, role } }, 201);
});

/** DELETE /api/members/:id — remove vínculo (coordenador remove assistente; qualquer um remove o próprio). */
del("/api/members/:id", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);

  const row = await env.DB.prepare(
    `SELECT id, department_id, user_id, role FROM department_members WHERE id = ?`
  )
    .bind(params.id)
    .first<{ id: string; department_id: string; user_id: string; role: string }>();

  if (!row) throw new ApiError("Vínculo não encontrado.", 404);

  const isOwn = row.user_id === user.id;
  const isCoordinatorOfDept = await isCoordinator(env.DB, row.department_id, user.id);

  // Regra RLS: coordenador remove linhas que NÃO são de coordenador;
  // qualquer usuário remove a própria linha.
  if (!isOwn && !(isCoordinatorOfDept && row.role !== "coordenador")) {
    throw new ApiError("Sem permissão para remover este vínculo.", 403);
  }

  await env.DB.prepare(`DELETE FROM department_members WHERE id = ?`).bind(params.id).run();
  return json({ data: { id: params.id } });
});

/**
 * DELETE /api/departments/:id/coordinator?user_id=&evento_id=
 * Revoga a coordenação (revokeDepartmentCoordinator).
 */
del("/api/departments/:id/coordinator", async ({ env, params, url, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const targetUserId = url.searchParams.get("user_id") ?? user.id;

  // Só é possível revogar a própria coordenação (ou super admin).
  if (targetUserId !== user.id && !user.is_super_admin) {
    throw new ApiError("Só é possível revogar a própria coordenação.", 403);
  }

  const removed = await env.DB.prepare(
    `DELETE FROM department_members
      WHERE department_id = ? AND user_id = ? AND role = 'coordenador'
      RETURNING id`
  )
    .bind(params.id, targetUserId)
    .all();

  if ((removed.results ?? []).length === 0) {
    throw new ApiError(
      "Não foi possível revogar a coordenação. Verifique se você ainda é o coordenador.",
      403
    );
  }

  // Limpa a coluna legada se apontar para o mesmo usuário.
  await env.DB.prepare(
    `UPDATE departments SET coordenador_id = NULL WHERE id = ? AND coordenador_id = ?`
  )
    .bind(params.id, targetUserId)
    .run();

  return json({ data: { id: params.id } });
});
