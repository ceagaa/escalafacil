/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf3",
          100: "#d6f5e3",
          200: "#b0eacc",
          300: "#7dd9ae",
          400: "#42d27b",
          500: "#2a9d5c",
          600: "#1f7a44",
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
        card: "20px",
        modal: "24px",
        input: "16px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0, 0, 0, 0.06)",
        "card-hover": "0 4px 12px rgba(0, 0, 0, 0.08)",
        modal: "0 20px 60px rgba(0, 0, 0, 0.15)",
        toast: "0 8px 30px rgba(0, 0, 0, 0.12)",
        nav: "0 14px 38px rgba(15, 23, 42, 0.18)",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
    },
  },
  plugins: [],
}
