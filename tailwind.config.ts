import type { Config } from "tailwindcss";

// Design system: dark base, one volt accent, everything else grayscale.
// The volt family is reserved for the CTA, the win probability line, and
// hero numbers. Do not use it for anything else.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#070708",
          900: "#0b0b0d",
          850: "#101013",
          800: "#141418",
          700: "#1b1b20",
          600: "#26262c",
          500: "#3a3a42",
        },
        chalk: {
          50: "#f5f5f2",
          100: "#e8e8e4",
          300: "#b3b3ad",
          400: "#8b8b85",
          500: "#6e6e68",
          600: "#52524d",
        },
        volt: {
          DEFAULT: "#d6ff3f",
          bright: "#e4ff66",
          dim: "#9dbf1f",
        },
        card: {
          yellow: "#eab308",
          red: "#dc2626",
        },
      },
      fontFamily: {
        display: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Helvetica Neue",
          "Arial Narrow",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      keyframes: {
        pulseOnce: {
          "0%": { backgroundColor: "rgba(214, 255, 63, 0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        ctaPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(214, 255, 63, 0.45)" },
          "50%": { boxShadow: "0 0 0 12px rgba(214, 255, 63, 0)" },
        },
        varFlash: {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.98)" },
          "12%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "85%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        liveDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
      animation: {
        "pulse-once": "pulseOnce 1.4s ease-out 1",
        "cta-pulse": "ctaPulse 1.6s ease-in-out infinite",
        "var-flash": "varFlash 5s ease-out 1 forwards",
        "live-dot": "liveDot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
