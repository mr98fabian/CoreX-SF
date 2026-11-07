/**
 * Splash while a route chunk loads: slate, the KoreX logo breathing once
 * (< 900 ms, then still). No fake progress bar, no glow. Reduced motion: static.
 */
export default function LoadingScreen() {
    return (
        <div className="kx-scope fixed inset-0 z-[9999] flex items-center justify-center bg-kx-bg" role="status" aria-label="KoreX">
            <img src="/korex-imagotipo.svg" alt="" className="kx-breathe h-36 max-w-[70vw] sm:h-44" data-testid="splash-logo" />
        </div>
    );
}
