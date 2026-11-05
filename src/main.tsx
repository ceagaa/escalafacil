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
