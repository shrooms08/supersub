import type { Config } from "tailwindcss";

// Canonical tokens from docs/design/SuperSub.dc.html. Dark base, ONE volt
// accent (#c8ff00) reserved for: the CTA, the win-prob line/area, hero
// numerals, rank/row highlights, earned-badge glow, MIRACLE tier tags, and
// the LIVE beacon. Everything else is the grayscale ramp on #070708.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#070708",
          900: "#0a0a0c",
          850: "#101013",
          800: "#141418",
          700: "#1a1a1f",
          600: "#26262c",
          500: "#3a3a42",
        },
        chalk: {
          50: "#f4f4f5",
          100: "#e4e4e7",
          300: "#d4d4d8",
          400: "#a1a1aa",
          500: "#71717a",
          600: "#52525b",
        },
        volt: {
          DEFAULT: "#c8ff00",
          bright: "#e4ff6b",
          dim: "#9ec400",
        },
        card: {
          yellow: "#e9e26a",
          yellowBg: "#3a3a20",
          red: "#dc2626",
        },
        paper: {
          DEFAULT: "#f2ede1",
          deep: "#e6dfcd",
          ink: "#141210",
          faded: "#3a352c",
        },
      },
      fontFamily: {
        display: ["var(--font-saira)", "Arial Narrow", "ui-sans-serif", "sans-serif"],
        label: ["var(--font-archivo)", "ui-sans-serif", "system-ui", "sans-serif"],
        slab: ["var(--font-zilla)", "Georgia", "serif"],
        masthead: ["var(--font-pirata)", "Georgia", "serif"],
      },
      keyframes: {
        // Ported verbatim from the reference file.
        livePulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".35", transform: "scale(.7)" },
        },
        ctaPulse: {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(200,255,0,.45), 0 10px 30px -6px rgba(200,255,0,.5)",
          },
          "50%": {
            boxShadow: "0 0 0 14px rgba(200,255,0,0), 0 10px 40px -4px rgba(200,255,0,.7)",
          },
        },
        curveDraw: {
          from: { strokeDashoffset: "1400" },
          to: { strokeDashoffset: "0" },
        },
        slamIn: {
          "0%": { opacity: "0", transform: "scale(1.8) rotate(-6deg)" },
          "70%": { opacity: "1", transform: "scale(.92) rotate(1deg)" },
          "100%": { transform: "scale(1) rotate(0)" },
        },
        ripBack: {
          "0%": { transform: "translateY(0) rotate(0)", opacity: "1" },
          "30%": { transform: "translateY(-4px) rotate(-1deg)" },
          "100%": { transform: "translateY(120px) rotate(7deg)", opacity: "0" },
        },
        markerDrop: {
          from: { opacity: "0", transform: "translateY(-14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        glowBreath: {
          "0%, 100%": { boxShadow: "0 0 24px -6px rgba(200,255,0,.5)" },
          "50%": { boxShadow: "0 0 40px 0 rgba(200,255,0,.85)" },
        },
        sheen: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
        revealUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // App-local (not in the reference): the one-shot ticker wash and
        // the VAR takeover, recolored to the canonical volt.
        pulseOnce: {
          "0%": { backgroundColor: "rgba(200, 255, 0, 0.16)" },
          "100%": { backgroundColor: "transparent" },
        },
        varFlash: {
          "0%": { opacity: "0", transform: "translateY(6px) scale(0.98)" },
          "12%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "85%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "live-pulse": "livePulse 1.4s infinite",
        "cta-pulse": "ctaPulse 1.6s ease-in-out infinite",
        "curve-draw": "curveDraw 1.8s ease-out 1 both",
        "slam-in": "slamIn 0.5s cubic-bezier(0.22, 1.4, 0.36, 1) 1 both",
        "rip-back": "ripBack 0.9s ease-in 1",
        "marker-drop": "markerDrop 0.5s ease-out 1 both",
        "glow-breath": "glowBreath 2.6s ease-in-out infinite",
        "glow-breath-slow": "glowBreath 3s ease-in-out infinite",
        sheen: "sheen 2.6s linear infinite",
        "reveal-up": "revealUp 0.5s ease-out 1 both",
        "pulse-once": "pulseOnce 1.4s ease-out 1",
        "var-flash": "varFlash 5s ease-out 1 forwards",
      },
    },
  },
  plugins: [],
};

export default config;
