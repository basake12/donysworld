import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        gold: {
          DEFAULT: "hsl(var(--gold))",
          light:   "hsl(var(--gold-light))",
          dark:    "hsl(var(--gold-dark))",
          muted:   "hsl(var(--gold-muted))",
          subtle:  "hsl(var(--gold-subtle))",
        },
      },
      fontFamily: {
        sans:    ["var(--font-inter)", "Inter", "sans-serif"],
        serif:   ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
        display: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
      },
      borderRadius: {
        lg:  "var(--radius)",
        md:  "calc(var(--radius) - 2px)",
        sm:  "calc(var(--radius) - 4px)",
        xl:  "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, hsl(45,75%,60%) 0%, hsl(43,65%,50%) 50%, hsl(38,58%,40%) 100%)",
        "dark-gradient": "linear-gradient(135deg, hsl(0,0%,8%) 0%, hsl(0,0%,5%) 100%)",
        "hero-gradient": "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(43 62% 52% / 0.15) 0%, transparent 70%)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":        "fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up":       "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        shimmer:          "shimmer 1.8s infinite",
      },
      boxShadow: {
        gold:    "0 0 24px hsl(43 62% 52% / 0.35), 0 0 48px hsl(43 62% 52% / 0.12)",
        "gold-sm": "0 0 12px hsl(43 62% 52% / 0.25)",
        "card-hover": "0 20px 40px -12px hsl(0 0% 0% / 0.4)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;