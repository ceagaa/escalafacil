import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Login from "../pages/Login";

const mockLogin = vi.fn();
const mockSignUp = vi.fn();
const mockResetPassword = vi.fn();
const mockRefreshSession = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    loading: false,
    login: mockLogin,
    signUp: mockSignUp,
    resetPassword: mockResetPassword,
    refreshSession: mockRefreshSession,
  })),
}));

import { useAuth } from "../context/AuthContext";

vi.mock("../services/api", () => ({
  apiRequest: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

import { apiRequest } from "../services/api";

function setupGoogleGisMock() {
  const state: { callback: ((response: any) => Promise<void>) | null } = { callback: null };
  window.google = {
    accounts: {
      id: {
        initialize: vi.fn((config) => {
          state.callback = config.callback;
        }),
        renderButton: vi.fn(),
      },
    },
  };
  return {
    async triggerCallback(response: any) {
      await state.callback!(response);
    },
  };
}

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Login />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  delete window.google;
  (useAuth as any).mockReturnValue({
    user: null,
    loading: false,
    login: mockLogin,
    signUp: mockSignUp,
    resetPassword: mockResetPassword,
    refreshSession: mockRefreshSession,
  });
});

describe("Login", () => {
  it("renders the login form with tabs", () => {
    renderLogin();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeDefined();
    expect(screen.getByPlaceholderText("seu@email.com")).toBeDefined();
    expect(screen.getByPlaceholderText("Sua senha")).toBeDefined();
    expect(screen.getByText("Esqueci minha senha")).toBeDefined();
    expect(screen.getByRole("button", { name: "Cadastro" })).toBeDefined();
  });

  it("shows validation error when fields are empty", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => {
      expect(screen.getByText("Preencha e-mail e senha.")).toBeDefined();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("calls login on submit and navigates away", async () => {
    mockLogin.mockResolvedValue({});
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
      target: { value: "coord@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Sua senha"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("coord@example.com", "secret123");
    });
  });

  it("shows error message when login fails", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid login credentials"));
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
      target: { value: "coord@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Sua senha"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => {
      expect(screen.getByText("Invalid login credentials")).toBeDefined();
    });
  });

  it("sends password reset when email is provided", async () => {
    mockResetPassword.mockResolvedValue(undefined);
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
      target: { value: "coord@example.com" },
    });
    fireEvent.click(screen.getByText("Esqueci minha senha"));
    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith("coord@example.com");
      expect(screen.getByText(/E-mail de recuperação enviado/)).toBeDefined();
    });
  });

  it("requires email before sending password reset", async () => {
    renderLogin();
    fireEvent.click(screen.getByText("Esqueci minha senha"));
    await waitFor(() => {
      expect(screen.getByText("Informe seu e-mail acima para recuperar a senha.")).toBeDefined();
    });
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("switches to the signup form with name field", () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Cadastro" }));
    expect(screen.getByPlaceholderText("Seu nome")).toBeDefined();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeDefined();
  });

  it("signs up with name, email and password", async () => {
    mockSignUp.mockResolvedValue({ session: null, user: { id: "u-1" } });
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Cadastro" }));
    fireEvent.change(screen.getByPlaceholderText("Seu nome"), {
      target: { value: "Carlos Henrique" },
    });
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
      target: { value: "carlos@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mínimo de 6 caracteres"), {
      target: { value: "secret123" },
    });
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        "carlos@example.com",
        "secret123",
        "Carlos Henrique"
      );
    });
  });

  it("shows notice when signup requires email confirmation", async () => {
    mockSignUp.mockResolvedValue({ session: null, user: { id: "u-1" } });
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Cadastro" }));
    fireEvent.change(screen.getByPlaceholderText("Seu nome"), {
      target: { value: "Carlos" },
    });
    fireEvent.change(screen.getByPlaceholderText("seu@email.com"), {
      target: { value: "carlos@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Mínimo de 6 caracteres"), {
      target: { value: "secret123" },
    });
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => {
      expect(screen.getByText(/Conta criada! Verifique seu e-mail/)).toBeDefined();
    });
  });

  it("validates signup fields", async () => {
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Cadastro" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar conta" }));
    await waitFor(() => {
      expect(screen.getByText("Preencha nome, e-mail e senha.")).toBeDefined();
    });
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("signs in with Google using the ID token from GIS", async () => {
    const gis = setupGoogleGisMock();
    (apiRequest as any).mockResolvedValue({ user: { id: "u-1" } });
    renderLogin();
    await waitFor(() => {
      expect(window.google!.accounts!.id!.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: expect.stringContaining("apps.googleusercontent.com"),
          callback: expect.any(Function),
        })
      );
      expect(window.google!.accounts!.id!.renderButton).toHaveBeenCalled();
    });
    await gis.triggerCallback({ credential: "fake-google-jwt" });
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/auth/google", {
        method: "POST",
        body: { credential: "fake-google-jwt" },
        skipRefresh: true,
      });
    });
  });

  it("shows error when Google ID token sign-in fails", async () => {
    const gis = setupGoogleGisMock();
    (apiRequest as any).mockRejectedValue(new Error("Token inválido"));
    renderLogin();
    await waitFor(() => {
      expect(window.google!.accounts!.id!.initialize).toHaveBeenCalled();
    });
    await gis.triggerCallback({ credential: "bad-jwt" });
    await waitFor(() => {
      (expect(screen.getByRole("alert")) as any).toHaveTextContent("Token inválido");
    });
  });

  it("shows error when GIS returns no credential", async () => {
    const gis = setupGoogleGisMock();
    renderLogin();
    await waitFor(() => {
      expect(window.google!.accounts!.id!.initialize).toHaveBeenCalled();
    });
    await gis.triggerCallback({});
    await waitFor(() => {
      (expect(screen.getByRole("alert")) as any).toHaveTextContent(/Não foi possível concluir o login com Google/);
    });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it("redirects to / when already authenticated", () => {
    (useAuth as any).mockReturnValue({
      user: { id: "u-1" },
      loading: false,
      login: mockLogin,
      signUp: mockSignUp,
      resetPassword: mockResetPassword,
    });
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>
    );
    expect(screen.queryByPlaceholderText("seu@email.com")).toBeNull();
  });
});
