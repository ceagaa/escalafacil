export const SAFE_ERROR_MESSAGES = {
  fetch: "Erro ao carregar dados.",
  create: "Erro ao salvar registro.",
  update: "Erro ao atualizar registro.",
  delete: "Erro ao excluir registro.",
  auth: "Falha na autenticação.",
  upload: "Erro no upload da imagem.",
  unknown: "Ocorreu um erro inesperado.",
} as const;

export type SafeErrorOperation = keyof typeof SAFE_ERROR_MESSAGES;

type SanitizableError = {
  code?: string;
  message?: string;
  status?: number;
};

export function sanitizeError(error: unknown, operation: SafeErrorOperation = "unknown"): string {
  const base = SAFE_ERROR_MESSAGES[operation] || SAFE_ERROR_MESSAGES.unknown;
  if (!error) return base;
  if (typeof error === "string") return base;
  const err = error as SanitizableError;
  if (err.code === "23505") return "Registro duplicado.";
  if (err.code === "42501" || err.code === "42P01") return "Acesso negado.";
  if (err.message?.includes("permission denied")) return "Acesso negado.";
  if (err.message?.includes("does not exist")) return "Recurso não encontrado.";
  if (err.message?.includes("violates")) return "Dados inválidos.";
  if (err.status === 401) return "Sessão expirada. Faça login novamente.";
  if (err.status === 403) return "Você não tem permissão para esta ação.";
  if (err.status === 404) return "Recurso não encontrado.";
  if (err.status !== undefined && err.status >= 500) return "Erro no servidor. Tente novamente.";
  if (import.meta.env?.DEV) {
    return err.message || base;
  }
  return base;
}
