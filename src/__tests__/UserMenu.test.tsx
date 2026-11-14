import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UserMenu, { getUserInitials } from "../components/UserMenu";
import { ThemeProvider } from "../context/ThemeContext";

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../services/api", () => ({
  apiPut: vi.fn(),
}));

import { useAuth } from "../context/AuthContext";
import { apiPut } from "../services/api";

const user = { id: "u-1", email: "ana.silva@example.com", name: "Ana Silva" };
const refreshSession = vi.fn().mockResolvedValue([]);

function renderUserMenu(onLogout = vi.fn()) {
  render(
    <ThemeProvider>
      <UserMenu user={user} onLogout={onLogout} />
    </ThemeProvider>
  );
  return onLogout;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.removeItem("escalafacil_theme");
  (useAuth as any).mockReturnValue({ profile: { name: "Ana Silva" }, refreshSession });
  (apiPut as any).mockResolvedValue({ id: "u-1" });
});

describe("getUserInitials", () => {
  it("usa primeiro e último nome", () => {
    expect(getUserInitials({ name: "Ana Silva", email: "a@b.c" })).toBe("AS");
    expect(getUserInitials({ name: "Maria da Silva Santos", email: "a@b.c" })).toBe("MS");
  });

  it("usa as duas primeiras letras do e-mail quando não há nome", () => {
    expect(getUserInitials({ name: null, email: "joao@example.com" })).toBe("JO");
    expect(getUserInitials({ name: "  ", email: "joao@example.com" })).toBe("JO");
  });
});

describe("UserMenu", () => {
  it("mostra as iniciais no avatar", () => {
    renderUserMenu();
    (expect(screen.getByRole("button", { name: "Abrir menu de Ana Silva" })) as any).toHaveTextContent("AS");
  });

  it("abre o menu com Perfil, Tema e Sair", () => {
    renderUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu de Ana Silva" }));

    (expect(screen.getByRole("menu", { name: "Menu do usuário" })) as any).toBeInTheDocument();
    (expect(screen.getByRole("menuitem", { name: /Perfil/ })) as any).toBeInTheDocument();
    (expect(screen.getByRole("menuitem", { name: /Tema/ })) as any).toBeInTheDocument();
    (expect(screen.getByRole("menuitem", { name: /Sair/ })) as any).toBeInTheDocument();
    // cabeçalho com identidade
    (expect(screen.getByText("ana.silva@example.com")) as any).toBeInTheDocument();
  });

  it("fecha com Escape", () => {
    renderUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu de Ana Silva" }));
    (expect(screen.getByRole("menu")) as any).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("fecha ao clicar fora", () => {
    renderUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu de Ana Silva" }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Sair chama onLogout e fecha o menu", () => {
    const onLogout = renderUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu de Ana Silva" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Sair/ }));

    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("Tema alterna a preferência e atualiza o rótulo", async () => {
    renderUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu de Ana Silva" }));

    // Preferência inicial: automático (localStorage vazio).
    (expect(screen.getByText("Automático")) as any).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /Tema/ }));
    await waitFor(() => {
      (expect(screen.getByText("Escuro")) as any).toBeInTheDocument();
    });
    expect(window.localStorage.getItem("escalafacil_theme")).toBe("dark");
  });

  it("Perfil abre o modal e salva o nome via PUT /api/profiles/me", async () => {
    renderUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu de Ana Silva" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Perfil/ }));

    (expect(screen.getByRole("dialog", { name: "Meu perfil" })) as any).toBeInTheDocument();
    (expect(screen.getByLabelText("Nome")) as any).toHaveValue("Ana Silva");
    (expect(screen.getByLabelText("E-mail")) as any).toHaveValue("ana.silva@example.com");

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Ana Souza" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith("/api/profiles/me", { name: "Ana Souza" });
    });
    expect(refreshSession).toHaveBeenCalled();
    await waitFor(() => {
      (expect(screen.getByText("Perfil atualizado.")) as any).toBeInTheDocument();
    });
  });

  it("desabilita o salvar com nome vazio", () => {
    renderUserMenu();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu de Ana Silva" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Perfil/ }));

    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "   " } });
    (expect(screen.getByRole("button", { name: "Salvar" })) as any).toBeDisabled();
    expect(apiPut).not.toHaveBeenCalled();
  });
});
