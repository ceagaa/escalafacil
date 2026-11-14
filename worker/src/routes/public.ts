/**
 * Rotas PÚBLICAS (sem autenticação) — substituem as leituras/escritas
 * anônimas permitidas pelo RLS.
 *
 *   GET  /api/public/departments/:slug      — departamento por slug
 *   GET  /api/public/eventos/:slug          — evento por slug
 *   GET  /api/public/departments/:id/schedule — escala completa (leitura)
 *   POST /api/public/volunteers             — cadastro de voluntário (active=false)
 */
import { get, post } from "../router";
import { ApiError, json, mapRow, mapRows, readJson } from "../http";

/** GET /api/public/departments/:slug */
get("/api/public/departments/:slug", async ({ env, params }) => {
  const row = await env.DB.prepare(
    `SELECT id, name, slug FROM departments WHERE slug = ? LIMIT 1`
  )
    .bind(params.slug)
    .first();
  if (!row) throw new ApiError("Departamento não encontrado.", 404);
  return json({ data: mapRow(row) });
});

/** GET /api/public/eventos?slug=abc | ?id= — evento por slug ou id (cadastro público). */
get("/api/public/eventos", async ({ env, url }) => {
  const slug = url.searchParams.get("slug");
  const id = url.searchParams.get("id");
  if (!slug && !id) throw new ApiError("Informe id ou slug.", 400);

  const row = id
    ? await env.DB.prepare(
        `SELECT id, slug, tipo, estado, cidade, circuito, ano, data_evento
           FROM eventos WHERE id = ? LIMIT 1`
      )
        .bind(id)
        .first()
    : await env.DB.prepare(
        `SELECT id, slug, tipo, estado, cidade, circuito, ano, data_evento
           FROM eventos WHERE slug = ? LIMIT 1`
      )
        .bind(slug)
        .first();
  if (!row) throw new ApiError("Evento não encontrado.", 404);
  return json({ data: mapRow(row) });
});

/** GET /api/public/eventos/:slug — usado pelo cadastro público. */
get("/api/public/eventos/:slug", async ({ env, params }) => {
  const row = await env.DB.prepare(
    `SELECT id, slug, tipo, estado, cidade, circuito, ano, data_evento
       FROM eventos WHERE slug = ? LIMIT 1`
  )
    .bind(params.slug)
    .first();
  if (!row) throw new ApiError("Evento não encontrado.", 404);
  return json({ data: mapRow(row) });
});

/**
 * GET /api/public/departments/:id/schedule — escala pública somente leitura.
 * Espelha as 4 consultas do PublicEscala num único endpoint.
 */
get("/api/public/departments/:id/schedule", async ({ env, params }) => {
  const [blocks, shifts, assigned, volunteers] = await Promise.all([
    env.DB.prepare(
      `SELECT * FROM schedule_blocks WHERE department_id = ?`
    )
      .bind(params.id)
      .all(),
    env.DB.prepare(`SELECT * FROM shifts WHERE department_id = ?`).bind(params.id).all(),
    env.DB.prepare(
      `SELECT shift_id, volunteer_id, manual_name FROM shift_volunteers WHERE department_id = ?`
    )
      .bind(params.id)
      .all(),
    env.DB.prepare(
      `SELECT id, name, active FROM volunteers WHERE department_id = ?`
    )
      .bind(params.id)
      .all(),
  ]);

  return json({
    data: {
      blocks: mapRows(blocks.results as Record<string, unknown>[]),
      shifts: mapRows(shifts.results as Record<string, unknown>[]),
      assignments: mapRows(assigned.results as Record<string, unknown>[]),
      volunteers: mapRows(volunteers.results as Record<string, unknown>[]),
    },
  });
});

/**
 * GET /api/public/departments/:id/links — evento vinculado mais recente
 * (cadastro público; front pedia ORDER BY created_at DESC LIMIT 1).
 */
get("/api/public/departments/:id/links", async ({ env, params }) => {
  const row = await env.DB.prepare(
    `SELECT evento_id FROM evento_departamentos
      WHERE department_id = ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(params.id)
    .first<{ evento_id: string }>();
  return json({ data: row?.evento_id ?? null });
});

/**
 * POST /api/public/volunteers — cadastro anônimo.
 * Regra RLS: INSERT público apenas com active=false (aprovação manual).
 */
post("/api/public/volunteers", async ({ env, request }) => {
  const b = await readJson<{
    department_id?: string;
    name?: string;
    congregation?: string;
    phone?: string;
    availability?: unknown;
  }>(request);

  const departmentId = String(b.department_id ?? "").trim();
  const name = String(b.name ?? "").trim();
  if (!departmentId || !name) {
    throw new ApiError("department_id e name são obrigatórios.", 400);
  }
  if (name.length > 120) throw new ApiError("Nome muito longo.", 400);

  // Confere que o departamento existe (evita FK quebrada e spam).
  const dept = await env.DB.prepare(`SELECT id FROM departments WHERE id = ?`)
    .bind(departmentId)
    .first<{ id: string }>();
  if (!dept) throw new ApiError("Departamento não encontrado.", 404);

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO volunteers (id, department_id, name, congregation, phone, availability, active)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  )
    .bind(
      id,
      departmentId,
      name.slice(0, 120),
      String(b.congregation ?? "").slice(0, 120) || null,
      String(b.phone ?? "").slice(0, 40) || null,
      b.availability != null ? JSON.stringify(b.availability) : null
    )
    .run();

  return json({ data: { id } }, 201);
});
