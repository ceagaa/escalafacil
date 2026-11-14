/**
 * Rotas de eventos (eventos sazonais) e vínculos evento<->departamento.
 *
 * Regras portadas do RLS:
 *   eventos SELECT/INSERT: autenticado | UPDATE: criador
 *   eventos DELETE: criador OU coordenador de departamento vinculado
 *   evento_departamentos SELECT/INSERT: autenticado | DELETE: coordenador
 */
import { get, post, patch, del } from "../router";
import { ApiError, json, mapRow, mapRows, readJson } from "../http";
import { canDeleteEvent, isEventCreator, requireCoordinator, requireMember } from "../guards";

/** Departamentos padrão (espelha STANDARD_DEPARTMENTS do front). */
const STANDARD_DEPARTMENTS = [
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

/** GET /api/eventos — lista ordenada (ano desc, created_at desc). */
get("/api/eventos", async ({ env, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const rows = await env.DB.prepare(
    `SELECT * FROM eventos ORDER BY ano DESC, created_at DESC`
  ).all();
  return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
});

/** GET /api/eventos/:id — evento único (restore do EventContext). */
get("/api/eventos/:id", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const row = await env.DB.prepare(`SELECT * FROM eventos WHERE id = ?`).bind(params.id).first();
  if (!row) throw new ApiError("Evento não encontrado.", 404);
  return json({ data: mapRow(row) });
});

/**
 * POST /api/eventos — upsert por slug (substitui o upsert_evento do Postgres).
 * O slug é gerado pelo front (eventService.generateEventSlug); aqui só
 * garantimos unicidade e `criado_por` no insert.
 */
post("/api/eventos", async ({ env, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const b = await readJson<{
    slug?: string;
    tipo?: string;
    estado?: string;
    cidade?: string;
    circuito?: string;
    ano?: number;
    data_evento?: string | null;
  }>(request);

  if (!b.slug || !b.tipo) throw new ApiError("slug e tipo são obrigatórios.", 400);

  const existing = await env.DB.prepare(`SELECT id, criado_por FROM eventos WHERE slug = ?`)
    .bind(b.slug)
    .first<{ id: string; criado_por: string | null }>();

  if (existing) {
    await env.DB.prepare(
      `UPDATE eventos SET tipo = ?, estado = ?, cidade = ?, circuito = ?, ano = ?, data_evento = ?
        WHERE id = ?`
    )
      .bind(
        b.tipo,
        b.estado ?? "",
        b.cidade ?? "",
        b.circuito ?? "",
        Number(b.ano ?? new Date().getFullYear()),
        b.data_evento || null,
        existing.id
      )
      .run();
    const row = await env.DB.prepare(`SELECT * FROM eventos WHERE id = ?`).bind(existing.id).first();
    return json({ data: mapRow(row) });
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO eventos (id, tipo, estado, cidade, circuito, ano, slug, data_evento, criado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      b.tipo,
      b.estado ?? "",
      b.cidade ?? "",
      b.circuito ?? "",
      Number(b.ano ?? new Date().getFullYear()),
      b.slug,
      b.data_evento || null,
      user.id
    )
    .run();

  const row = await env.DB.prepare(`SELECT * FROM eventos WHERE id = ?`).bind(id).first();
  return json({ data: mapRow(row) }, 201);
});

/** PATCH /api/eventos/:id — apenas o criador. */
patch("/api/eventos/:id", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  if (!(await isEventCreator(env.DB, params.id, user.id))) {
    throw new ApiError("Apenas o criador pode editar este evento.", 403);
  }
  const b = await readJson<{
    tipo?: string;
    estado?: string;
    cidade?: string;
    circuito?: string;
    ano?: number;
    data_evento?: string | null;
  }>(request);

  await env.DB.prepare(
    `UPDATE eventos SET tipo = ?, estado = ?, cidade = ?, circuito = ?, ano = ?, data_evento = ?
      WHERE id = ?`
  )
    .bind(
      b.tipo ?? "",
      b.estado ?? "",
      b.cidade ?? "",
      b.circuito ?? "",
      Number(b.ano ?? new Date().getFullYear()),
      b.data_evento || null,
      params.id
    )
    .run();

  const row = await env.DB.prepare(`SELECT * FROM eventos WHERE id = ?`).bind(params.id).first();
  return json({ data: mapRow(row) });
});

/** DELETE /api/eventos/:id — criador ou coordenador do evento. */
del("/api/eventos/:id", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  if (!(await canDeleteEvent(env.DB, params.id, user.id))) {
    throw new ApiError(
      "Não foi possível excluir: você não é criador nem coordenador deste evento, ou ele já foi removido.",
      403
    );
  }
  const res = await env.DB.prepare(`DELETE FROM eventos WHERE id = ? RETURNING id`).bind(params.id).all();
  if ((res.results ?? []).length === 0) throw new ApiError("Evento não encontrado.", 404);
  return json({ data: { id: params.id } });
});

// ---------------------------------------------------- evento_departamentos

/** GET /api/eventos/:id/departments — departamentos vinculados + coordenadores. */
get("/api/eventos/:id/departments", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);

  const rows = await env.DB.prepare(
    `SELECT d.id, d.name, d.slug, d.coordenador_id, d.active, d.features
       FROM evento_departamentos ed
       JOIN departments d ON d.id = ed.department_id
      WHERE ed.evento_id = ?
      ORDER BY d.name ASC`
  )
    .bind(params.id)
    .all();

  // Mapa de coordenadores do evento (fonte de verdade: department_members).
  const owners = await env.DB.prepare(
    `SELECT dm.department_id, dm.user_id, p.name AS owner_name
       FROM department_members dm
       LEFT JOIN profiles p ON p.id = dm.user_id
      WHERE dm.evento_id = ? AND dm.role = 'coordenador'`
  )
    .bind(params.id)
    .all();

  const ownerByDept = new Map<string, { user_id: string; name: string | null }>();
  for (const row of owners.results as Record<string, unknown>[]) {
    ownerByDept.set(String(row.department_id), {
      user_id: String(row.user_id),
      name: (row.owner_name as string | null) ?? null,
    });
  }

  const data = (rows.results as Record<string, unknown>[]).map((row) => {
    const owner = ownerByDept.get(String(row.id));
    const fallbackId = (row.coordenador_id as string | null) ?? null;
    return {
      ...mapRow(row),
      coordenador_id: owner?.user_id ?? fallbackId,
      ownerId: owner?.user_id ?? fallbackId,
      ownerName: owner?.name ?? null,
    };
  });

  return json({ data });
});

/** GET /api/eventos/:id/owners — só o mapa de coordenadores. */
get("/api/eventos/:id/owners", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const rows = await env.DB.prepare(
    `SELECT dm.department_id, dm.user_id, p.name AS owner_name
       FROM department_members dm
       LEFT JOIN profiles p ON p.id = dm.user_id
      WHERE dm.evento_id = ? AND dm.role = 'coordenador'`
  )
    .bind(params.id)
    .all();

  const data = (rows.results as Record<string, unknown>[]).map((row) => ({
    department_id: row.department_id,
    user_id: row.user_id,
    name: row.owner_name ?? null,
  }));
  return json({ data });
});

/** GET /api/eventos/:id/department-links — só os IDs vinculados. */
get("/api/eventos/:id/department-links", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const rows = await env.DB.prepare(
    `SELECT department_id FROM evento_departamentos WHERE evento_id = ?`
  )
    .bind(params.id)
    .all();
  return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
});

/**
 * POST /api/eventos/:id/departments — vincula departamento ao evento.
 * Idempotente: duplicata (23505) é silenciosamente aceita, como no front.
 */
post("/api/eventos/:id/departments", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const b = await readJson<{ department_id?: string }>(request);
  if (!b.department_id) throw new ApiError("department_id é obrigatório.", 400);

  const existing = await env.DB.prepare(
    `SELECT id FROM evento_departamentos WHERE evento_id = ? AND department_id = ?`
  )
    .bind(params.id, b.department_id)
    .first<{ id: string }>();
  if (existing) return json({ data: { id: existing.id, duplicated: true } });

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO evento_departamentos (id, evento_id, department_id) VALUES (?, ?, ?)`
    )
      .bind(id, params.id, b.department_id)
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) return json({ data: { id, duplicated: true } });
    throw err;
  }
  return json({ data: { id } }, 201);
});

/**
 * POST /api/eventos/:id/departments/bulk — vincula vários de uma vez
 * (createStandardDepartmentsForEvento / linkStandardDepartmentsToEvento).
 */
post("/api/eventos/:id/departments/bulk", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const b = await readJson<{ department_ids?: string[] }>(request);
  const ids = (b.department_ids ?? []).filter(Boolean).slice(0, 100);
  if (ids.length === 0) return json({ data: { linked: 0 } });

  const existing = await env.DB.prepare(
    `SELECT department_id FROM evento_departamentos WHERE evento_id = ?`
  )
    .bind(params.id)
    .all();
  const have = new Set((existing.results as Record<string, unknown>[]).map((r) => String(r.department_id)));

  let linked = 0;
  for (const deptId of ids) {
    if (have.has(deptId)) continue;
    try {
      await env.DB.prepare(
        `INSERT INTO evento_departamentos (id, evento_id, department_id) VALUES (?, ?, ?)`
      )
        .bind(crypto.randomUUID(), params.id, deptId)
        .run();
      linked++;
    } catch (err) {
      if (!String(err).includes("UNIQUE")) throw err;
    }
  }
  return json({ data: { linked } });
});

/**
 * POST /api/eventos/:id/departments/standard
 * Garante que os departamentos padrão existem (cria os que faltarem) e
 * vincula todos os que ainda não estão no evento. Substitui o
 * createStandardDepartmentsForEvento + linkStandardDepartmentsToEvento do front.
 * Resposta: { linked, departments } — departments são os 12 padrão já
 * existentes no banco após a garantia (com coordenador_id legado).
 */
post("/api/eventos/:id/departments/standard", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);

  const evento = await env.DB.prepare(`SELECT id FROM eventos WHERE id = ?`)
    .bind(params.id)
    .first<{ id: string }>();
  if (!evento) throw new ApiError("Evento não encontrado.", 404);

  // 1. Garante que os 12 departamentos padrão existem (upsert por slug).
  for (const dept of STANDARD_DEPARTMENTS) {
    const existing = await env.DB.prepare(`SELECT id FROM departments WHERE slug = ?`)
      .bind(dept.slug)
      .first<{ id: string }>();
    if (!existing) {
      try {
        await env.DB.prepare(`INSERT INTO departments (id, name, slug) VALUES (?, ?, ?)`)
          .bind(crypto.randomUUID(), dept.name, dept.slug)
          .run();
      } catch (err) {
        if (!String(err).includes("UNIQUE")) throw err;
      }
    }
  }

  const slugs = STANDARD_DEPARTMENTS.map((d) => d.slug);
  const placeholders = slugs.map(() => "?").join(",");
  const standardRows = await env.DB.prepare(
    `SELECT id, name, slug, coordenador_id FROM departments
      WHERE slug IN (${placeholders}) ORDER BY name ASC`
  )
    .bind(...slugs)
    .all();
  const standard = standardRows.results as Record<string, unknown>[];

  // 2. Vincula os que faltarem no evento.
  const linkedRows = await env.DB.prepare(
    `SELECT department_id FROM evento_departamentos WHERE evento_id = ?`
  )
    .bind(params.id)
    .all();
  const have = new Set(
    (linkedRows.results as Record<string, unknown>[]).map((r) => String(r.department_id))
  );

  let linked = 0;
  for (const row of standard) {
    const deptId = String(row.id);
    if (have.has(deptId)) continue;
    try {
      await env.DB.prepare(
        `INSERT INTO evento_departamentos (id, evento_id, department_id) VALUES (?, ?, ?)`
      )
        .bind(crypto.randomUUID(), params.id, deptId)
        .run();
      linked++;
    } catch (err) {
      if (!String(err).includes("UNIQUE")) throw err;
    }
  }

  return json({ data: { linked, departments: mapRows(standard) } });
});

/** DELETE /api/eventos/:id/departments/:departmentId — só coordenador do departamento. */
del("/api/eventos/:id/departments/:departmentId", async ({ env, params, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  await requireCoordinator(env.DB, params.departmentId, user.id, params.id);
  await env.DB.prepare(
    `DELETE FROM evento_departamentos WHERE evento_id = ? AND department_id = ?`
  )
    .bind(params.id, params.departmentId)
    .run();
  return json({ data: { ok: true } });
});

/**
 * GET /api/departments/:id/history?evento_id=
 * Histórico de coordenação em outros eventos (getDepartmentHistory).
 */
get("/api/departments/:id/history", async ({ env, params, url, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  await requireMember(env.DB, params.id, user.id);

  const currentEventoId = url.searchParams.get("evento_id") ?? "";
  const rows = await env.DB.prepare(
    `SELECT dm.evento_id, e.id, e.tipo, e.estado, e.cidade, e.ano, e.slug
       FROM department_members dm
       JOIN eventos e ON e.id = dm.evento_id
      WHERE dm.department_id = ?
        AND dm.evento_id IS NOT NULL
        AND dm.evento_id <> ?
      ORDER BY e.ano DESC`
  )
    .bind(params.id, currentEventoId)
    .all();

  const data = (rows.results as Record<string, unknown>[]).map((row) => ({
    evento_id: row.evento_id,
    eventos: { id: row.id, tipo: row.tipo, estado: row.estado, cidade: row.cidade, ano: row.ano, slug: row.slug },
  }));
  return json({ data });
});
