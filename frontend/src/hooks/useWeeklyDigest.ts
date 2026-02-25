import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Weekly Progress Digest — Shows a toast the first time the user
 * logs in during a new week, summarizing last week's achievements.
 */

interface WeeklyDigestData {
    /** Whether to show the digest now */
    shouldShow: boolean;
    /** The digest message */
    message: string;
    /** Dismiss the digest */
    dismiss: () => void;
}

const STORAGE_KEY = 'korex_weekly_digest';

function getWeekKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const week = Math.ceil(((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
    return `${year}-W${week}`;
}

export function useWeeklyDigest(interestSaved?: number): WeeklyDigestData {
    const { language } = useLanguage();
    const [shouldShow, setShouldShow] = useState(false);

    useEffect(() => {
        const weekKey = getWeekKey();
        const lastShown = localStorage.getItem(STORAGE_KEY);

        if (lastShown !== weekKey) {
            // It's a new week — trigger digest after a short delay
            const timer = setTimeout(() => setShouldShow(true), 5_000);
            return () => clearTimeout(timer);
        }
    }, []);

    const dismiss = () => {
        setShouldShow(false);
        localStorage.setItem(STORAGE_KEY, getWeekKey());
    };

    const saved = interestSaved ? `$${interestSaved.toFixed(2)}` : '$0.00';
    const message = language === 'es'
        ? `📊 Resumen semanal: Ahorraste ~${saved} en intereses esta semana. ¡Sigue así, Comandante!`
        : `📊 Weekly recap: You saved ~${saved} in interest this week. Keep it up, Commander!`;

    return { shouldShow, message, dismiss };
}
