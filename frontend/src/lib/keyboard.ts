/**
 * Soft keyboard helpers for the mobile shell (2026-11, shell móvil parte 3).
 *
 * The APK used to let Capacitor's Keyboard plugin shrink the whole view to
 * "screen − keyboard" (resizeOnFullScreen) and only restore it on the keyboard's
 * close animation. When the keyboard left without that animation (Home, focus
 * loss, closing a sheet with the keyboard up) the app stayed cut in half. Now no
 * plugin touches the view height (capacitor.config.ts); the web engine decides
 * (viewport interactive-widget=resizes-content). These helpers only:
 *  - dismiss the keyboard WITH focus before we leave the app (pause, Google
 *    sign-in in the system browser), so no native state can get stuck;
 *  - tell the shell when the keyboard is open, to hide the tab bar.
 */
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

const isField = (el: Element | null) =>
    !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable);

/** Blur the focused field and, in the APK, close the keyboard. Never throws. */
export function dismissKeyboard() {
    try {
        const el = document.activeElement as HTMLElement | null;
        if (isField(el)) el!.blur();
    } catch { /* nothing focused */ }
    if (Capacitor.isNativePlatform()) {
        Keyboard.hide().catch(() => undefined);
    }
}

/**
 * Subscribe to "keyboard open" changes. APK: the plugin's will-show/will-hide
 * events. Web/PWA: a field has focus and the visual viewport lost a big chunk
 * of the tallest height seen (the keyboard), so a desktop focus never counts.
 */
export function onKeyboardChange(cb: (open: boolean) => void): () => void {
    if (Capacitor.isNativePlatform()) {
        const subs = [
            Keyboard.addListener('keyboardWillShow', () => cb(true)),
            Keyboard.addListener('keyboardWillHide', () => cb(false)),
        ];
        return () => { subs.forEach((p) => p.then((h) => h.remove()).catch(() => undefined)); };
    }
    if (typeof window === 'undefined') return () => undefined;
    const vv = window.visualViewport;
    let tallest = vv?.height ?? window.innerHeight;
    const check = () => {
        const h = vv?.height ?? window.innerHeight;
        tallest = Math.max(tallest, h);
        cb(isField(document.activeElement) && h < tallest * 0.75);
    };
    vv?.addEventListener('resize', check);
    window.addEventListener('resize', check);
    document.addEventListener('focusout', check);
    return () => {
        vv?.removeEventListener('resize', check);
        window.removeEventListener('resize', check);
        document.removeEventListener('focusout', check);
    };
}
