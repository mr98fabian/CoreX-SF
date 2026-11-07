/** Ajustes → Sonido de logro. OFF by default; only a payment or a cut at $0 ever sounds. */
import { useState } from 'react';
import { Volume2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { primeAudio, setSoundEnabled, soundEnabled } from '@/lib/feedback';

export function SoundRow({ es }: { es: boolean }) {
    const [on, setOn] = useState(soundEnabled);
    const toggle = (v: boolean) => {
        setSoundEnabled(v); setOn(v);
        if (v) primeAudio(); // this tap is the user gesture iOS needs
    };
    return (
        <div data-testid="sound-row" className="flex items-center gap-3 border-t border-[var(--kx-line-soft)] py-3">
            <span className="flex w-6 flex-none items-center justify-center"><Volume2 className="h-[18px] w-[18px] text-kx-ink2" strokeWidth={1.75} /></span>
            <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-kx-ink">{es ? 'Sonido de logro' : 'Achievement sound'}</span>
                <span className="block text-xs text-kx-ink2">{es ? 'Suena solo al registrar un pago o al llegar a $0 en un corte.' : 'Plays only when you record a payment or a cut hits $0.'}</span>
            </span>
            <Switch checked={on} onCheckedChange={toggle} aria-label={es ? 'Sonido de logro' : 'Achievement sound'} />
        </div>
    );
}
