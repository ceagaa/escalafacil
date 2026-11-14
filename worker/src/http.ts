/** Helpers HTTP compartilhados pelas rotas da API. */

/** Erro de domínio — vira resposta JSON com o status adequado. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const json = (body: unknown, status = 200, headers: Record<string, string | string[]> = {}): Response => {
  const h = new Headers();
  h.set("content-type", "application/json; charset=utf-8");
  for (const [key, value] of Object.entries(headers)) {
    // Set-Cookie não pode ser concatenado com vírgula — cada cookie vira um header.
    if (Array.isArray(value)) value.forEach((v) => h.append(key, v));
    else h.set(key, value);
  }
  return new Response(JSON.stringify(body), { status, headers: h });
};

/** Converte ApiError/erro inesperado em resposta JSON. */
export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return json({ error: err.message, code: err.code }, err.status);
  }
  console.error("[api]", err);
  return json({ error: "Erro interno." }, 500);
}

/** Lê e valida o corpo JSON. */
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("Corpo JSON inválido.", 400);
  }
}

/**
 * Extrai colunas de um registro, convertendo 0/1 -> boolean para os campos
 * conhecidos (a D1 guarda booleans como INTEGER).
 */
const BOOLEAN_COLUMNS = new Set(["active", "is_super_admin", "email_verified"]);

export function mapRow<T = Record<string, unknown>>(row: Record<string, unknown> | null): T | null {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = BOOLEAN_COLUMNS.has(key) && typeof value === "number" ? value === 1 : value;
  }
  return out as T;
}

export function mapRows<T = Record<string, unknown>>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => mapRow<T>(row)) as T[];
}

/** Monta uma lista de IDs segura para cláusula `IN (...)`. */
export function parseIdList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0 && id.length <= 64);
}
