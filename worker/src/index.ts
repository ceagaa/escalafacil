/**
 * EscalaFácil API — Cloudflare Worker + D1.
 *
 * Rotas:
 *   /auth/*   — login, signup, session, refresh, google, password reset
 *   /api/*    — dados (guards de autorização em ../guards)
 *   demais    — assets do SPA (build do Vite)
 */
import "./routes/members";
import "./routes/eventos";
import "./routes/departments";
import "./routes/volunteers";
import "./routes/schedule";
import "./routes/public";

import { handleAuth, getAuthUser } from "./auth/authRoutes";
import { dispatch } from "./router";
import { errorResponse, json } from "./http";
import type { Env } from "./env";

export type { Env };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // ---------------------------------------------------------- auth
    if (pathname.startsWith("/auth/")) {
      try {
        const handled = await handleAuth(pathname, request, env);
        if (handled) return handled;
        return json({ error: "Not found" }, 404);
      } catch (err) {
        console.error("[auth]", err);
        return json({ error: "Erro interno de autenticação." }, 500);
      }
    }

    // ---------------------------------------------------------- api
    if (pathname.startsWith("/api/")) {
      try {
        // Health check não depende de sessão.
        if (pathname === "/api/health") {
          const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
          return json({ ok: row?.ok === 1, db: "d1" });
        }

        // Sessão é resolvida uma única vez e repassada aos handlers.
        const user = pathname.startsWith("/api/public/")
          ? null
          : await getAuthUser(env, request);

        const response = await dispatch(request, env, pathname, user);
        if (response) return response;

        return json({ error: "Not found" }, 404);
      } catch (err) {
        return errorResponse(err);
      }
    }

    // ---------------------------------------------------------- SPA
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
