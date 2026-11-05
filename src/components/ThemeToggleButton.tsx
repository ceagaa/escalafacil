import { useTheme } from "../hooks/useTheme";

export default function ThemeToggleButton() {
  const { preference, theme, setPreference } = useTheme();
  const nextPreference = preference === "system"
    ? (theme === "dark" ? "light" : "dark")
    : preference === "dark" ? "light" : "system";
  const nextLabel = nextPreference === "system" ? "automático" : nextPreference === "dark" ? "escuro" : "claro";
  const currentTheme = theme === "dark" ? "escuro" : "claro";
  const currentLabel = preference === "system" ? `${currentTheme}, automático` : currentTheme;

  return (
    <button
      type="button"
      onClick={() => setPreference(nextPreference)}
      className="theme-toggle-button"
      aria-label={`Tema ${currentLabel}. Alterar para ${nextLabel}`}
      title={`Tema ${currentLabel}. Clique para alterar para ${nextLabel}`}
    >
      {theme === "dark" ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.2 15.2A8.4 8.4 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z" />
        </svg>
      )}
    </button>
  );
}
