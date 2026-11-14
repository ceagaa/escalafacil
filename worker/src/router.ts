/** Router mínimo: casa `METHOD /path` com suporte a `:param`. */

export type Handler = (ctx: {
  request: Request;
  env: import("./env").Env;
  params: Record<string, string>;
  url: URL;
  user: import("./env").AuthUser | null;
}) => Promise<Response> | Response;

interface Route {
  method: string;
  pattern: string;
  segments: string[];
  handler: Handler;
}

const routes: Route[] = [];

function compile(pattern: string): string[] {
  return pattern.split("/").filter(Boolean);
}

export function route(method: string, pattern: string, handler: Handler): void {
  routes.push({ method: method.toUpperCase(), pattern, segments: compile(pattern), handler });
}

export const get = (p: string, h: Handler) => route("GET", p, h);
export const post = (p: string, h: Handler) => route("POST", p, h);
export const patch = (p: string, h: Handler) => route("PATCH", p, h);
export const put = (p: string, h: Handler) => route("PUT", p, h);
export const del = (p: string, h: Handler) => route("DELETE", p, h);

/** Tenta rotear; devolve null se nenhuma rota casar. */
export async function dispatch(
  request: Request,
  env: import("./env").Env,
  pathname: string,
  user: import("./env").AuthUser | null
): Promise<Response | null> {
  const method = request.method.toUpperCase();
  const parts = compile(pathname);
  const url = new URL(request.url);

  for (const r of routes) {
    if (r.method !== method) continue;
    if (r.segments.length !== parts.length) continue;

    const params: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < r.segments.length; i++) {
      const seg = r.segments[i];
      if (seg.startsWith(":")) {
        params[seg.slice(1)] = decodeURIComponent(parts[i]);
      } else if (seg !== parts[i]) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;

    return r.handler({ request, env, params, url, user });
  }
  return null;
}
