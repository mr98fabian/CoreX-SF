import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Session Timer — Tracks how long the user has been on the dashboard.
 * Displays motivational messages tied to session time.
 */

interface SessionTimerData {
    /** Total minutes elapsed */
    minutes: number;
    /** Formatted display string: "8 min" */
    display: string;
    /** Motivational message for the current session length */
    message: string;
}

const MESSAGES_ES: [number, string][] = [
    [1, 'Cada minuto cuenta 💡'],
    [5, 'Llevas {m} min optimizando tus finanzas 💪'],
    [10, '{m} min enfocado — eso es disciplina 🔥'],
    [20, '{m} min — estás construyendo riqueza real ⚡'],
    [30, 'Media hora de estrategia financiera. Eso es de élite 🏆'],
    [60, '¡1 hora! Pocos tienen esta disciplina. Tú sí 👑'],
];

const MESSAGES_EN: [number, string][] = [
    [1, 'Every minute counts 💡'],
    [5, '{m} min optimizing your finances 💪'],
    [10, '{m} min focused — that\'s discipline 🔥'],
    [20, '{m} min — you\'re building real wealth ⚡'],
    [30, 'Half hour of financial strategy. That\'s elite 🏆'],
    [60, '1 hour! Few have this discipline. You do 👑'],
];

export function useSessionTimer(): SessionTimerData {
    const { language } = useLanguage();
    const [minutes, setMinutes] = useState(0);

    useEffect(() => {
        const start = Date.now();
        const interval = setInterval(() => {
            setMinutes(Math.floor((Date.now() - start) / 60_000));
        }, 30_000); // Update every 30 seconds

        return () => clearInterval(interval);
    }, []);

    const messages = language === 'es' ? MESSAGES_ES : MESSAGES_EN;
    let message = messages[0][1];
    for (const [threshold, msg] of messages) {
        if (minutes >= threshold) {
            message = msg.replace('{m}', String(minutes));
        }
    }

    return {
        minutes,
        display: `${minutes} min`,
        message,
    };
}
