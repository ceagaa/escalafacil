/**
 * Sessões (refresh tokens) persistidas na D1.
 * Guardamos apenas o SHA-256 do token — o valor cru só vive no cookie.
 */
import { generateRefreshToken, hashToken } from "./tokens";
import type { Env } from "../env";

function refreshExpiryDate(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

export interface SessionRecord {
  id: string;
  user_id: string;
  expires_at: string;
}

/** Cria sessão e devolve o refresh token cru (para o cookie). */
export async function createSession(env: Env, userId: string, userAgent?: string | null): Promise<string> {
  const refreshToken = generateRefreshToken();
  const id = await hashToken(refreshToken);
  await env.DB.prepare(
    `INSERT INTO auth_sessions (id, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)`
  )
    .bind(id, userId, refreshExpiryDate(), userAgent?.slice(0, 300) ?? null)
    .run();
  return refreshToken;
}

/** Valida o refresh token e devolve o user_id, ou null. */
export async function findSession(env: Env, refreshToken: string): Promise<SessionRecord | null> {
  if (!refreshToken) return null;
  const id = await hashToken(refreshToken);
  const row = await env.DB.prepare(
    `SELECT id, user_id, expires_at FROM auth_sessions WHERE id = ?`
  )
    .bind(id)
    .first<SessionRecord>();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await env.DB.prepare(`DELETE FROM auth_sessions WHERE id = ?`).bind(id).run();
    return null;
  }
  return row;
}

/** Rotação: apaga a sessão antiga e cria uma nova. */
export async function rotateSession(env: Env, oldSessionId: string, userId: string, userAgent?: string | null): Promise<string> {
  await env.DB.prepare(`DELETE FROM auth_sessions WHERE id = ?`).bind(oldSessionId).run();
  return createSession(env, userId, userAgent);
}

/** Encerra uma sessão específica (logout). */
export async function revokeSession(env: Env, refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  const id = await hashToken(refreshToken);
  await env.DB.prepare(`DELETE FROM auth_sessions WHERE id = ?`).bind(id).run();
}

/** Encerra todas as sessões do usuário (ex.: troca de senha). */
export async function revokeAllSessions(env: Env, userId: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM auth_sessions WHERE user_id = ?`).bind(userId).run();
}
