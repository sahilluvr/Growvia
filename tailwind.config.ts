import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0B0D0C",
          900: "#0B0D0C",
          800: "#141716",
          700: "#1D211F",
          600: "#2A2F2C",
        },
        paper: "#F7F7F3",
        mist: "#EFEFEA",
        line: "#E4E4DE",
        stone: {
          400: "#9A9E98",
          500: "#6E736D",
          600: "#4F534E",
        },
        lime: {
          DEFAULT: "#C5F23A",
          300: "#DDF98A",
          400: "#C5F23A",
          500: "#A8DA16",
          700: "#4E7A06",
          800: "#3A5C05",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: { tightest: "-0.045em" },
      boxShadow: {
        card: "0 1px 0 rgba(11,13,12,0.04), 0 1px 2px rgba(11,13,12,0.06), 0 8px 24px -12px rgba(11,13,12,0.12)",
        frame: "0 0 0 1px rgba(11,13,12,0.06), 0 30px 80px -30px rgba(11,13,12,0.35), 0 12px 24px -12px rgba(11,13,12,0.18)",
        glow: "0 0 0 1px rgba(197,242,58,0.35), 0 10px 40px -10px rgba(197,242,58,0.55)",
      },
      keyframes: {
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        feedIn: {
          from: { opacity: "0", transform: "translateY(-8px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        pulseDot: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(197,242,58,0.6)" },
          "50%": { boxShadow: "0 0 0 6px rgba(197,242,58,0)" },
        },
        draw: { from: { strokeDashoffset: "1" }, to: { strokeDashoffset: "0" } },
      },
      animation: {
        marquee: "marquee 40s linear infinite",
        feedIn: "feedIn 0.5s cubic-bezier(0.2,0.8,0.2,1) both",
        pulseDot: "pulseDot 2s ease-in-out infinite",
        draw: "draw 2.2s cubic-bezier(0.6,0,0.2,1) forwards",
      },
    },
  },
  plugins: [],
};
export default config;
