import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        // shadcn/ui CSS-variable mapped colors
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        // Brand
        accent: {
          DEFAULT: "#5B5FEF",
          hover: "#4B4FE0",
          foreground: "hsl(var(--accent-foreground))",
        },
        // Department colors
        dept: {
          dev: "#5B5FEF",
          design: "#EC6A52",
          marketing: "#1EAE7C",
          general: "#9AA1AE",
        },
        // Priority colors
        priority: {
          low: "#5B6270",
          medium: "#C79A3D",
          high: "#D9713C",
          urgent: "#D1495B",
        },
        // Theming Surfaces & Text
        surface: {
          base: "hsl(var(--surface-base))",
          elevated: "hsl(var(--surface-elevated))",
          border: "hsl(var(--surface-border))",
          hover: "hsl(var(--surface-hover))",
        },
        text: {
          primary: "hsl(var(--text-primary))",
          secondary: "hsl(var(--text-secondary))",
        },
      },

      boxShadow: {
        // Crisp, low elevation (Linear / Attio style). Shadows describe layering, not decoration.
        sm: "0 1px 2px hsl(240 10% 4% / 0.05)",
        DEFAULT: "0 1px 2px hsl(240 10% 4% / 0.06), 0 1px 1px hsl(240 10% 4% / 0.03)",
        md: "0 4px 10px -3px hsl(240 10% 4% / 0.10), 0 2px 4px -2px hsl(240 10% 4% / 0.05)",
        lg: "0 12px 24px -8px hsl(240 10% 4% / 0.16), 0 4px 8px -4px hsl(240 10% 4% / 0.06)",
        xl: "0 20px 40px -12px hsl(240 10% 4% / 0.24), 0 6px 12px -6px hsl(240 10% 4% / 0.08)",
        "2xl": "0 28px 64px -16px hsl(240 10% 4% / 0.34)",
        card: "0 1px 1px hsl(240 10% 4% / 0.03)",
        pop: "0 0 0 1px hsl(var(--surface-border)), 0 12px 32px -8px hsl(240 10% 4% / 0.22), 0 4px 8px -4px hsl(240 10% 4% / 0.08)",
        ring: "0 0 0 3px hsl(var(--primary) / 0.14)",
        // Pressable highlight for filled buttons.
        btn: "inset 0 1px 0 hsl(0 0% 100% / 0.16), 0 1px 2px hsl(240 10% 4% / 0.16)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "slide-in-from-right": {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "slide-in-right": "slide-in-from-right 0.25s ease-out",
        "fade-in": "fade-in 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography")
  ],
};

export default config;
