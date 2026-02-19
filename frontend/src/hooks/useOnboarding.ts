import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface OnboardingState {
    /** Whether the user has completed onboarding (DB-backed) */
    hasCompleted: boolean;
    /** True while fetching the initial state from the API */
    isLoading: boolean;
    /** Current wizard step (0-5) */
    currentStep: number;
    /** Items added during the wizard per category */
    addedCounts: { income: number; expenses: number; assets: number; debts: number };
    /** Navigation */
    next: () => void;
    back: () => void;
    /** Mark onboarding as complete in DB */
    complete: () => Promise<void>;
    /** Reset onboarding (re-show wizard) */
    restart: () => Promise<void>;
    /** Track items added in each step */
    incrementCount: (category: 'income' | 'expenses' | 'assets' | 'debts') => void;
}

export function useOnboarding(): OnboardingState {
    const [hasCompleted, setHasCompleted] = useState(true); // Default true to avoid flash
    const [isLoading, setIsLoading] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [addedCounts, setAddedCounts] = useState({
        income: 0,
        expenses: 0,
        assets: 0,
        debts: 0,
    });

    // Fetch onboarding status from API on mount
    useEffect(() => {
        let cancelled = false;
        const fetchStatus = async () => {
            try {
                const data = await apiFetch<{ onboarding_complete: boolean }>('/api/settings');
                if (!cancelled) {
                    setHasCompleted(data.onboarding_complete);
                }
            } catch {
                // If API fails (e.g., no auth), default to completed to avoid blocking
                if (!cancelled) setHasCompleted(true);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        fetchStatus();
        return () => { cancelled = true; };
    }, []);

    const next = useCallback(() => {
        setCurrentStep(prev => Math.min(prev + 1, 5));
    }, []);

    const back = useCallback(() => {
        setCurrentStep(prev => Math.max(prev - 1, 0));
    }, []);

    const complete = useCallback(async () => {
        try {
            await apiFetch('/api/settings', {
                method: 'PATCH',
                body: JSON.stringify({ onboarding_complete: true }),
            });
            setHasCompleted(true);
        } catch (err) {
            console.error('Failed to mark onboarding complete:', err);
            // Still close the wizard so user isn't stuck
            setHasCompleted(true);
        }
    }, []);

    const restart = useCallback(async () => {
        try {
            await apiFetch('/api/settings', {
                method: 'PATCH',
                body: JSON.stringify({ onboarding_complete: false }),
            });
            setHasCompleted(false);
            setCurrentStep(0);
            setAddedCounts({ income: 0, expenses: 0, assets: 0, debts: 0 });
        } catch (err) {
            console.error('Failed to restart onboarding:', err);
        }
    }, []);

    const incrementCount = useCallback((category: 'income' | 'expenses' | 'assets' | 'debts') => {
        setAddedCounts(prev => ({ ...prev, [category]: prev[category] + 1 }));
    }, []);

    return {
        hasCompleted,
        isLoading,
        currentStep,
        addedCounts,
        next,
        back,
        complete,
        restart,
        incrementCount,
    };
}
