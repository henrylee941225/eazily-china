import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        display: ["Hanken Grotesk", "system-ui", "sans-serif"],
        body: ["Hanken Grotesk", "system-ui", "sans-serif"],
        cn: ["Hanken Grotesk", "system-ui", "sans-serif"],
        serif: ["Hanken Grotesk", "system-ui", "sans-serif"],
        sans: ["Hanken Grotesk", "system-ui", "sans-serif"],
      },
      colors: {
        border: {
          DEFAULT: "hsl(var(--border))",
          strong: "hsl(var(--hairline))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        surface: "hsl(var(--surface))",
        "surface-2": "hsl(var(--surface-2))",
        "surface-3": "hsl(var(--surface-3))",
        "surface-elevated": "hsl(var(--surface))",
        hairline: "hsl(var(--hairline))",
        foreground: "hsl(var(--foreground))",
        ink: {
          DEFAULT: "hsl(var(--ink))",
          soft: "hsl(var(--ink-soft))",
          secondary: "hsl(var(--text-secondary))",
          tertiary: "hsl(var(--text-tertiary))",
        },
        cream: "hsl(var(--cream))",
        vermilion: {
          DEFAULT: "hsl(var(--vermilion))",
          deep: "hsl(var(--vermilion-deep))",
          glow: "hsl(var(--vermilion-glow))",
        },
        brand: {
          red: "hsl(var(--brand-red))",
          orange: "hsl(var(--brand-orange))",
        },
        "tint-warm": "hsl(var(--tint-warm))",
        success: {
          DEFAULT: "hsl(var(--success))",
          tint: "hsl(var(--success-tint))",
        },
        pending: {
          DEFAULT: "hsl(var(--pending))",
          tint: "hsl(var(--pending-tint))",
        },
        error: {
          DEFAULT: "hsl(var(--error))",
          tint: "hsl(var(--error-tint))",
        },
        online: "hsl(var(--online))",
        gold: "hsl(var(--gold))",
        jade: "hsl(var(--jade))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--surface-2))",
          hover: "hsl(240 5% 12%)",
        },
        category: {
          food: "#E63946",
          hotels: "#C9617A",
          attractions: "#D4A33E",
          transport: "#3A6B7D",
          shopping: "#7B5B8E",
          generic: "#1A1A1A",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "gradient-vermilion": "var(--gradient-vermilion)",
        "gradient-ink": "var(--gradient-ink)",
        "gradient-cream": "var(--gradient-cream)",
        "gradient-glow": "var(--gradient-glow)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
