/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Playful "neon arcade" palette: deep violet ink, vivid purple, hot pink, plus sun / mint / sky / coral extras.
        navy: { 950: "#180a38", 900: "#25104f", 800: "#34186f", 700: "#583e99" },
        indigo: { 50: "#f5f0ff", 100: "#ebe0ff", 200: "#d8c4ff", 300: "#bf9bff", 400: "#a374fb", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6428d4", 800: "#5321ae", 900: "#431c8a" },
        cyan: { 50: "#fff0f8", 100: "#ffe0f1", 200: "#ffc2e3", 300: "#ff94cd", 400: "#ff6bb5", 500: "#db2777", 600: "#be1a65", 700: "#9f1455" },
        sun: { 300: "#ffd95a", 400: "#ffc933", 500: "#f5a800" },
        mint: { 300: "#6ee7c3", 400: "#2dd4a8", 500: "#0fae85", 600: "#0b8a69" },
        sky: { 300: "#7dd3fc", 400: "#38bdf8", 500: "#1d8fd6" },
        coral: { 400: "#ff8a5c", 500: "#f2622f" },
        mist: { 50: "#faf7ff", 100: "#f3edff", 200: "#e6dcfb", 300: "#cdbdf0" },
      },
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "sans-serif"] },
      keyframes: {
        floaty: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-8px)" } },
        wiggle: { "0%,100%": { transform: "rotate(-4deg)" }, "50%": { transform: "rotate(4deg)" } },
        blob: { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(20px,-24px) scale(1.12)" } },
        pop: { "0%": { transform: "scale(.9)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: { wiggle: "wiggle 3s ease-in-out infinite", blob: "blob 12s ease-in-out infinite", floaty: "floaty 6s ease-in-out infinite", pop: "pop .25s ease-out" },
    },
  },
  plugins: [],
};
