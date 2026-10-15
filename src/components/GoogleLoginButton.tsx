import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabase";

const GOOGLE_CLIENT_ID = "1054965527933-fbsln30sap4nq2d80rs50gatikpc1tlf.apps.googleusercontent.com";
const GIS_SCRIPT_ID = "google-gsi-client";
const GIS_SRC = "https://accounts.google.com/gsi/client";

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};

type GoogleIdConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
};

type GoogleRenderButtonOptions = {
  theme?: "outline" | "filled_black" | "filled_blue";
  size?: "large" | "medium" | "small";
  shape?: "rectangular" | "pill" | "circle";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  width?: number;
};

type GoogleAccountsId = {
  initialize: (config: GoogleIdConfiguration) => void;
  renderButton: (parent: HTMLElement, options: GoogleRenderButtonOptions) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

function loadGoogleIdentityServices(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existing = document.getElementById(GIS_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Falha ao carregar o Google Sign-In.")));
      return;
    }

    const script = document.createElement("script");
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o Google Sign-In."));
    document.head.appendChild(script);
  });
}

type GoogleLoginButtonProps = {
  disabled?: boolean;
};

export default function GoogleLoginButton({ disabled = false }: GoogleLoginButtonProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function initializeGoogleLogin() {
      try {
        await loadGoogleIdentityServices();
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            setError("");
            const idToken = response?.credential;
            if (!idToken) {
              setError("Não foi possível concluir o login com Google. Tente novamente.");
              return;
            }

            const { error: tokenError } = await supabase.auth.signInWithIdToken({
              provider: "google",
              token: idToken,
            });

            if (tokenError) {
              console.error("Erro no login com Google:", tokenError?.message);
              setError(tokenError?.message || "Falha ao autenticar com Google.");
              return;
            }

            navigate("/", { replace: true });
          },
        });

        const width = Math.min(Math.max(containerRef.current.offsetWidth, 280), 400);
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          width,
        });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.error("Erro ao carregar o Google Sign-In:", err);
        setError(err instanceof Error ? err.message : "Falha ao carregar o Google Sign-In.");
        setLoading(false);
      }
    }

    initializeGoogleLogin();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="mt-6">
      {loading && (
        <div
          className="h-10 w-full animate-pulse rounded-full border border-slate-200 bg-slate-50"
          aria-hidden="true"
        />
      )}
      <div
        ref={containerRef}
        className={`flex justify-center ${disabled ? "pointer-events-none opacity-50" : ""}`}
      />
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  );
}
