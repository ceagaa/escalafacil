export const SAFE_ERROR_MESSAGES = {
  fetch: "Erro ao carregar dados.",
  create: "Erro ao salvar registro.",
  update: "Erro ao atualizar registro.",
  delete: "Erro ao excluir registro.",
  auth: "Falha na autenticação.",
  upload: "Erro no upload da imagem.",
  unknown: "Ocorreu um erro inesperado.",
};

export function sanitizeError(error, operation = "unknown") {
  const base = SAFE_ERROR_MESSAGES[operation] || SAFE_ERROR_MESSAGES.unknown;
  if (!error) return base;
  if (typeof error === "string") return base;
  if (error.code === "23505") return "Registro duplicado.";
  if (error.code === "42501" || error.code === "42P01") return "Acesso negado.";
  if (error.message?.includes("permission denied")) return "Acesso negado.";
  if (error.message?.includes("does not exist")) return "Recurso não encontrado.";
  if (error.message?.includes("violates")) return "Dados inválidos.";
  if (error.status === 401) return "Sessão expirada. Faça login novamente.";
  if (error.status === 403) return "Você não tem permissão para esta ação.";
  if (error.status === 404) return "Recurso não encontrado.";
  if (error.status >= 500) return "Erro no servidor. Tente novamente.";
  if (import.meta.env?.DEV) {
    return error.message || base;
  }
  return base;
}
