import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./assets/css/uicons.css";
import App from "./App";
import { EventProvider } from "./context/EventContext";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Elemento #root não encontrado.");
}

// PWA (autoUpdate): quando um novo Service Worker assume o controle de uma
// página já carregada, recarrega para servir o bundle novo — evita que o
// usuário fique preso a uma versão antiga em cache (ex.: botão de senha).
if ("serviceWorker" in navigator) {
  const wasControlled = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!wasControlled || refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <EventProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </EventProvider>
    </ThemeProvider>
  </StrictMode>
);
