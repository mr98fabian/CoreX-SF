/**
 * Fingerprint lock overlay for the signed-in app. Locks on open when the relock
 * interval has passed, and on return to the foreground after it. "Usar mi
 * contraseña" always signs out to the normal login: nobody is ever trapped.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Fingerprint } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/features/auth/AuthContext';
import { clearSeen, lockedOnOpen, lockedOnReturn, markSeen, readLock, unlockWithFingerprint } from '@/lib/appLock';

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function LockScreen({ es, onUnlock, onPassword }: { es: boolean; onUnlock: () => Promise<void>; onPassword: () => void }) {
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const tryUnlock = async () => {
        setBusy(true); setFailed(false);
        try { await onUnlock(); } catch { setFailed(true); } finally { setBusy(false); }
    };
    return (
        <div role="dialog" aria-modal="true" aria-label={es ? 'KoreX bloqueado' : 'KoreX locked'} data-testid="app-lock"
            className="kx-scope fixed inset-0 z-[100] flex items-center justify-center bg-kx-bg px-8 text-center">
            {/* The backdrop is always opaque; only the content fades in, so the app never shows through */}
            <div data-testid="app-lock-body" className={`flex flex-col items-center gap-8 ${reducedMotion() ? '' : 'animate-in fade-in duration-200'}`}>
            <img src="/korex-logotipo.svg" alt="KoreX" className="h-10" />
            <div className="space-y-2">
                <p className="font-editorial text-[24px] font-[420] text-kx-ink">{es ? 'KoreX está bloqueado' : 'KoreX is locked'}</p>
                <p className="mx-auto max-w-xs text-[13.5px] leading-relaxed text-kx-ink2">
                    {es ? 'Candado de privacidad de este dispositivo. Tu sesión sigue abierta.' : 'Privacy lock on this device. Your session stays open.'}
                </p>
            </div>
            <button onClick={tryUnlock} disabled={busy} autoFocus
                className="kx-press flex items-center gap-2.5 rounded-xl bg-kx-amber px-6 py-3.5 text-[15px] font-bold text-[#111418] disabled:opacity-60">
                <Fingerprint className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />{es ? 'Usar huella' : 'Use fingerprint'}
            </button>
            {failed && <p role="alert" className="-mt-4 text-[13px] text-kx-debt">{es ? 'No se pudo verificar. Inténtalo otra vez.' : "Couldn't verify. Try again."}</p>}
            <button onClick={onPassword} className="text-[13.5px] font-semibold text-kx-ink2 underline-offset-4 hover:underline">
                {es ? 'Usar mi contraseña' : 'Use my password'}
            </button>
            </div>
        </div>
    );
}

export function AppLock() {
    const { language } = useLanguage();
    const es = language === 'es';
    const { signOut } = useAuth();
    const navigate = useNavigate();
    const [locked, setLocked] = useState(() => lockedOnOpen(readLock()));
    const hiddenAt = useRef<number | null>(null);

    useEffect(() => {
        const onVis = () => {
            const s = readLock();
            if (document.visibilityState === 'hidden') {
                hiddenAt.current = Date.now();
                if (!locked) markSeen(s);
            } else if (hiddenAt.current !== null) {
                if (lockedOnReturn(s, Date.now() - hiddenAt.current)) setLocked(true);
                hiddenAt.current = null;
            }
        };
        const onChange = () => { if (!readLock().enabled) setLocked(false); };
        const onPageHide = () => { if (!locked) markSeen(readLock()); };
        document.addEventListener('visibilitychange', onVis);
        window.addEventListener('pagehide', onPageHide);
        window.addEventListener('kx-lock-change', onChange);
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('pagehide', onPageHide);
            window.removeEventListener('kx-lock-change', onChange);
        };
    }, [locked]);

    const unlock = useCallback(async () => {
        await unlockWithFingerprint();
        markSeen(readLock());
        setLocked(false);
    }, []);
    const usePassword = useCallback(async () => {
        clearSeen();
        try { await signOut(); } finally { setLocked(false); navigate('/login', { replace: true }); }
    }, [signOut, navigate]);

    return locked ? createPortal(<LockScreen es={es} onUnlock={unlock} onPassword={usePassword} />, document.body) : null;
}
