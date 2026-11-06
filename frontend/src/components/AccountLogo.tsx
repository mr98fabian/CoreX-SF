/**
 * Official company logo (from Plaid, stored by the backend as https or a
 * base64 data URI) at 32px, rounded 8px, subtle white plate + hairline.
 * Hard rule: never an invented URL or a broken image — no logo, or a logo
 * that fails to load, renders an elegant monogram (initial in a slate circle).
 */
import { useState } from 'react';

const SAFE = /^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/;

export function AccountLogo({ name, src, size = 32 }: { name: string; src?: string | null; size?: number }) {
    const [broken, setBroken] = useState(false);
    const initial = (name.trim().match(/[\p{L}\p{N}]/u)?.[0] ?? '·').toUpperCase();
    if (src && SAFE.test(src) && !broken) {
        return (
            <span className="flex flex-none items-center justify-center overflow-hidden rounded-[8px] border border-[var(--kx-line-soft)] bg-white/90"
                style={{ width: size, height: size }}>
                <img src={src} alt="" aria-hidden="true" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-contain p-[3px]" />
            </span>
        );
    }
    return (
        <span data-testid="logo-monogram" aria-hidden="true"
            className="font-editorial flex flex-none items-center justify-center rounded-full border border-[var(--kx-line-soft)] bg-[#1E293B] text-kx-ink2"
            style={{ width: size, height: size, fontSize: Math.round(size * 0.44) }}>
            {initial}
        </span>
    );
}
