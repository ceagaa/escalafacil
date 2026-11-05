import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../context/ThemeContext";
import { useTheme } from "../hooks/useTheme";

function ThemeProbe() {
  const { preference, theme, setPreference } = useTheme();
  return (
    <div>
      <p>{`${preference}:${theme}`}</p>
      <button type="button" onClick={() => setPreference("light")}>Use light</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
  });

  it("uses the browser color preference when no choice is saved", () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByText("system:dark")).toBeDefined();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("persists a manually selected theme", () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Use light" }));
    expect(screen.getByText("light:light")).toBeDefined();
    expect(localStorage.getItem("escalafacil_theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("tracks browser theme changes while automatic mode is selected", () => {
    let systemIsDark = false;
    let handleChange: ((event: MediaQueryListEvent) => void) | undefined;
    const mediaQuery = {
      get matches() { return systemIsDark; },
      addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => {
        handleChange = listener;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByText("system:light")).toBeDefined();

    act(() => {
      systemIsDark = true;
      handleChange?.({ matches: true } as MediaQueryListEvent);
    });

    expect(screen.getByText("system:dark")).toBeDefined();
  });
});
