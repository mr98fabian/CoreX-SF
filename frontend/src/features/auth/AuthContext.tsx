import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { setDemoToken, clearDemoToken, getDemoToken } from '@/lib/api';

// Demo mode constants — must match backend
const DEMO_TOKEN = 'demo-stress-test-token';
const DEMO_USER_ID = '00000000-0000-4000-a000-000000000001';
const API_BASE = import.meta.env.DEV ? 'http://localhost:8000' : '';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isDemo: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithPassword: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string) => Promise<{ confirmEmail: boolean }>;
    resetPassword: (email: string) => Promise<void>;
    signInAsDemo: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Seeds the demo sandbox with Carlos Mendoza's original data.
 * Uses raw fetch (not apiFetch) to avoid circular dependency issues
 * and because we need to call this before auth state is fully set.
 */
async function seedDemoData(): Promise<void> {
    try {
        await fetch(`${API_BASE}/api/dev/seed-stress-test`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${DEMO_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });
    } catch (err) {
        // Seed failure is non-blocking — user can still explore with existing data
        console.warn('[CoreX] Demo seed failed (non-blocking):', err);
    }
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDemo, setIsDemo] = useState(false);

    useEffect(() => {
        // Check for existing demo session first
        const existingDemoToken = getDemoToken();
        if (existingDemoToken === DEMO_TOKEN) {
            // Restore demo session from localStorage — instant, no re-seed
            // Seed only happens on login (LoginPage) and signOut (cleanup)
            const demoUser = {
                id: DEMO_USER_ID,
                email: 'carlos@demo.corex.io',
                user_metadata: { full_name: 'Carlos Mendoza (Demo)' },
            } as unknown as User;
            setUser(demoUser);
            setIsDemo(true);
            setLoading(false);
            return;
        }

        supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, newSession) => {
                setSession(newSession);
                setUser(newSession?.user ?? null);
                setLoading(false);
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = useCallback(async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
        if (error) throw error;
    }, []);

    const signInWithPassword = useCallback(async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
    }, []);

    const signUp = useCallback(async (email: string, password: string, fullName: string) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName },
                emailRedirectTo: window.location.origin,
            },
        });
        if (error) throw error;

        // Supabase returns a user with identities = [] if email already exists
        // but confirmation is required. Check if we need email confirmation.
        const confirmEmail = !data.session;
        return { confirmEmail };
    }, []);

    const resetPassword = useCallback(async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/login`,
        });
        if (error) throw error;
    }, []);

    // ── Demo Mode: 1-click login with pre-loaded test data ──
    const signInAsDemo = useCallback(async () => {
        // Set the demo token in localStorage so apiFetch uses it
        setDemoToken(DEMO_TOKEN);

        // Create a synthetic user object for the frontend
        const demoUser = {
            id: DEMO_USER_ID,
            email: 'carlos@demo.corex.io',
            user_metadata: { full_name: 'Carlos Mendoza (Demo)' },
        } as unknown as User;

        setUser(demoUser);
        setIsDemo(true);
        setLoading(false);
    }, []);

    const signOut = useCallback(async () => {
        // If demo mode: reset sandbox data first, then clear state
        if (isDemo) {
            // Re-seed to restore original data for the next visitor
            await seedDemoData();
            clearDemoToken();
            setIsDemo(false);
            setUser(null);
            setSession(null);
            return;
        }
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }, [isDemo]);

    return (
        <AuthContext.Provider value={{
            user, session, loading, isDemo,
            signInWithGoogle, signInWithPassword, signUp, resetPassword,
            signInAsDemo, signOut,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
