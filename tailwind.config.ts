import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        dark: "var(--color-dark)",
        text: "var(--color-text)",
        "text-inverse": "var(--color-text-inverse)",
        primary: "var(--color-primary)",
        border: "var(--color-border)",
        muted: "var(--color-muted)",
      },
      fontFamily: {
        raleway: ["var(--font-title)", "Raleway", "sans-serif"],
        inter: ["var(--font-body)", "Inter", "sans-serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        strong: "var(--shadow-strong)",
      },
    },
  },
  plugins: [],
} satisfies Config;
