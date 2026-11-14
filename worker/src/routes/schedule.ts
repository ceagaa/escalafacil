/**
 * Rotas da escala (schedule_blocks / shifts / shift_volunteers).
 *
 * Regras portadas do RLS:
 *   SELECT: público | ALL (insert/update/delete): membro do departamento
 *
 * As rotas autenticadas exigem sessão + membership; a leitura pública fica
 * em /api/public/*.
 */
import { get, post, patch, del, put } from "../router";
import { ApiError, json, mapRow, mapRows, readJson } from "../http";
import { requireMember } from "../guards";

// ------------------------------------------------------------ blocks

/** GET /api/departments/:id/blocks */
get("/api/departments/:id/blocks", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  await requireMember(env.DB, params.id, user.id);
  const rows = await env.DB.prepare(
    `SELECT * FROM schedule_blocks WHERE department_id = ? ORDER BY created_at DESC`
  )
    .bind(params.id)
    .all();
  return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
});

/** POST /api/departments/:id/blocks */
post("/api/departments/:id/blocks", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  await requireMember(env.DB, params.id, user.id);

  const b = await readJson<{ id?: string; day?: string; period?: string; responsible?: string; accent?: string }>(request);
  if (!b.id || !b.day || !b.period) throw new ApiError("id, day e period são obrigatórios.", 400);

  try {
    await env.DB.prepare(
      `INSERT INTO schedule_blocks (id, department_id, day, period, responsible, accent)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(b.id, params.id, b.day, b.period, b.responsible ?? null, b.accent ?? null)
      .run();
  } catch (err) {
    // ID determinístico já existe (ex.: seed idempotente reexecutado).
    if (String(err).includes("UNIQUE")) throw new ApiError("Bloco já existe.", 409, "23505");
    throw err;
  }

  const row = await env.DB.prepare(`SELECT * FROM schedule_blocks WHERE id = ?`).bind(b.id).first();
  return json({ data: mapRow(row) }, 201);
});

/** PATCH /api/blocks/:id */
patch("/api/blocks/:id", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const existing = await env.DB.prepare(
    `SELECT id, department_id FROM schedule_blocks WHERE id = ?`
  )
    .bind(params.id)
    .first<{ id: string; department_id: string }>();
  if (!existing) throw new ApiError("Bloco não encontrado.", 404);
  await requireMember(env.DB, existing.department_id, user.id);

  const b = await readJson<Record<string, unknown>>(request);
  const sets: string[] = [];
  const binds: unknown[] = [];
  for (const col of ["day", "period", "responsible", "accent"] as const) {
    if (col in b) {
      sets.push(`${col} = ?`);
      binds.push((b[col] as string) ?? null);
    }
  }
  if (sets.length === 0) throw new ApiError("Nada para atualizar.", 400);
  binds.push(params.id);
  await env.DB.prepare(`UPDATE schedule_blocks SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...(binds as never[]))
    .run();

  const row = await env.DB.prepare(`SELECT * FROM schedule_blocks WHERE id = ?`).bind(params.id).first();
  return json({ data: mapRow(row) });
});

/** DELETE /api/blocks/:id */
del("/api/blocks/:id", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const existing = await env.DB.prepare(
    `SELECT id, department_id FROM schedule_blocks WHERE id = ?`
  )
    .bind(params.id)
    .first<{ id: string; department_id: string }>();
  if (!existing) throw new ApiError("Bloco não encontrado.", 404);
  await requireMember(env.DB, existing.department_id, user.id);

  await env.DB.prepare(`DELETE FROM schedule_blocks WHERE id = ?`).bind(params.id).run();
  return json({ data: { id: params.id } });
});

// ------------------------------------------------------------ shifts

/** GET /api/departments/:id/shifts?block_id= */
get("/api/departments/:id/shifts", async ({ env, params, url, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  await requireMember(env.DB, params.id, user.id);

  const blockId = url.searchParams.get("block_id");
  const rows = blockId
    ? await env.DB.prepare(
        `SELECT * FROM shifts WHERE department_id = ? AND block_id = ?`
      )
        .bind(params.id, blockId)
        .all()
    : await env.DB.prepare(`SELECT * FROM shifts WHERE department_id = ?`).bind(params.id).all();

  return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
});

/** POST /api/departments/:id/shifts — cria turno. */
post("/api/departments/:id/shifts", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  await requireMember(env.DB, params.id, user.id);

  const b = await readJson<{
    id?: string;
    block_id?: string;
    start_time?: string;
    end_time?: string;
    description?: string;
    vagas?: number;
    responsible?: string;
  }>(request);

  if (!b.id || !b.block_id || !b.start_time || !b.end_time) {
    throw new ApiError("id, block_id, start_time e end_time são obrigatórios.", 400);
  }

  await env.DB.prepare(
    `INSERT INTO shifts (id, block_id, department_id, start_time, end_time, description, vagas, responsible)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      b.id,
      b.block_id,
      params.id,
      b.start_time,
      b.end_time,
      b.description ?? "",
      Number(b.vagas ?? 0),
      b.responsible ?? ""
    )
    .run();

  const row = await env.DB.prepare(`SELECT * FROM shifts WHERE id = ?`).bind(b.id).first();
  return json({ data: mapRow(row) }, 201);
});

/** PATCH /api/shifts/:id */
patch("/api/shifts/:id", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const existing = await env.DB.prepare(
    `SELECT id, department_id FROM shifts WHERE id = ?`
  )
    .bind(params.id)
    .first<{ id: string; department_id: string }>();
  if (!existing) throw new ApiError("Turno não encontrado.", 404);
  await requireMember(env.DB, existing.department_id, user.id);

  const b = await readJson<Record<string, unknown>>(request);
  const sets: string[] = [];
  const binds: unknown[] = [];
  if ("start_time" in b) {
    sets.push("start_time = ?");
    binds.push(b.start_time as string);
  }
  if ("end_time" in b) {
    sets.push("end_time = ?");
    binds.push(b.end_time as string);
  }
  if ("description" in b) {
    sets.push("description = ?");
    binds.push((b.description as string) ?? "");
  }
  if ("vagas" in b) {
    sets.push("vagas = ?");
    binds.push(Number(b.vagas ?? 0));
  }
  if ("responsible" in b) {
    sets.push("responsible = ?");
    binds.push((b.responsible as string) ?? "");
  }
  if ("active" in b) {
    sets.push("active = ?");
    binds.push(b.active ? 1 : 0);
  }
  if (sets.length === 0) throw new ApiError("Nada para atualizar.", 400);
  binds.push(params.id);
  await env.DB.prepare(`UPDATE shifts SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...(binds as never[]))
    .run();

  const row = await env.DB.prepare(`SELECT * FROM shifts WHERE id = ?`).bind(params.id).first();
  return json({ data: mapRow(row) });
});

/** DELETE /api/shifts/:id */
del("/api/shifts/:id", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const existing = await env.DB.prepare(
    `SELECT id, department_id FROM shifts WHERE id = ?`
  )
    .bind(params.id)
    .first<{ id: string; department_id: string }>();
  if (!existing) throw new ApiError("Turno não encontrado.", 404);
  await requireMember(env.DB, existing.department_id, user.id);

  await env.DB.prepare(`DELETE FROM shifts WHERE id = ?`).bind(params.id).run();
  return json({ data: { id: params.id } });
});

// ------------------------------------------------------- assignments

/** GET /api/departments/:id/assignments — vínculos do departamento. */
get("/api/departments/:id/assignments", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  await requireMember(env.DB, params.id, user.id);

  const rows = await env.DB.prepare(
    `SELECT sv.shift_id, sv.volunteer_id, sv.manual_name
       FROM shift_volunteers sv
       JOIN shifts s ON s.id = sv.shift_id
      WHERE sv.department_id = ?`
  )
    .bind(params.id)
    .all();
  return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
});

/**
 * PUT /api/shifts/:id/assignments — substitui as alocações do turno
 * (delete + insert, como faziam assignVolunteersToShift/saveShiftAssignments).
 */
put("/api/shifts/:id/assignments", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);

  const shift = await env.DB.prepare(
    `SELECT id, department_id FROM shifts WHERE id = ?`
  )
    .bind(params.id)
    .first<{ id: string; department_id: string }>();
  if (!shift) throw new ApiError("Turno não encontrado.", 404);
  await requireMember(env.DB, shift.department_id, user.id);

  const b = await readJson<{
    volunteer_ids?: string[];
    assignments?: Array<{ volunteer_id?: string | null; manual_name?: string | null }>;
  }>(request);

  // Normaliza para a forma canônica `assignments`.
  const assignments: Array<{ volunteer_id: string | null; manual_name: string | null }> = (
    b.assignments ??
    (b.volunteer_ids ?? []).map((id) => ({ volunteer_id: id, manual_name: null }))
  ).map((a) => ({ volunteer_id: a.volunteer_id ?? null, manual_name: a.manual_name ?? null }));

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM shift_volunteers WHERE shift_id = ?`).bind(params.id),
    ...(assignments.length > 0
      ? [
          env.DB.prepare(
            `INSERT INTO shift_volunteers (id, shift_id, volunteer_id, department_id, manual_name)
             VALUES ${assignments.map(() => "(?, ?, ?, ?, ?)").join(",")}`
          ).bind(
            ...(assignments.flatMap((a) => [
              crypto.randomUUID(),
              params.id,
              a.volunteer_id || null,
              shift.department_id,
              a.manual_name || null,
            ]) as never[])
          ),
        ]
      : []),
  ]);

  return json({ data: { count: assignments.length } });
});
