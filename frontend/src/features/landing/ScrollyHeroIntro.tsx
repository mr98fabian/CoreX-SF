import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HeroDashboardSVG from './svgs/HeroDashboardSVG';
import { ArrowRight, Play, ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

gsap.registerPlugin(ScrollTrigger);

/* Bilingual copy for the scrolly hero — keeps the landing in one language */
const heroCopy = {
    act1Title: { en: 'THE SYSTEM IS RIGGED', es: 'EL SISTEMA ESTÁ EN TU CONTRA' },
    act1TitleAccent: { en: 'AGAINST YOU.', es: 'POR DISEÑO.' },
    act1Subtitle: {
        en: 'Every day you wait, traditional banks siphon your wealth.',
        es: 'Cada día que esperas, los bancos drenan tu riqueza.',
    },
    act2Lead: { en: 'But what if you had access to the', es: '¿Y si tuvieras acceso al' },
    act2Accent: { en: 'ultimate weapon?', es: 'arma definitiva?' },
    tagline: {
        en: "The weapon banks don't want you to have.",
        es: 'El arma que los bancos no quieren que tengas.',
    },
    ctaPrimary: { en: 'Calculate Your Savings', es: 'Calcula Tu Ahorro' },
    ctaSecondary: { en: 'WATCH DEMO', es: 'VER DEMO' },
    scroll: { en: 'SCROLL', es: 'DESLIZA' },
} as const;

export default function ScrollyHeroIntro() {
    const sectionRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    const { language } = useLanguage();
    const L = language as 'en' | 'es';

    // Act 1 SVG Configuration
    const act1Lines = Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const radius = 600;
        return {
            x1: 0, y1: 0,
            x2: Math.cos(angle) * radius,
            y2: Math.sin(angle) * radius
        };
    });

    useEffect(() => {
        const section = sectionRef.current;
        const container = containerRef.current;
        if (!section || !container) return;

        const ctx = gsap.context(() => {
            // Main Scrub Timeline attached to the 400vh section
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: section,
                    start: "top top",
                    end: "bottom bottom",
                    scrub: 1, // Smooth scrubbing
                    pin: container,
                }
            });

            // ==========================================
            // ACT 1 (0% -> 30% Scroll): The Trap
            // ==========================================
            // Introduce the "debt" lines constricting
            tl.to('.act1-line', {
                strokeDashoffset: 0,
                duration: 2,
                stagger: 0.1,
                ease: 'none'
            }, 0);

            tl.to('.act1-text', {
                opacity: 1,
                scale: 1,
                y: 0,
                duration: 1,
                ease: 'back.out(1.5)'
            }, 1);

            // ==========================================
            // ACT 2 (30% -> 60% Scroll): The Revelation
            // ==========================================
            // The Trap shatters / disappears
            tl.to('.act1-container', {
                scale: 1.5,
                opacity: 0,
                filter: 'blur(10px)', // Subtle blur out
                duration: 1.5,
                ease: 'power2.in'
            }, 3);

            // The revelation text fades in
            tl.to('.act2-text', {
                opacity: 1,
                scale: 1,
                duration: 1,
                ease: 'power2.out'
            }, 4);

            // ==========================================
            // ACT 3 (60% -> 100% Scroll): The Weapon (Hero State)
            // ==========================================
            // Hide Act 2 text quickly
            tl.to('.act2-text', {
                opacity: 0,
                y: -50,
                duration: 1,
                ease: 'power2.in'
            }, 6);

            // Bring in the final exact Hero State requested by user
            tl.to('.act3-container', {
                opacity: 1,
                duration: 1.5,
                ease: 'none'
            }, 6.5);

            // Dashboard SVG slides up from bottom left
            tl.fromTo('.act3-dashboard',
                { y: 100, opacity: 0, scale: 0.9 },
                { y: 0, opacity: 1, scale: 1, duration: 2, ease: 'power3.out' },
                6.5
            );

            // KOREX Logo & content slides in from right
            tl.fromTo('.act3-content',
                { x: 50, opacity: 0 },
                { x: 0, opacity: 1, duration: 1.5, stagger: 0.2, ease: 'power2.out' },
                7
            );

            // Subtle particle zoom effect
            tl.to('.lp-particles-scrolly', {
                scale: 1.2,
                duration: 9,
                ease: 'none'
            }, 0);

        }, section);

        return () => ctx.revert();
    }, []);

    return (
        <section
            ref={sectionRef}
            className="relative w-full bg-slate-950"
            style={{ height: '400vh' }} // Creates the 4 scrollable screens
        >
            {/* STICKY CONTAINER: Stays fixed during the 400vh scroll */}
            <div
                ref={containerRef}
                className="sticky top-0 w-full h-screen overflow-hidden flex items-center justify-center"
            >
                {/* Subtle Background Particles */}
                <div className="absolute inset-0 z-0 pointer-events-none opacity-40 lp-particles-scrolly">
                    <div className="absolute top-[20%] left-[15%] w-[300px] h-[300px] rounded-full bg-amber-600/10 blur-[120px]"></div>
                    <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-indigo-600/10 blur-[150px]"></div>
                </div>

                {/* =========================================
                    ACT 1: THE TRAP (SVG)
                ========================================= */}
                <div className="act1-container absolute inset-0 flex flex-col items-center justify-center z-10 pointers-events-none">
                    <svg className="absolute inset-0 w-full h-full" viewBox="-1000 -1000 2000 2000">
                        <defs>
                            <linearGradient id="debt-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
                                <stop offset="50%" stopColor="#ef4444" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#7f1d1d" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {act1Lines.map((line, i) => (
                            <line
                                key={`act1-line-${i}`}
                                className="act1-line"
                                x1={line.x1} y1={line.y1}
                                x2={line.x2} y2={line.y2}
                                stroke="url(#debt-gradient)"
                                strokeWidth="3"
                                strokeDasharray="600"
                                strokeDashoffset="600"
                                strokeLinecap="round"
                            />
                        ))}
                        {/* Trap Core */}
                        <circle cx="0" cy="0" r="40" fill="#991b1b" className="animate-pulse opacity-50" />
                    </svg>

                    <div className="act1-text absolute text-center opacity-0 scale-90 translate-y-8 max-w-2xl px-6">
                        <ShieldAlert className="w-16 h-16 mx-auto mb-6 text-red-500 opacity-80" />
                        <h1 className="text-4xl md:text-6xl font-black text-slate-100 tracking-tight leading-tight">
                            {heroCopy.act1Title[L]} <span className="text-red-500">{heroCopy.act1TitleAccent[L]}</span>
                        </h1>
                        <p className="mt-6 text-xl text-slate-400 font-mono tracking-wide">
                            {heroCopy.act1Subtitle[L]}
                        </p>
                    </div>
                </div>

                {/* =========================================
                    ACT 2: THE REVELATION
                ========================================= */}
                <div className="act2-container absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div className="act2-text absolute text-center opacity-0 scale-90 max-w-3xl px-6">
                        <h2 className="text-3xl md:text-5xl font-black text-white tracking-widest leading-snug drop-shadow-xl uppercase">
                            {heroCopy.act2Lead[L]} <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
                                {heroCopy.act2Accent[L]}
                            </span>
                        </h2>
                    </div>
                </div>

                {/* =========================================
                    ACT 3: THE KOREX HERO (Exact replica of original Hero)
                ========================================= */}
                <div className="act3-container absolute inset-0 flex items-center justify-center opacity-0 z-30 pt-20">
                    <div className="max-w-[1400px] w-full mx-auto px-6 h-full flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-24 relative pb-20">

                        {/* LEFT: 3D Visualization / Dashboard */}
                        <div className="act3-dashboard flex-1 w-full lg:w-1/2 flex justify-center items-center opacity-0 relative z-10 pt-16 lg:pt-0">
                            <HeroDashboardSVG className="w-full max-w-[600px] lg:max-w-none h-auto drop-shadow-2xl opacity-90 transform hover:scale-[1.02] transition-transform duration-700" />
                        </div>

                        {/* RIGHT: High-Impact Typography & CTA */}
                        <div className="flex-1 w-full lg:w-1/2 flex flex-col justify-center items-center lg:items-start text-center lg:text-left z-10 mt-8 lg:mt-0">
                            {/* KOREX BIG LOGO — official imagotipo (raccoon in the O) */}
                            <div className="act3-content mb-6 flex justify-center lg:justify-start">
                                <img
                                    src="/korex-imagotipo.svg"
                                    alt="KoreX"
                                    className="h-[72px] sm:h-[92px] lg:h-[110px] w-auto drop-shadow-2xl"
                                />
                            </div>

                            <p className="act3-content text-xl sm:text-2xl text-slate-300 font-mono tracking-[0.2em] sm:tracking-[0.3em] uppercase max-w-xl mx-auto lg:mx-0 mb-12">
                                {heroCopy.tagline[L]}
                            </p>

                            <div className="act3-content flex flex-col sm:flex-row gap-6 items-center w-full justify-center lg:justify-start">
                                <button
                                    onClick={() => navigate('/login')}
                                    className="group relative inline-flex items-center justify-center px-10 py-5 font-bold text-slate-950 bg-amber-500 rounded-none overflow-hidden transition-all hover:scale-105 active:scale-95"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <span className="relative flex items-center gap-3 text-lg tracking-widest uppercase">
                                        {heroCopy.ctaPrimary[L]}
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
                                    </span>
                                </button>

                                <button
                                    onClick={() => navigate('/login')}
                                    className="group inline-flex items-center gap-3 px-8 py-4 font-mono text-sm tracking-widest text-slate-400 hover:text-white transition-colors border border-slate-800 hover:border-slate-700 bg-slate-900/30 backdrop-blur-sm"
                                >
                                    <Play className="w-4 h-4 text-amber-500" />
                                    <span>{heroCopy.ctaSecondary[L]}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SCROLL INDICATOR */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-slate-500 z-50">
                    <span className="text-xs font-mono tracking-widest">{heroCopy.scroll[L]}</span>
                    <div className="w-[1px] h-12 bg-gradient-to-b from-slate-500 to-transparent"></div>
                </div>

            </div>
        </section>
    );
}
