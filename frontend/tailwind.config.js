const defaultTheme = require("tailwindcss/defaultTheme")

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        './pages/**/*.{ts,tsx}',
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
    ],
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
                sans: ["Montserrat", ...defaultTheme.fontFamily.sans],
                display: ["Space Grotesk", "Montserrat", ...defaultTheme.fontFamily.sans],
                tech: ["Rajdhani", "Montserrat", ...defaultTheme.fontFamily.sans],
                mono: ["JetBrains Mono", "Space Mono", ...defaultTheme.fontFamily.mono],
                // Fase 6 system (see src/styles/kx.css): editorial hero numbers, UI text, technical data
                editorial: ["Fraunces", "Georgia", ...defaultTheme.fontFamily.serif],
                ui: ["Inter", ...defaultTheme.fontFamily.sans],
                plex: ["IBM Plex Mono", ...defaultTheme.fontFamily.mono],
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
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
                // Fase 6 tokens — values live as CSS variables in src/styles/kx.css (dark-first)
                kx: {
                    bg: "var(--kx-bg)",
                    surface: "var(--kx-surface)",
                    raised: "var(--kx-raised)",
                    line: "var(--kx-line)",
                    ink: "var(--kx-ink)",
                    ink2: "var(--kx-ink-2)",
                    ink3: "var(--kx-ink-3)",
                    amber: "var(--kx-amber)",
                    "amber-soft": "var(--kx-amber-soft)",
                    debt: "var(--kx-debt)",
                    almost: "var(--kx-almost)",
                    paid: "var(--kx-paid)",
                    warm: "var(--kx-warm)",
                    pay: "var(--kx-pay)",
                },
                // KoreX Brand Colors
                neutral: {
                    deep: '#000000',
                    tech: '#4A4A4A',
                    pure: '#FFFFFF',
                },
                // Ignition — ancla de energía (CTAs, estados activos, progreso de ataque)
                ignition: {
                    DEFAULT: '#FF5B3D',
                    hover: '#FF7256',
                    soft: 'rgba(255, 91, 61, 0.10)',
                    ink: '#1A0805',
                },
                // Gold — SOLO milestones/ranks/tier Freedom (máx. 1 por pantalla)
                gold: {
                    400: '#F5B942',
                    500: '#D4A017',
                    600: '#b8890f',
                },
                // Semantic financial colors (per neuro-design)
                emerald: {
                    400: '#34d399',
                    500: '#10b981',
                    600: '#059669',
                },
                // ═══ Fase 2 · MD-1: Unified semantic palette ═══
                // Regla de diseño: máximo 1 color semántico por card/widget.
                // SUCCESS — positivo, cash, ahorro
                success: { DEFAULT: '#10b981', soft: 'rgba(16, 185, 129, 0.10)' },
                // DANGER — deuda, error, alerta real
                danger: { DEFAULT: '#f43f5e', soft: 'rgba(244, 63, 94, 0.10)' },
                // WARNING — atención, no urgente
                warning: { DEFAULT: '#f59e0b', soft: 'rgba(245, 158, 11, 0.10)' },
                // PREMIUM — milestones, VIP, ranks (alias ceremonial de gold)
                premium: { DEFAULT: '#D4A017', soft: 'rgba(212, 160, 23, 0.10)' },
                // INFO — tips, ayuda, info neutral
                info: { DEFAULT: '#3b82f6', soft: 'rgba(59, 130, 246, 0.10)' },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: 0 },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: 0 },
                },
                "pulse-glow": {
                    "0%, 100%": { opacity: 1, boxShadow: "0 0 10px rgba(255, 255, 255, 0.1)" },
                    "50%": { opacity: 0.8, boxShadow: "0 0 20px rgba(255, 255, 255, 0.25)" },
                },
                "float": {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-5px)" },
                }
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "pulse-glow": "pulse-glow 2s infinite",
                "float": "float 3s ease-in-out infinite",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
}
