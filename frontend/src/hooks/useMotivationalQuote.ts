import { useState, useEffect } from 'react';

/**
 * Micro-Affirmation Rotation System
 * Skill: neuroventa §6 — "Micro-afirmaciones rotativas"
 * 
 * Returns a different motivational quote each session.
 * Uses localStorage to track index so quotes don't repeat
 * until the full pool has been shown.
 */

interface Quote {
    en: string;
    es: string;
}

const QUOTES: Quote[] = [
    { en: "Your debt doesn't define you. Your STRATEGY does.", es: "Tu deuda no te define. Tu ESTRATEGIA sí." },
    { en: "Every dollar you redirect is a dollar that fights FOR you.", es: "Cada dólar que rediriges es un dólar que pelea POR ti." },
    { en: "The average person ignores their debt. You're not average.", es: "La persona promedio ignora su deuda. Tú no eres promedio." },
    { en: "Wealthy people don't avoid numbers. They COMMAND them.", es: "La gente rica no evita los números. Los COMANDA." },
    { en: "Speed is the difference between freedom in 10 years... or 2.", es: "La velocidad es la diferencia entre libertad en 10 años... o en 2." },
    { en: "You're not just paying bills. You're building an EMPIRE.", es: "No solo estás pagando cuentas. Estás construyendo un IMPERIO." },
    { en: "The future you will thank the you who started TODAY.", es: "El tú del futuro agradecerá al tú que empezó HOY." },
    { en: "Financial intelligence isn't a gift. It's a DECISION. You made it.", es: "La inteligencia financiera no es un don. Es una DECISIÓN. Tú la tomaste." },
    { en: "Every attack payment is a brick in your fortress of freedom.", es: "Cada pago de ataque es un ladrillo en tu fortaleza de libertad." },
    { en: "The system was designed to keep you in debt. You chose to fight BACK.", es: "El sistema fue diseñado para mantenerte endeudado. Tú decidiste CONTRAATACAR." },
];

const STORAGE_KEY = 'corex_quote_index';

export function useMotivationalQuote(language: 'en' | 'es'): string {
    const [quote, setQuote] = useState('');

    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        let idx = stored ? parseInt(stored, 10) : 0;
        // Wrap around if we've shown all quotes
        if (idx >= QUOTES.length) idx = 0;

        setQuote(QUOTES[idx][language]);

        // Advance index for next session
        localStorage.setItem(STORAGE_KEY, String(idx + 1));
    }, [language]);

    return quote;
}
