/**
 * Rotas de autenticação — substituem o Supabase Auth.
 *
 *   POST /auth/login        { email, password }
 *   POST /auth/signup       { email, password, name }
 *   POST /auth/logout
 *   GET  /auth/session      -> { user } | 401
 *   POST /auth/refresh      -> rotaciona refresh token
 *   POST /auth/google        { credential }  (ID token do GSI)
 *   POST /auth/password/forgot  { email }
 *   POST /auth/password/reset   { token, password }
 *
 * Cookies httpOnly: ef_at (access 15min) + ef_rt (refresh 30d rotativo).
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import { hashPassword, verifyPassword } from "./password";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  readCookie,
  setAuthCookies,
  signAccessToken,
  verifyAccessToken,
} from "./tokens";
import {
  createSession,
  findSession,
  revokeAllSessions,
  revokeSession,
  rotateSession,
} from "./sessions";
import type { Env, AuthUser } from "../env";

const encoder = new TextEncoder();

const json = (body: unknown, status = 200, headers: Record<string, string | string[]> = {}): Response => {
  const h = new Headers();
  h.set("content-type", "application/json; charset=utf-8");
  for (const [key, value] of Object.entries(headers)) {
    // Set-Cookie não pode ser concatenado com vírgula — cada cookie vira um header.
    if (Array.isArray(value)) value.forEach((v) => h.append(key, v));
    else h.set(key, value);
  }
  return new Response(JSON.stringify(body), { status, headers: h });
};

function normalizeEmail(email: unknown): string {
  return String(email || "").trim().toLowerCase();
}

/** Google JWKS cacheado por módulo. */
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function googleJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
  }
  return jwks;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Lê o user autenticado do access token (ou null). */
export async function getAuthUser(env: Env, request: Request): Promise<AuthUser | null> {
  const token = readCookie(request.headers.get("cookie"), ACCESS_COOKIE);
  if (!token || !env.JWT_SECRET) return null;
  const payload = await verifyAccessToken(token, env.JWT_SECRET);
  if (!payload) return null;
  const row = await env.DB.prepare(
    `SELECT p.id, p.email, p.name, p.is_super_admin
       FROM profiles p WHERE p.id = ?`
  )
    .bind(payload.sub)
    .first<{ id: string; email: string | null; name: string | null; is_super_admin: number }>();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email ?? payload.email,
    name: row.name,
    is_super_admin: row.is_super_admin === 1,
  };
}

/** Exige sessão válida — devolve Response de erro ou null. */
async function requireAuth(env: Env, request: Request): Promise<{ user: AuthUser } | Response> {
  const user = await getAuthUser(env, request);
  if (!user) return json({ error: "Não autenticado" }, 401);
  return { user };
}

/** Emite os cookies de sessão para um usuário. */
async function issueSession(env: Env, user: { id: string; email: string; name?: string | null }, request: Request): Promise<Response> {
  if (!env.JWT_SECRET) return json({ error: "Servidor não configurado (JWT_SECRET)." }, 500);
  const secure = new URL(request.url).protocol === "https:";
  const accessToken = await signAccessToken(
    { sub: user.id, email: user.email, name: user.name ?? undefined },
    env.JWT_SECRET
  );
  const refreshToken = await createSession(env, user.id, request.headers.get("user-agent"));
  return json(
    { user: { id: user.id, email: user.email, name: user.name ?? null } },
    200,
    { "set-cookie": setAuthCookies(accessToken, refreshToken, secure) }
  );
}

interface AuthUserRow {
  id: string;
  email: string;
  password_hash: string | null;
  provider: string;
}

export async function handleAuth(pathname: string, request: Request, env: Env): Promise<Response | null> {
  // ---------------------------------------------------------- login
  if (pathname === "/auth/login" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!email || !password) return json({ error: "E-mail e senha são obrigatórios." }, 400);

    const row = await env.DB.prepare(
      `SELECT id, email, password_hash, provider FROM auth_users WHERE email = ?`
    )
      .bind(email)
      .first<AuthUserRow>();

    // Resposta genérica: não revelar se a conta existe.
    if (!row || !row.password_hash) return json({ error: "E-mail ou senha inválidos." }, 401);

    const result = await verifyPassword(password, row.password_hash);
    if (!result.ok) return json({ error: "E-mail ou senha inválidos." }, 401);

    // Re-hash de hashes legados (bcrypt do Supabase) para PBKDF2.
    if (result.needsRehash) {
      const fresh = await hashPassword(password);
      await env.DB.prepare(`UPDATE auth_users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
        .bind(fresh, row.id)
        .run();
    }

    const profile = await env.DB.prepare(`SELECT name FROM profiles WHERE id = ?`).bind(row.id).first<{ name: string | null }>();
    return issueSession(env, { id: row.id, email: row.email, name: profile?.name ?? null }, request);
  }

  // ---------------------------------------------------------- signup
  if (pathname === "/auth/signup" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string; name?: string };
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    if (!email || !password) return json({ error: "E-mail e senha são obrigatórios." }, 400);
    if (password.length < 6) return json({ error: "A senha deve ter pelo menos 6 caracteres." }, 400);

    const existing = await env.DB.prepare(`SELECT id FROM auth_users WHERE email = ?`).bind(email).first<{ id: string }>();
    if (existing) return json({ error: "Este e-mail já está cadastrado." }, 409);

    const id = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    // auth_users + profiles numa única transação (substitui o trigger do Supabase).
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO auth_users (id, email, password_hash, provider, email_verified) VALUES (?, ?, ?, 'email', 0)`
      ).bind(id, email, passwordHash),
      env.DB.prepare(`INSERT INTO profiles (id, email, name) VALUES (?, ?, ?)`).bind(id, email, name),
    ]);

    return issueSession(env, { id, email, name }, request);
  }

  // ---------------------------------------------------------- session
  if (pathname === "/auth/session" && request.method === "GET") {
    const guard = await requireAuth(env, request);
    if (guard instanceof Response) return guard;
    return json({ user: guard.user });
  }

  // ---------------------------------------------------------- refresh
  if (pathname === "/auth/refresh" && request.method === "POST") {
    const secure = new URL(request.url).protocol === "https:";
    const refreshToken = readCookie(request.headers.get("cookie"), REFRESH_COOKIE);
    if (!refreshToken || !env.JWT_SECRET) return json({ error: "Sessão expirada." }, 401);

    const session = await findSession(env, refreshToken);
    if (!session) return json({ error: "Sessão expirada." }, 401, { "set-cookie": clearAuthCookies(secure) });

    const profile = await env.DB.prepare(`SELECT email, name FROM profiles WHERE id = ?`)
      .bind(session.user_id)
      .first<{ email: string | null; name: string | null }>();
    if (!profile?.email) {
      await revokeAllSessions(env, session.user_id);
      return json({ error: "Sessão expirada." }, 401, { "set-cookie": clearAuthCookies(secure) });
    }

    const accessToken = await signAccessToken(
      {
        sub: session.user_id,
        email: profile.email,
        name: profile.name ?? undefined,
      },
      env.JWT_SECRET
    );
    const newRefresh = await rotateSession(env, session.id, session.user_id, request.headers.get("user-agent"));
    return json({ user: { id: session.user_id, email: profile.email, name: profile.name ?? null } }, 200, {
      "set-cookie": setAuthCookies(accessToken, newRefresh, secure),
    });
  }

  // ---------------------------------------------------------- logout
  if (pathname === "/auth/logout" && request.method === "POST") {
    const secure = new URL(request.url).protocol === "https:";
    const refreshToken = readCookie(request.headers.get("cookie"), REFRESH_COOKIE);
    if (refreshToken) await revokeSession(env, refreshToken);
    return json({ ok: true }, 200, { "set-cookie": clearAuthCookies(secure) });
  }

  // ---------------------------------------------------------- google
  if (pathname === "/auth/google" && request.method === "POST") {
    const clientId = env.GOOGLE_CLIENT_ID;
    if (!clientId) return json({ error: "Login Google não configurado." }, 500);

    const body = (await request.json().catch(() => ({}))) as { credential?: string };
    if (!body.credential) return json({ error: "Credencial Google ausente." }, 400);

    let googleSub: string;
    let googleEmail: string;
    let googleName: string | null;
    try {
      const { payload } = await jwtVerify(body.credential, googleJwks(), {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: clientId,
      });
      if (!payload.sub || !payload.email) throw new Error("missing claims");
      googleSub = payload.sub;
      googleEmail = normalizeEmail(payload.email);
      googleName = typeof payload.name === "string" ? payload.name : null;
    } catch {
      return json({ error: "Credencial Google inválida." }, 401);
    }

    // 1) Já temos auth_users com este google_sub?
    let userRow = await env.DB.prepare(
      `SELECT id, email, password_hash, provider FROM auth_users WHERE google_sub = ?`
    )
      .bind(googleSub)
      .first<AuthUserRow>();

    // 2) Senão, tenta casar por e-mail (conta já cadastrada com senha).
    if (!userRow) {
      const byEmail = await env.DB.prepare(
        `SELECT id, email, password_hash, provider FROM auth_users WHERE email = ?`
      )
        .bind(googleEmail)
        .first<AuthUserRow>();

      if (byEmail) {
        await env.DB.prepare(
          `UPDATE auth_users SET google_sub = ?, provider = 'google', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
        )
          .bind(googleSub, byEmail.id)
          .run();
        userRow = { ...byEmail, provider: "google" };
      } else {
        // 3) Conta nova: cria auth_users + profiles.
        const id = crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO auth_users (id, email, password_hash, provider, google_sub, email_verified) VALUES (?, ?, NULL, 'google', ?, 1)`
          ).bind(id, googleEmail, googleSub),
          env.DB.prepare(`INSERT INTO profiles (id, email, name) VALUES (?, ?, ?)`).bind(id, googleEmail, googleName),
        ]);
        userRow = { id, email: googleEmail, password_hash: null, provider: "google" };
      }
    }

    // Garante que o profile exista (contas antigas podem não ter).
    await env.DB.prepare(
      `INSERT INTO profiles (id, email, name) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = COALESCE(profiles.email, excluded.email)`
    )
      .bind(userRow.id, userRow.email, googleName)
      .run();

    const profile = await env.DB.prepare(`SELECT name FROM profiles WHERE id = ?`)
      .bind(userRow.id)
      .first<{ name: string | null }>();

    return issueSession(env, { id: userRow.id, email: userRow.email, name: profile?.name ?? null }, request);
  }

  // ---------------------------------------------------------- password reset
  if (pathname === "/auth/password/forgot" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { email?: string };
    const email = normalizeEmail(body.email);
    if (!email) return json({ error: "E-mail obrigatório." }, 400);

    const user = await env.DB.prepare(`SELECT id FROM auth_users WHERE email = ?`).bind(email).first<{ id: string }>();

    // Resposta sempre igual — não confirma existência da conta.
    const generic = json({ ok: true, message: "Se este e-mail estiver cadastrado, enviaremos um link de redefinição." });

    if (!user) return generic;

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256Hex(token);
    await env.DB.prepare(
      `INSERT INTO auth_password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)`
    )
      .bind(tokenHash, user.id, new Date(Date.now() + 60 * 60 * 1000).toISOString())
      .run();

    // TODO: enviar e-mail. Por ora o token fica disponível apenas em log de dev.
    if (env.JWT_SECRET) {
      console.info(`[password-reset] token para ${email}: ${token}`);
    }
    return generic;
  }

  if (pathname === "/auth/password/reset" && request.method === "POST") {
    const body = (await request.json().catch(() => ({}))) as { token?: string; password?: string };
    const password = String(body.password || "");
    if (!body.token || !password) return json({ error: "Token e senha obrigatórios." }, 400);
    if (password.length < 6) return json({ error: "A senha deve ter pelo menos 6 caracteres." }, 400);

    const tokenHash = await sha256Hex(body.token);
    const row = await env.DB.prepare(
      `SELECT token_hash, user_id, expires_at, used_at FROM auth_password_resets WHERE token_hash = ?`
    )
      .bind(tokenHash)
      .first<{ token_hash: string; user_id: string; expires_at: string; used_at: string | null }>();

    if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
      return json({ error: "Link inválido ou expirado." }, 400);
    }

    const hash = await hashPassword(password);
    await env.DB.batch([
      env.DB.prepare(`UPDATE auth_users SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
        .bind(hash, row.user_id),
      env.DB.prepare(`UPDATE auth_password_resets SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE token_hash = ?`)
        .bind(tokenHash),
      env.DB.prepare(`DELETE FROM auth_sessions WHERE user_id = ?`).bind(row.user_id),
    ]);

    return json({ ok: true, message: "Senha redefinida com sucesso." });
  }

  return null;
}
