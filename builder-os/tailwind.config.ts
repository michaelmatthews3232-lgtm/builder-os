import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#07090f",
          card: "#0c0f18",
          elevated: "#12162280",
          hover: "#161b26",
        },
        accent: {
          DEFAULT: "#00d4a0",
          dim: "rgba(0,212,160,0.12)",
          glow: "rgba(0,212,160,0.25)",
        },
        border: "rgba(255,255,255,0.07)",
        text: {
          primary: "#e4e8f0",
          secondary: "#7a8699",
          muted: "#3d4a5c",
        },
        status: {
          idea: "#4b5563",
          planned: "#2563eb",
          building: "#d97706",
          monetizing: "#059669",
          scaling: "#7c3aed",
          archived: "#1f2937",
        },
      },
      fontFamily: {
        sans: ["Sora", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        lg: "10px",
        md: "7px",
        sm: "4px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
        "card-hover": "0 4px 16px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.09)",
        accent: "0 0 20px rgba(0,212,160,0.2)",
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-sm": "32px 32px",
      },
    },
  },
  plugins: [],
};

export default config;
