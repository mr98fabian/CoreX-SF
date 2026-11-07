/**
 * Ajustes → Bloqueo con huella. Hidden unless this device has a user-verifying
 * platform authenticator. Turning it on registers this device's fingerprint;
 * turning it off forgets it. Copy states what it is: a local privacy lock.
 */
import { useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { markSeen, platformAuthenticatorAvailable, readLock, registerFingerprint, unregisterFingerprint, writeLock, type Relock } from '@/lib/appLock';

const RELOCK: { v: Relock; es: string; en: string }[] = [
    { v: 'exit', es: 'Al salir', en: 'On leave' },
    { v: 60, es: '1 min', en: '1 min' },
    { v: 300, es: '5 min', en: '5 min' },
    { v: 900, es: '15 min', en: '15 min' },
];

export function FingerprintLockRow({ es }: { es: boolean }) {
    const { toast } = useToast();
    const [supported, setSupported] = useState(false);
    const [s, setS] = useState(readLock);
    const [busy, setBusy] = useState(false);

    useEffect(() => { let alive = true; platformAuthenticatorAvailable().then((ok) => alive && setSupported(ok)); return () => { alive = false; }; }, []);
    if (!supported) return null;

    const save = (next: typeof s) => { writeLock(next); setS(next); };
    const toggle = async (on: boolean) => {
        setBusy(true);
        try {
            if (on) {
                const credentialId = await registerFingerprint();
                const next = { ...s, enabled: true, credentialId };
                save(next); markSeen(next);
            } else {
                if (s.credentialId) await unregisterFingerprint(s.credentialId).catch(() => undefined);
                save({ ...s, enabled: false, credentialId: null });
            }
        } catch {
            toast({ title: es ? 'No se pudo activar la huella' : "Couldn't turn on fingerprint", variant: 'destructive' });
        } finally { setBusy(false); }
    };

    return (
        <div data-testid="fingerprint-row" className="border-t border-[var(--kx-line-soft)] py-3">
            <div className="flex items-center gap-3">
                <span className="flex w-6 flex-none items-center justify-center"><Fingerprint className="h-[18px] w-[18px] text-kx-ink2" strokeWidth={1.75} /></span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold text-kx-ink">{es ? 'Bloqueo con huella' : 'Fingerprint lock'}</span>
                    <span className="block text-xs text-kx-ink2">
                        {es ? 'Candado de privacidad en este dispositivo. Tu sesión sigue abierta.' : 'Privacy lock on this device. Your session stays open.'}
                    </span>
                </span>
                <Switch checked={s.enabled} disabled={busy} onCheckedChange={toggle} aria-label={es ? 'Bloqueo con huella' : 'Fingerprint lock'} />
            </div>
            {s.enabled && (
                <div className="mt-3 flex flex-wrap items-center gap-2 pl-9" role="radiogroup" aria-label={es ? 'Volver a bloquear' : 'Lock again'}>
                    <span className="text-xs text-kx-ink2">{es ? 'Volver a bloquear:' : 'Lock again:'}</span>
                    {RELOCK.map((o) => (
                        <button key={String(o.v)} role="radio" aria-checked={s.relock === o.v} onClick={() => save({ ...s, relock: o.v })}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${s.relock === o.v ? 'border-kx-amber text-kx-amber' : 'border-kx-line text-kx-ink2'}`}>
                            {es ? o.es : o.en}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
