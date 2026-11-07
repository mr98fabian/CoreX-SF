/**
 * Moments that may make a sound or a vibration — and ONLY these. Navigation,
 * errors and app open are not Moments, so they can't trigger either.
 *
 *  - sound: one short warm chord (public/sounds/logro.wav), OFF by default
 *    ("Sonido de logro" in Ajustes), only for a payment recorded or a cut at $0.
 *    Played through Web Audio, which iOS mutes with the silent switch, and only
 *    after a user gesture has primed the AudioContext (iOS rule).
 *  - haptic: navigator.vibrate(10) on a confirmed payment and a fingerprint
 *    unlock; where the API doesn't exist (iOS web) it silently does nothing.
 */
export type Moment = 'payment' | 'zero-cut' | 'unlock';

const SOUND_MOMENTS: ReadonlySet<Moment> = new Set(['payment', 'zero-cut']);
const HAPTIC_MOMENTS: ReadonlySet<Moment> = new Set(['payment', 'unlock']);
const SOUND_KEY = 'kx-sound';
const SOUND_URL = '/sounds/logro.wav';
const VOLUME = 0.35;
const DEDUPE_MS = 1500; // a payment that also zeroes a cut plays once

export function soundEnabled(): boolean {
    try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch { return false; }
}
export function setSoundEnabled(on: boolean) {
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* private mode: stays off */ }
}

function reducedMotion(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

let ctx: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let lastPlayed = 0;

function audioCtor(): typeof AudioContext | undefined {
    return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

/** Call synchronously inside the click/tap handler that may lead to a Moment (unlocks audio on iOS). */
export function primeAudio() {
    if (!soundEnabled()) return;
    const Ctor = audioCtor();
    if (!Ctor) return;
    try {
        ctx = ctx ?? new Ctor();
        if (ctx.state === 'suspended') void ctx.resume();
        if (!buffer) {
            const c = ctx;
            void fetch(SOUND_URL).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).then((d) => { buffer = d; }).catch(() => undefined);
        }
    } catch { /* no audio: stay silent */ }
}

function play(now: number) {
    if (!ctx || !buffer || ctx.state !== 'running') return; // never primed by a gesture → silence
    if (now - lastPlayed < DEDUPE_MS) return;
    lastPlayed = now;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = VOLUME;
    src.buffer = buffer;
    src.connect(gain).connect(ctx.destination);
    src.start();
}

export function moment(m: Moment, now = Date.now()) {
    if (HAPTIC_MOMENTS.has(m) && !reducedMotion()) {
        try { navigator.vibrate?.(10); } catch { /* unsupported */ }
    }
    if (SOUND_MOMENTS.has(m) && soundEnabled()) play(now);
}

/** Test seam: reset module state. */
export function __resetFeedback(next?: { ctx?: AudioContext | null; buffer?: AudioBuffer | null }) {
    ctx = next?.ctx ?? null; buffer = next?.buffer ?? null; lastPlayed = 0;
}
