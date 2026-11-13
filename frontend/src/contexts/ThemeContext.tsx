import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// ─── Types ──────────────────────────────────────────────────────────
type Theme = "dark" | "light";

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(() => {
        const stored = localStorage.getItem("korex-theme");
        return (stored === "light" ? "light" : "dark") as Theme;
    });

    // Sync the `dark` class on <html> for Tailwind's darkMode: ["class"]
    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, [theme]);

    const setTheme = (t: Theme) => {
        setThemeState(t);
        localStorage.setItem("korex-theme", t);
    };

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === "dark" }}>
            {children}
        </ThemeContext.Provider>
    );
}

// ─── Hook ───────────────────────────────────────────────────────────
/** true unless the light theme is on; safe outside the provider (dark is the default). */
export function useIsDark(): boolean {
    const ctx = useContext(ThemeContext);
    return ctx ? ctx.isDark : true;
}

export function useTheme(): ThemeContextType {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
    return ctx;
}
