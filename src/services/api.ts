/**
 * Cliente HTTP da API (Cloudflare Worker + D1).
 *
 * - URLs relativas (`/api/*`, `/auth/*`): em produção o Worker serve o SPA e
 *   a API no mesmo domínio; em dev o Vite faz proxy para http://localhost:8787.
 * - Cookies httpOnly (`ef_at` + `ef_rt`) com `credentials: "include"`.
 * - Em 401 tenta renovar a sessão via POST /auth/refresh e repete a chamada
 *   uma única vez (deduplicado para não disparar várias renovações juntas).
 */

/** Usuário autenticado devolvido pelas rotas /auth/*. */
export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

/**
 * Erro de API. `safe` indica que a mensagem veio do nosso Worker
 * (status < 500) e pode ser exibida ao usuário via `sanitizeError`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly safe: boolean;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.safe = status > 0 && status < 500;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Não tenta renovar a sessão em 401 (rotas de credenciais). */
  skipRefresh?: boolean;
}

function fallbackMessage(status: number): string {
  if (status === 401) return "Sessão expirada. Faça login novamente.";
  if (status === 403) return "Você não tem permissão para esta ação.";
  if (status === 404) return "Recurso não encontrado.";
  if (status >= 500) return "Erro no servidor. Tente novamente.";
  return "Ocorreu um erro inesperado.";
}

/** Renovação de sessão compartilhada (evita chamadas concorrentes). */
let refreshPromise: Promise<boolean> | null = null;

function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch("/auth/refresh", { method: "POST", credentials: "include" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = "GET", body, skipRefresh = false } = options;

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "include",
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Falha de conexão com o servidor.", 0);
  }

  // Access token expirado: renova e repete uma única vez.
  if (res.status === 401 && !skipRefresh && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options, true);
    }
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const data = payload as { error?: string; code?: string } | null;
    throw new ApiError(data?.error || fallbackMessage(res.status), res.status, data?.code);
  }

  return payload as T;
}

/** Requisição crua (corpo completo `{ data }`, `{ user }`, `{ ok }`...). */
export function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, options);
}

/** Requisição que devolve o campo `data` da resposta. */
export async function apiData<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const body = await request<{ data?: T }>(path, options);
  return body?.data as T;
}

export const apiGet = <T>(path: string): Promise<T> => apiData<T>(path);

export const apiPost = <T>(path: string, body?: unknown): Promise<T> =>
  apiData<T>(path, { method: "POST", body });

export const apiPatch = <T>(path: string, body?: unknown): Promise<T> =>
  apiData<T>(path, { method: "PATCH", body });

export const apiPut = <T>(path: string, body?: unknown): Promise<T> =>
  apiData<T>(path, { method: "PUT", body });

export const apiDelete = <T>(path: string): Promise<T> => apiData<T>(path, { method: "DELETE" });
