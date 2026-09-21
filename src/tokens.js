/**
 * EscalaFácil Design System Tokens
 *
 * Paleta, tipografia, espaçamento e princípios de design.
 * Todas as cores do app devem usar estes tokens via Tailwind classes.
 *
 * Exemplo: bg-navy-800, text-brand-400, rounded-card
 */

export const DESIGN_TOKENS = {
  colors: {
    brand: {
      50: "#eefbf3",
      100: "#d6f5e3",
      200: "#b0eacc",
      300: "#7dd9ae",
      400: "#42d27b", // Primary accent
      500: "#2a9d5c", // Secondary accent
      600: "#1f7a44", // Hover secondary
      700: "#1a6237",
      800: "#174e2e",
      900: "#134127",
    },
    navy: {
      50: "#f0f3f7",
      100: "#d9e0eb",
      200: "#b3c1d6",
      300: "#8da2c2",
      400: "#6683ad",
      500: "#406499",
      600: "#2d4a7a",
      700: "#1e3358",
      800: "#172233", // Primary dark
      900: "#0f1720",
    },
    surface: {
      0: "#ffffff",
      50: "#f6f6f6", // Page background
      100: "#f0f0f0",
      200: "#e4e4e7",
      300: "#d4d4d8",
    },
  },

  typography: {
    family: "Poppins, system-ui, -apple-system, sans-serif",
    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    scale: {
      "2xs": "0.625rem",   // 10px - badges only
      xs: "0.75rem",       // 12px - meta labels
      sm: "0.875rem",      // 14px - body text, buttons
      base: "1rem",        // 16px - inputs, emphasis
      lg: "1.125rem",      // 18px - section headings
      xl: "1.25rem",       // 20px - page titles
      "2xl": "1.5rem",     // 24px - stat values
      "3xl": "1.875rem",   // 30px - hero numbers
    },
  },

  spacing: {
    section: "1.5rem",     // space-y-6
    card: "1.25rem",       // p-5
    "card-lg": "1.5rem",   // p-6
    input: "0.75rem 1rem", // px-4 py-3
    button: "1rem 2rem",   // px-8 py-4
  },

  radii: {
    card: "20px",
    modal: "24px",
    input: "16px",
    pill: "999px",
  },
} as const;

/**
 * Princípios de Design
 *
 * 1. Consistência visual: usar tokens em vez de valores arbitrários
 * 2. Hierarquia: navegação > conteúdo > detalhes
 * 3. Acessibilidade: contraste 4.5:1 mínimo, focus rings visíveis
 * 4. Mobile-first: projetar para 360px primeiro
 * 5. Clareza: cada elemento tem um único propósito
 */
