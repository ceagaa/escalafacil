/**
 * Tipagens dos bindings do Worker.
 */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Segredo do JWT HS256 — configurado via `wrangler secret put JWT_SECRET`. */
  JWT_SECRET?: string;
  /** Client ID do Google Sign-In. */
  GOOGLE_CLIENT_ID?: string;
}

/** Payload do usuário autenticado — injetado nas rotas por `requireAuth`. */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  is_super_admin: boolean;
}
