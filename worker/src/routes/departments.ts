/**
 * Rotas de departamentos.
 *
 * Regras portadas do RLS:
 *   departments SELECT: público | INSERT: autenticado
 *   UPDATE: coordenador OU coordenador_id IS NULL (claim legado)
 */
import { get, post, patch } from "../router";
import { ApiError, json, mapRow, mapRows, readJson } from "../http";
import { canUpdateDepartment, isCoordinator, requireCoordinator } from "../guards";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * GET /api/departments?slug_in=a,b  |  ?id_in=a,b  |  ?id=  |  ?coordenador_id=
 * Leitura de departamentos (pública no RLS, mas exigimos sessão para as
 * rotas autenticadas; a leitura pública fica em /api/public/*).
 */
get("/api/departments", async ({ env, url, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);

  const slugIn = url.searchParams.get("slug_in");
  const idIn = url.searchParams.get("id_in");
  const id = url.searchParams.get("id");
  const coordenadorId = url.searchParams.get("coordenador_id");

  if (slugIn) {
    const slugs = slugIn.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
    if (slugs.length === 0) return json({ data: [] });
    const placeholders = slugs.map(() => "?").join(",");
    const rows = await env.DB.prepare(
      `SELECT id, name, slug, active, features, coordenador_id, created_at
         FROM departments WHERE slug IN (${placeholders}) ORDER BY name ASC`
    )
      .bind(...slugs)
      .all();
    return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
  }

  if (idIn) {
    const ids = idIn.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
    if (ids.length === 0) return json({ data: [] });
    const placeholders = ids.map(() => "?").join(",");
    const rows = await env.DB.prepare(
      `SELECT id, name, slug, active, features, coordenador_id, created_at
         FROM departments WHERE id IN (${placeholders}) ORDER BY name ASC`
    )
      .bind(...ids)
      .all();
    return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
  }

  if (coordenadorId) {
    const rows = await env.DB.prepare(
      `SELECT id, name, slug, active, features, coordenador_id, created_at
         FROM departments WHERE coordenador_id = ?`
    )
      .bind(coordenadorId)
      .all();
    return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
  }

  if (id) {
    const row = await env.DB.prepare(
      `SELECT id, name, slug, active, features, coordenador_id, created_at
         FROM departments WHERE id = ?`
    )
      .bind(id)
      .first();
    if (!row) throw new ApiError("Departamento não encontrado.", 404);
    return json({ data: mapRow(row) });
  }

  throw new ApiError("Informe slug_in, id_in, id ou coordenador_id.", 400);
});

/**
 * GET /api/departments/links?department_id_in=a,b
 * Vínculos evento<->departamento a partir dos departamentos (usado pelo
 * getCoordinatedEventoIds do front para descobrir eventos do usuário).
 */
get("/api/departments/links", async ({ env, url, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const ids = (url.searchParams.get("department_id_in") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (ids.length === 0) return json({ data: [] });

  const placeholders = ids.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT evento_id, department_id FROM evento_departamentos
      WHERE department_id IN (${placeholders})`
  )
    .bind(...ids)
    .all();
  return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
});

/**
 * GET /api/departments/owner?slug=  — dono pelo slug (RPC
 * get_department_owner_by_slug, que exigia auth.uid() NOT NULL).
 */
get("/api/departments/owner", async ({ env, url, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const slug = url.searchParams.get("slug");
  if (!slug) throw new ApiError("slug é obrigatório.", 400);

  const row = await env.DB.prepare(
    `SELECT p.name
       FROM departments d
       JOIN department_members dm ON dm.department_id = d.id AND dm.role = 'coordenador'
       JOIN profiles p ON p.id = dm.user_id
      WHERE d.slug = ?
      LIMIT 1`
  )
    .bind(slug)
    .first<{ name: string | null }>();

  return json({ data: row?.name ?? null });
});

/**
 * GET /api/departments/:id/owner?evento_id=  — coordenador no escopo do evento
 * (getEventoDepartmentOwner), com fallback para a coluna legada.
 */
get("/api/departments/:id/owner", async ({ env, params, url, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const eventoId = url.searchParams.get("evento_id");

  const row = await env.DB.prepare(
    `SELECT dm.user_id, p.name
       FROM department_members dm
       LEFT JOIN profiles p ON p.id = dm.user_id
      WHERE dm.department_id = ? AND dm.role = 'coordenador'
        AND ${eventoId ? "dm.evento_id = ?" : "dm.evento_id IS NULL"}
      LIMIT 1`
  )
    .bind(...((eventoId ? [params.id, eventoId] : [params.id]) as never[]))
    .first<{ user_id: string; name: string | null }>();

  if (row) return json({ data: { userId: row.user_id, name: row.name ?? null } });

  // Fallback: coluna legada departments.coordenador_id
  const legacy = await env.DB.prepare(
    `SELECT d.coordenador_id AS user_id, p.name
       FROM departments d LEFT JOIN profiles p ON p.id = d.coordenador_id
      WHERE d.id = ? AND d.coordenador_id IS NOT NULL`
  )
    .bind(params.id)
    .first<{ user_id: string; name: string | null }>();

  return json({ data: legacy ? { userId: legacy.user_id, name: legacy.name ?? null } : null });
});

/** POST /api/departments — cria departamento (autenticado). */
post("/api/departments", async ({ env, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const b = await readJson<{ name?: string; slug?: string; evento_id?: string | null }>(request);
  const name = String(b.name ?? "").trim();
  if (!name) throw new ApiError("name é obrigatório.", 400);

  const slug = b.slug || slugify(name);
  const existing = await env.DB.prepare(
    `SELECT id, name, slug FROM departments WHERE slug = ?`
  )
    .bind(slug)
    .first<{ id: string; name: string; slug: string }>();

  if (existing) {
    // Comportamento do createDepartment: devolve o existente, mas avisa se
    // já houver coordenador no escopo do evento.
    if (b.evento_id) {
      const owner = await env.DB.prepare(
        `SELECT p.name FROM department_members dm
           LEFT JOIN profiles p ON p.id = dm.user_id
          WHERE dm.department_id = ? AND dm.role = 'coordenador' AND dm.evento_id = ?
          LIMIT 1`
      )
        .bind(existing.id, b.evento_id)
        .first<{ name: string | null }>();
      if (owner?.name) {
        throw new ApiError(
          "Departamento já possui coordenador para este evento: " + owner.name,
          409,
          "23505"
        );
      }
    }
    return json({ data: existing });
  }

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO departments (id, name, slug) VALUES (?, ?, ?)`
    )
      .bind(id, name, slug)
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      const again = await env.DB.prepare(
        `SELECT id, name, slug FROM departments WHERE slug = ?`
      )
        .bind(slug)
        .first();
      if (again) return json({ data: again });
    }
    throw err;
  }

  const row = await env.DB.prepare(
    `SELECT id, name, slug, active, features, coordenador_id, created_at FROM departments WHERE id = ?`
  )
    .bind(id)
    .first();
  return json({ data: mapRow(row) }, 201);
});

/** PATCH /api/departments/:id — coordenador ou departamento livre. */
patch("/api/departments/:id", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  if (!(await canUpdateDepartment(env.DB, params.id, user.id))) {
    throw new ApiError("Apenas o coordenador pode editar este departamento.", 403);
  }
  const b = await readJson<{ name?: string; active?: boolean; features?: unknown; coordenador_id?: string | null }>(request);

  const sets: string[] = [];
  const binds: unknown[] = [];
  if (typeof b.name === "string") {
    sets.push("name = ?");
    binds.push(b.name);
  }
  if (typeof b.active === "boolean") {
    sets.push("active = ?");
    binds.push(b.active ? 1 : 0);
  }
  if (b.features !== undefined) {
    sets.push("features = ?");
    binds.push(typeof b.features === "string" ? b.features : JSON.stringify(b.features));
  }
  if (b.coordenador_id !== undefined) {
    // Só o próprio usuário pode virar coordenador, ou null (revogar).
    if (b.coordenador_id && b.coordenador_id !== user.id) {
      throw new ApiError("Só é possível definir a si mesmo como coordenador.", 403);
    }
    sets.push("coordenador_id = ?");
    binds.push(b.coordenador_id);
  }
  if (sets.length === 0) throw new ApiError("Nada para atualizar.", 400);

  binds.push(params.id);
  await env.DB.prepare(`UPDATE departments SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...(binds as never[]))
    .run();

  const row = await env.DB.prepare(
    `SELECT id, name, slug, active, features, coordenador_id, created_at FROM departments WHERE id = ?`
  )
    .bind(params.id)
    .first();
  return json({ data: mapRow(row) });
});

/**
 * POST /api/departments/:id/claim — assume coordenação num evento
 * (claimDepartmentForEvento). Regra RLS: eu mesmo, role coordenador e
 * sem coordenador no escopo do evento.
 */
post("/api/departments/:id/claim", async ({ env, params, request, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const b = await readJson<{ evento_id?: string }>(request);
  if (!b.evento_id) throw new ApiError("Evento ID é obrigatório para assumir departamento.", 400);

  const existing = await env.DB.prepare(
    `SELECT id, user_id FROM department_members
      WHERE department_id = ? AND evento_id = ?`
  )
    .bind(params.id, b.evento_id)
    .first<{ id: string; user_id: string }>();

  if (existing) {
    if (existing.user_id === user.id) {
      // Já é coordenador — devolve a linha (idempotente, como o upsert).
      const row = await env.DB.prepare(
        `SELECT * FROM department_members WHERE id = ?`
      )
        .bind(existing.id)
        .first();
      return json({ data: mapRow(row) });
    }
    throw new ApiError("Departamento já possui coordenador para este evento.", 409, "23505");
  }

  // Também bloqueia se houver coordenador legado (evento_id NULL) — mesma
  // regra de department_has_coordinator_in_event.
  const legacyOwner = await env.DB.prepare(
    `SELECT user_id FROM department_members
      WHERE department_id = ? AND role = 'coordenador' AND evento_id IS NULL
      LIMIT 1`
  )
    .bind(params.id)
    .first<{ user_id: string }>();
  if (legacyOwner) {
    throw new ApiError("Departamento já possui coordenador.", 409, "23505");
  }

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO department_members (id, department_id, user_id, role, evento_id)
       VALUES (?, ?, ?, 'coordenador', ?)`
    )
      .bind(id, params.id, user.id, b.evento_id)
      .run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) {
      throw new ApiError("Departamento já possui coordenador para este evento.", 409, "23505");
    }
    throw err;
  }

  const row = await env.DB.prepare(`SELECT * FROM department_members WHERE id = ?`)
    .bind(id)
    .first();
  return json({ data: mapRow(row) }, 201);
});

/**
 * GET /api/departments/standard — departamentos padrão por slug
 * (fetchStandardDepartments / fetchEventDepartments fallback).
 */
get("/api/departments/standard", async ({ env, url, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const slugIn = url.searchParams.get("slug_in");
  const slugs = (slugIn ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
  if (slugs.length === 0) return json({ data: [] });

  const placeholders = slugs.map(() => "?").join(",");
  const rows = await env.DB.prepare(
    `SELECT id, name, slug, coordenador_id FROM departments WHERE slug IN (${placeholders})`
  )
    .bind(...slugs)
    .all();
  return json({ data: mapRows(rows.results as Record<string, unknown>[]) });
});

/** GET /api/departments/:id/coordinated — sou coordenador? (diagnóstico). */
get("/api/departments/:id/coordinated", async ({ env, params, url, user }) => {
  if (!user) throw new ApiError("Não autenticado.", 401);
  const eventoId = url.searchParams.get("evento_id");
  const ok = await isCoordinator(env.DB, params.id, user.id, eventoId);
  return json({ data: { coordinated: ok } });
});
