/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fbf1f0",
          100: "#f5dada",
          200: "#e7aeac",
          300: "#d3817e",
          400: "#A43D3B",
          500: "#873230",
          600: "#702725",
          700: "#591f1e",
          800: "#421718",
          900: "#2c1011",
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
          800: "#172233",
          900: "#0f1720",
        },
        surface: {
          0: "#ffffff",
          50: "#f6f6f6",
          100: "#f0f0f0",
          200: "#e4e4e7",
          300: "#d4d4d8",
        },
        lime: {
          400: "#d8ff56",
        },
        whatsapp: {
          DEFAULT: "#25d366",
          dark: "#128c4a",
        },
        day: {
          friday: "#d65a00",
          saturday: "#345c3f",
          sunday: "#0a5883",
        },
      },
      fontFamily: {
        sans: ["Poppins", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      borderRadius: {
        // espelha --ef-r-* do src/index.css
        card: "20px",
        modal: "24px",
        input: "14px",
        tile: "14px",
        pill: "999px",
      },
      boxShadow: {
        // espelha --ef-shadow-* do src/index.css
        card: "0 1px 2px rgba(16, 24, 40, 0.05)",
        "card-hover": "0 6px 16px rgba(16, 24, 40, 0.10)",
        modal: "0 24px 56px rgba(16, 24, 40, 0.18)",
        toast: "0 8px 30px rgba(16, 24, 40, 0.14)",
        nav: "0 8px 24px rgba(16, 24, 40, 0.12)",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
    },
  },
  plugins: [],
}
