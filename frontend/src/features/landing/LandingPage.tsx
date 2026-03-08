/**
 * LandingPage — GTA VI Cinematic Edition.
 *
 * Inspired by rockstargames.com/VI:
 * - Full-bleed hero with cinematic letterboxing
 * - Film grain overlay for texture
 * - Bold Oswald typography (uppercase, impactful)
 * - Scroll-driven GSAP reveals with parallax depth
 * - Gold accent color palette (premium feel)
 *
 * 7 sections: Hero → Problem → Solution → Comparison → Proof → Pricing → Final CTA
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './LandingPage.css';

import DebtVisualizerSVG from './svgs/DebtVisualizerSVG';
import MobileAppSVG from './svgs/MobileAppSVG';
import ComparisonGraphSVG from './svgs/ComparisonGraphSVG';
import SimpleFreedomSVG from './svgs/SimpleFreedomSVG';
import ScrollyHeroIntro from './ScrollyHeroIntro';

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════
   Copy — bilingual, NLP-optimized
   ═══════════════════════════════════════════════════════ */
const copy = {
    hero: {
        tagline: {
            en: 'The weapon banks don\'t want you to have.',
            es: 'El arma que los bancos no quieren que tengas.',
        },
        cta: { en: 'Calculate Your Savings', es: 'Calcula Tu Ahorro' },
        secondary: { en: 'Watch Demo', es: 'Ver Demo' },
    },
    problem: {
        label: { en: 'THE PROBLEM', es: 'EL PROBLEMA' },
        title: {
            en: 'While You Read This, Your Debt Just Grew',
            es: 'Mientras lees esto, tu deuda acaba de crecer',
        },
        subtitle: {
            en: 'Banks designed the system to keep you paying for 30 years. Between your mortgage, 2 car loans, credit cards, and student loans — the average American household hemorrhages over $23,000/year in interest alone.',
            es: 'Los bancos diseñaron el sistema para mantenerte pagando por 30 años. Entre hipoteca, 2 autos, tarjetas de crédito y préstamos — el hogar promedio americano pierde más de $23,000/año solo en intereses.',
        },
        counterLabel: {
            en: 'lost in interest EVERY MONTH by the average American household',
            es: 'perdidos en intereses CADA MES por el hogar promedio americano',
        },
    },
    solution: {
        label: { en: 'THE SOLUTION', es: 'LA SOLUCIÓN' },
        title: {
            en: 'Turn The Banks\' Math Against Them',
            es: 'Usa las matemáticas de los bancos en su contra',
        },
        subtitle: {
            en: 'KoreX uses Velocity Banking — the same compound interest strategy banks use to profit from you, but reversed in your favor.',
            es: 'KoreX usa Velocity Banking — la misma estrategia de interés compuesto que los bancos usan para lucrar contigo, pero invertida a tu favor.',
        },
        features: [
            {
                icon: '⚔️',
                bg: 'rgba(139, 92, 246, 0.15)',
                title: { en: 'Attack Engine', es: 'Motor de Ataque' },
                desc: {
                    en: 'AI identifies which debt to attack first for maximum interest savings. Each "attack" can save you $200-$2,000.',
                    es: 'La IA identifica qué deuda atacar primero para máximo ahorro en intereses. Cada "ataque" puede ahorrarte $200-$2,000.',
                },
            },
            {
                icon: '🛡️',
                bg: 'rgba(52, 211, 153, 0.15)',
                title: { en: 'Peace Shield', es: 'Escudo de Paz' },
                desc: {
                    en: 'Build an emergency buffer of 2-3 months expenses before attacking debt. Financial peace of mind.',
                    es: 'Construye un colchón de emergencia de 2-3 meses antes de atacar deuda. Tranquilidad financiera real.',
                },
            },
            {
                icon: '📊',
                bg: 'rgba(245, 158, 11, 0.15)',
                title: { en: 'Cashflow GPS', es: 'GPS de Cashflow' },
                desc: {
                    en: '90-day projections show exactly when each debt dies. You\'ll see your freedom date on day one.',
                    es: 'Proyecciones a 90 días muestran exactamente cuándo muere cada deuda. Verás tu fecha de libertad desde el día uno.',
                },
            },
            {
                icon: '🎖️',
                bg: 'rgba(251, 113, 133, 0.15)',
                title: { en: 'Hero Rank System', es: 'Sistema de Rango' },
                desc: {
                    en: 'From Recruit to Sovereign — earn ranks as you eliminate debts. Your identity transforms with every victory.',
                    es: 'De Recluta a Soberano — gana rangos al eliminar deudas. Tu identidad se transforma con cada victoria.',
                },
            },
        ],
    },
    compare: {
        label: { en: 'THE DIFFERENCE', es: 'LA DIFERENCIA' },
        title: {
            en: 'Your Money, Two Futures',
            es: 'Tu Dinero, Dos Futuros',
        },
        without: {
            heading: { en: 'Without KoreX', es: 'Sin KoreX' },
            items: [
                { en: '30 years of minimum payments', es: '30 años de pagos mínimos' },
                { en: '$284,000 in interest to banks', es: '$284,000 en intereses para el banco' },
                { en: 'No emergency buffer', es: 'Sin colchón de emergencia' },
                { en: 'Stress, guessing, hoping', es: 'Estrés, adivinanzas, esperanza' },
            ],
        },
        with: {
            heading: { en: 'With KoreX', es: 'Con KoreX' },
            items: [
                { en: '7-12 years to total freedom', es: '7-12 años para libertad total' },
                { en: 'Save $45,000+ in interest', es: 'Ahorra $45,000+ en intereses' },
                { en: 'Peace Shield emergency fund', es: 'Escudo de Paz como fondo de emergencia' },
                { en: 'AI strategy, clear roadmap', es: 'Estrategia IA, hoja de ruta clara' },
            ],
        },
    },
    proof: {
        label: { en: 'TRUSTED BY', es: 'CONFÍAN EN NOSOTROS' },
        stats: [
            { value: '3.2x', label: { en: 'Faster Debt Freedom', es: 'Más Rápido que Pagos Mínimos' } },
            { value: '$45K', label: { en: 'Avg Interest Saved', es: 'Ahorro Promedio en Intereses' } },
            { value: '4.9★', label: { en: 'User Rating', es: 'Calificación de Usuarios' } },
            { value: '24/7', label: { en: 'AI Monitoring', es: 'Monitoreo IA' } },
        ],
    },
    pricing: {
        label: { en: 'PRICING', es: 'PRECIOS' },
        title: { en: 'From $0.26/Day', es: 'Desde $0.26/Día' },
        subtitle: {
            en: 'You lose ~$65/day in interest. Protect yourself for less than a pack of gum.',
            es: 'Pierdes ~$65/día en intereses. Protégete por menos que un chicle.',
        },
        plans: [
            {
                name: 'Starter',
                price: { en: 'Free', es: 'Gratis' },
                period: { en: '', es: '' },
                popular: false,
                cta: { en: 'Start Free', es: 'Empieza Gratis' },
                savings: { en: '~$1,296/yr in interest saved', es: '~$1,296/año en intereses ahorrados' },
                accounts: { en: '2 debt accounts', es: '2 cuentas de deuda' },
                features: [
                    { en: 'All features included', es: 'Todas las funciones' },
                    { en: 'Freedom Clock & Action Plan', es: 'Reloj de Libertad y Plan de Acción' },
                    { en: 'PDF Reports & Exports', es: 'Reportes PDF y Exportación' },
                    { en: 'Velocity Simulations', es: 'Simulaciones Velocity' },
                ],
            },
            {
                name: 'Velocity',
                price: '$8.99',
                period: { en: '/mo', es: '/mes' },
                originalPrice: '$19.99',
                discount: { en: '55% OFF', es: '55% OFF' },
                billedNote: { en: 'Billed $96.99/year', es: 'Facturado $96.99/año' },
                popular: false,
                cta: { en: 'Upgrade Now', es: 'Mejora Ahora' },
                savings: { en: '~$3,240/yr in interest saved', es: '~$3,240/año en intereses ahorrados' },
                roi: { en: 'Net gain: $3,143/yr · Pays for itself in 11 days', es: 'Ganancia neta: $3,143/año · Se paga solo en 11 días' },
                accounts: { en: '6 debt accounts', es: '6 cuentas de deuda' },
                features: [
                    { en: 'All features included', es: 'Todas las funciones' },
                    { en: 'Freedom Clock & Action Plan', es: 'Reloj de Libertad y Plan de Acción' },
                    { en: 'PDF Reports & Exports', es: 'Reportes PDF y Exportación' },
                    { en: 'Velocity Simulations', es: 'Simulaciones Velocity' },
                ],
            },
            {
                name: 'Accelerator',
                price: '$16.99',
                period: { en: '/mo', es: '/mes' },
                originalPrice: '$34.99',
                discount: { en: '51% OFF', es: '51% OFF' },
                billedNote: { en: 'Billed $196.99/year', es: 'Facturado $196.99/año' },
                popular: true,
                badge: { en: 'MOST POPULAR', es: 'MÁS POPULAR' },
                cta: { en: 'Upgrade Now', es: 'Mejora Ahora' },
                savings: { en: '~$4,860/yr in interest saved', es: '~$4,860/año en intereses ahorrados' },
                roi: { en: 'Net gain: $4,663/yr · Pays for itself in 15 days', es: 'Ganancia neta: $4,663/año · Se paga solo en 15 días' },
                accounts: { en: '12 debt accounts', es: '12 cuentas de deuda' },
                features: [
                    { en: 'All features included', es: 'Todas las funciones' },
                    { en: 'Freedom Clock & Action Plan', es: 'Reloj de Libertad y Plan de Acción' },
                    { en: 'PDF Reports & Exports', es: 'Reportes PDF y Exportación' },
                    { en: 'Velocity Simulations', es: 'Simulaciones Velocity' },
                ],
            },
            {
                name: 'Freedom',
                price: '$28.99',
                period: { en: '/mo', es: '/mes' },
                originalPrice: '$54.99',
                discount: { en: '47% OFF', es: '47% OFF' },
                billedNote: { en: 'Billed $346.99/year', es: 'Facturado $346.99/año' },
                popular: false,
                cta: { en: 'Upgrade Now', es: 'Mejora Ahora' },
                savings: { en: '~$6,480/yr + no limits', es: '~$6,480/año + sin límites' },
                roi: { en: 'Net gain: $6,133/yr · Pays for itself in 20 days', es: 'Ganancia neta: $6,133/año · Se paga solo en 20 días' },
                accounts: { en: 'Unlimited debt accounts', es: 'Cuentas de deuda ilimitadas' },
                features: [
                    { en: 'All features included', es: 'Todas las funciones' },
                    { en: 'Freedom Clock & Action Plan', es: 'Reloj de Libertad y Plan de Acción' },
                    { en: 'PDF Reports & Exports', es: 'Reportes PDF y Exportación' },
                    { en: 'Velocity Simulations', es: 'Simulaciones Velocity' },
                ],
            },
        ],
    },
    final: {
        title: {
            en: ['Every day you wait,', 'banks win.'],
            es: ['Cada día que esperas,', 'ganan los bancos.'],
        },
        cta: { en: 'Start Your Freedom', es: 'Inicia Tu Libertad' },
        sub: {
            en: 'Free forever. No credit card required.',
            es: 'Gratis para siempre. Sin tarjeta de crédito.',
        },
    },
    nav: {
        features: { en: 'Features', es: 'Funciones' },
        pricing: { en: 'Pricing', es: 'Precios' },
        login: { en: 'Login', es: 'Iniciar Sesión' },
    },
    footer: {
        terms: { en: 'Terms of Service', es: 'Términos de Servicio' },
        privacy: { en: 'Privacy Policy', es: 'Política de Privacidad' },
        copy: '© 2026 KoreX Financial Systems. All rights reserved.',
    },
};

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
    const { language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const L = language === 'es' ? 'es' : 'en';

    // ── Refs for GSAP ──
    const containerRef = useRef<HTMLDivElement>(null);
    const heroRef = useRef<HTMLDivElement>(null);
    const problemRef = useRef<HTMLDivElement>(null);
    const solutionRef = useRef<HTMLDivElement>(null);
    const compareRef = useRef<HTMLDivElement>(null);
    const proofRef = useRef<HTMLDivElement>(null);
    const pricingRef = useRef<HTMLDivElement>(null);
    const finalRef = useRef<HTMLDivElement>(null);

    // ── State ──
    const [navScrolled, setNavScrolled] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);

    // ── Magnetic button ref ──
    const magneticCtaRef = useRef<HTMLButtonElement>(null);

    // ── Navbar scroll detection + scroll progress (rAF-throttled) ──
    useEffect(() => {
        let ticking = false;
        const handleScroll = () => {
            if (ticking) return;          // Skip if a frame is already queued
            ticking = true;
            requestAnimationFrame(() => {
                setNavScrolled(window.scrollY > 80);
                const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                if (docHeight > 0) {
                    setScrollProgress((window.scrollY / docHeight) * 100);
                }
                ticking = false;
            });
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // ── Magnetic CTA button effect ──
    useEffect(() => {
        const btn = magneticCtaRef.current;
        if (!btn) return;
        const handleMove = (e: MouseEvent) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
        };
        const handleLeave = () => {
            btn.style.transition = 'transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
            btn.style.transform = 'translate(0, 0)';
            setTimeout(() => { btn.style.transition = ''; }, 400);
        };
        btn.addEventListener('mousemove', handleMove, { passive: true });
        btn.addEventListener('mouseleave', handleLeave);
        return () => {
            btn.removeEventListener('mousemove', handleMove);
            btn.removeEventListener('mouseleave', handleLeave);
        };
    }, []);

    // ── GSAP Cinematic Animations ──
    useEffect(() => {
        const ctx = gsap.context(() => {
            // ──── Hero cinematic entrance ────
            const heroTl = gsap.timeline({ delay: 0.2 });

            heroTl
                .from('.lp-hero-logo', {
                    scale: 1.3,
                    opacity: 0,
                    duration: 1.8,
                    ease: 'power4.out',
                })
                .from('.lp-hero-tagline', {
                    y: 30,
                    opacity: 0,
                    duration: 1,
                    ease: 'power3.out',
                }, '-=0.8')
                .from('.lp-hero-buttons', {
                    y: 20,
                    opacity: 0,
                    duration: 0.8,
                    ease: 'power3.out',
                }, '-=0.5')
                .from('.lp-scroll-hint', {
                    opacity: 0,
                    duration: 1,
                    ease: 'power2.out',
                }, '-=0.3');

            // Hero mockup — parallax scroll reveal
            gsap.from('.lp-hero-mockup', {
                scrollTrigger: {
                    trigger: '.lp-hero-mockup',
                    start: 'top 90%',
                    end: 'top 40%',
                    scrub: 1,
                },
                y: 100,
                opacity: 0,
                scale: 0.9,
            });

            // Hero background parallax on scroll
            gsap.to('.lp-hero-gradient-overlay', {
                scrollTrigger: {
                    trigger: heroRef.current,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                },
                y: '20%',
                scale: 1.1,
            });

            // ──── All section images — scroll reveal + parallax ────
            gsap.utils.toArray<HTMLElement>('.lp-split-img').forEach((img) => {
                gsap.from(img, {
                    scrollTrigger: {
                        trigger: img,
                        start: 'top 85%',
                    },
                    y: 60,
                    opacity: 0,
                    scale: 0.95,
                    duration: 1,
                    ease: 'power3.out',
                });
                // Subtle parallax float on scroll
                gsap.to(img, {
                    scrollTrigger: {
                        trigger: img,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: 1,
                    },
                    y: -30,
                });
            });

            // Problem title dramatic reveal
            gsap.from('.lp-problem .lp-section-title', {
                scrollTrigger: {
                    trigger: problemRef.current,
                    start: 'top 75%',
                },
                y: 80,
                opacity: 0,
                duration: 1.2,
                ease: 'power3.out',
            });

            gsap.from('.lp-problem .lp-section-subtitle', {
                scrollTrigger: {
                    trigger: problemRef.current,
                    start: 'top 70%',
                },
                y: 40,
                opacity: 0,
                duration: 1,
                ease: 'power3.out',
                delay: 0.2,
            });

            // Counter scale-pop
            gsap.from('.lp-counter', {
                scrollTrigger: {
                    trigger: problemRef.current,
                    start: 'top 60%',
                },
                scale: 0.5,
                opacity: 0,
                duration: 0.8,
                ease: 'back.out(2)',
            });

            // ──── Solution — staggered explainer steps ────
            gsap.from('.lp-explainer-step', {
                scrollTrigger: {
                    trigger: solutionRef.current,
                    start: 'top 70%',
                },
                x: 40,
                opacity: 0,
                stagger: 0.15,
                duration: 0.6,
                ease: 'power3.out',
            });

            gsap.from('.lp-solution-preview', {
                scrollTrigger: {
                    trigger: solutionRef.current,
                    start: 'top 65%',
                },
                x: 100,
                opacity: 0,
                duration: 1,
                ease: 'power3.out',
                delay: 0.3,
            });

            // ──── Comparison — dramatic split ────
            gsap.from('.lp-compare-banner', {
                scrollTrigger: {
                    trigger: compareRef.current,
                    start: 'top 75%',
                    end: 'top 30%',
                    scrub: 1,
                },
                scale: 0.85,
                opacity: 0,
            });

            gsap.from('.lp-compare-without', {
                scrollTrigger: {
                    trigger: compareRef.current,
                    start: 'top 60%',
                },
                x: -100,
                opacity: 0,
                duration: 1,
                ease: 'power3.out',
            });
            gsap.from('.lp-compare-with', {
                scrollTrigger: {
                    trigger: compareRef.current,
                    start: 'top 60%',
                },
                x: 100,
                opacity: 0,
                duration: 1,
                ease: 'power3.out',
                delay: 0.15,
            });

            // ──── Social proof — stats scale pop ────
            gsap.from('.lp-stat', {
                scrollTrigger: {
                    trigger: proofRef.current,
                    start: 'top 75%',
                },
                scale: 0,
                opacity: 0,
                stagger: 0.1,
                duration: 0.7,
                ease: 'back.out(2)',
            });

            // ──── Pricing — cinematic rise ────
            gsap.from('.lp-plan-card', {
                scrollTrigger: {
                    trigger: pricingRef.current,
                    start: 'top 70%',
                },
                y: 100,
                opacity: 0,
                stagger: 0.15,
                duration: 0.9,
                ease: 'power3.out',
            });

            // ──── Final CTA — dramatic scale entrance ────
            gsap.from('.lp-final-headline', {
                scrollTrigger: {
                    trigger: finalRef.current,
                    start: 'top 70%',
                },
                scale: 0.8,
                y: 60,
                opacity: 0,
                duration: 1.2,
                ease: 'power3.out',
            });

            // Section labels — slide in
            gsap.utils.toArray<HTMLElement>('.lp-section-label').forEach((label) => {
                gsap.from(label, {
                    scrollTrigger: {
                        trigger: label,
                        start: 'top 85%',
                    },
                    y: 20,
                    opacity: 0,
                    duration: 0.6,
                    ease: 'power2.out',
                });
            });

        }, containerRef);

        return () => {
            ctx.revert();
            if ((window as any).__lp_raf) {
                cancelAnimationFrame((window as any).__lp_raf);
            }
        };
    }, []);

    // ── Navigation helpers ──
    const scrollTo = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
        ref.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const goAuth = useCallback(() => navigate('/login'), [navigate]);

    return (
        <div className="landing-page" ref={containerRef}>
            {/* ─── Scroll Progress Bar ──────────────────── */}
            <div className="lp-scroll-progress" style={{ width: `${scrollProgress}%` }} />

            {/* ─── Cinematic Overlays ──────────────────────── */}
            <div className="lp-film-grain" />
            <div className="lp-letterbox lp-letterbox--top" />
            <div className="lp-letterbox lp-letterbox--bottom" />

            {/* ─── Navbar ──────────────────────────────────── */}
            <nav className={`lp-navbar ${navScrolled ? 'scrolled' : ''}`}>
                <img src="/korex-logotipo.svg" alt="KoreX" className="lp-nav-logo-img" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
                <div className="lp-nav-links">
                    <button className="lp-nav-link desktop-only" onClick={() => scrollTo(solutionRef)}>
                        {copy.nav.features[L]}
                    </button>
                    <button className="lp-nav-link desktop-only" onClick={() => scrollTo(pricingRef)}>
                        {copy.nav.pricing[L]}
                    </button>
                    <button
                        className="lp-lang-toggle"
                        onClick={() => setLanguage(L === 'en' ? 'es' : 'en')}
                        aria-label="Toggle language"
                        title={L === 'en' ? 'Cambiar a Español' : 'Switch to English'}
                    >
                        <span className={L === 'en' ? 'active' : ''}>EN</span>
                        <span className="lp-lang-divider">/</span>
                        <span className={L === 'es' ? 'active' : ''}>ES</span>
                    </button>
                    <button className="lp-nav-cta" onClick={goAuth}>
                        {copy.hero.cta[L]}
                    </button>
                </div>
            </nav>

            {/* ═══ 0. SCROLLY HERO INTRO (Replaces static hero) ═══════════ */}
            <ScrollyHeroIntro />

            {/* ═══ 2. PROBLEM — Text LEFT, Image RIGHT ═════ */}
            <section className="lp-section lp-problem" ref={problemRef}>
                <span className="lp-section-label">{copy.problem.label[L]}</span>

                <div className="lp-split lp-split--text-left">
                    {/* Left: Text + counter */}
                    <div className="lp-split-text">
                        <h2 className="lp-section-title" style={{ textAlign: 'left' }}>{copy.problem.title[L]}</h2>
                        <p className="lp-section-subtitle" style={{ textAlign: 'left' }}>{copy.problem.subtitle[L]}</p>
                        <div className="lp-counter lp-counter-pulse">
                            $1,975
                        </div>
                        <p className="lp-counter-label">
                            {copy.problem.counterLabel[L]}
                        </p>
                    </div>
                    {/* Right: Interactive Debt Mountain SVG */}
                    <div className="lp-split-media">
                        <DebtVisualizerSVG
                            className="lp-split-img lp-tilt-card"
                            style={{ transformStyle: 'preserve-3d' }}
                        />
                    </div>
                </div>
            </section>

            {/* ═══ 3. SOLUTION — Image LEFT, Cards RIGHT ════ */}
            <section className="lp-section lp-solution" ref={solutionRef}>
                <span className="lp-section-label">{copy.solution.label[L]}</span>
                <h2 className="lp-section-title">{copy.solution.title[L]}</h2>
                <p className="lp-section-subtitle">{copy.solution.subtitle[L]}</p>

                <div className="lp-split lp-split--img-left">
                    {/* Left: Interactive Mobile SVG Preview */}
                    <div className="lp-split-media lp-solution-preview">
                        <MobileAppSVG
                            className="lp-split-img lp-solution-preview-img lp-tilt-card"
                            style={{ transformStyle: 'preserve-3d', maxHeight: '600px' }}
                        />
                    </div>
                    {/* Right: Nerd-mode explanation */}
                    <div className="lp-split-text lp-solution-explainer">
                        <h3 className="lp-explainer-heading">
                            {L === 'es' ? '¿Cómo funciona?' : 'How does it work?'}
                        </h3>

                        <div className="lp-explainer-steps">
                            <div className="lp-explainer-step">
                                <span className="lp-step-number">1</span>
                                <div>
                                    <strong>{L === 'es' ? '📊 GPS de Cashflow' : '📊 Cashflow GPS'}</strong>
                                    <p>{L === 'es'
                                        ? 'La IA analiza tus ingresos, gastos y balances de deuda para crear un mapa completo de tu flujo de dinero.'
                                        : 'AI analyzes your income, expenses and debt balances to create a complete map of your money flow.'
                                    }</p>
                                </div>
                            </div>

                            <div className="lp-explainer-step">
                                <span className="lp-step-number">2</span>
                                <div>
                                    <strong>{L === 'es' ? '🛡️ Escudo de Paz' : '🛡️ Peace Shield'}</strong>
                                    <p>{L === 'es'
                                        ? 'Primero construye un buffer de emergencia de 2-3 meses. Nunca atacas deuda desde una posición de riesgo.'
                                        : 'First builds a 2-3 month emergency buffer. You never attack debt from a position of risk.'
                                    }</p>
                                </div>
                            </div>

                            <div className="lp-explainer-step">
                                <span className="lp-step-number">3</span>
                                <div>
                                    <strong>{L === 'es' ? '⚔️ Motor de Ataque' : '⚔️ Attack Engine'}</strong>
                                    <p>{L === 'es'
                                        ? 'Usa tu línea de crédito como arma: deposita tu sueldo → paga tus deudas con la línea → reduce capital + interés. Cada "ataque" puede ahorrarte $200-$2,000.'
                                        : 'Uses your credit line as a weapon: deposit paycheck → pay debts with the line → reduce principal + interest. Each "attack" can save you $200-$2,000.'
                                    }</p>
                                </div>
                            </div>

                            <div className="lp-explainer-step">
                                <span className="lp-step-number">4</span>
                                <div>
                                    <strong>{L === 'es' ? '🎖️ Libertad Financiera' : '🎖️ Financial Freedom'}</strong>
                                    <p>{L === 'es'
                                        ? 'Proyecciones a 90 días te muestran exactamente cuándo muere cada deuda. Verás tu fecha de libertad desde el día uno.'
                                        : '90-day projections show you exactly when each debt dies. You\'ll see your freedom date from day one.'
                                    }</p>
                                </div>
                            </div>
                        </div>

                        <div className="lp-explainer-insight">
                            <span className="lp-insight-icon">💡</span>
                            <p>{L === 'es'
                                ? 'La clave: los bancos cobran interés sobre el capital. Al reducir el capital agresivamente con pagos chunk, el interés que pagas se desploma. Es la misma matemática que usan ellos — pero invertida.'
                                : 'The key: banks charge interest on principal. By aggressively reducing principal with chunk payments, the interest you pay plummets. Same math they use — but reversed.'
                            }</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ 4. COMPARISON — Image RIGHT, Text LEFT ═══ */}
            <section className="lp-section lp-comparison" ref={compareRef}>
                <span className="lp-section-label">{copy.compare.label[L]}</span>
                <h2 className="lp-section-title">{copy.compare.title[L]}</h2>

                <div className="lp-split lp-split--text-left">
                    {/* Left: Comparison columns */}
                    <div className="lp-split-text">
                        <div className="lp-compare-grid">
                            <div className="lp-compare-column lp-compare-without">
                                <h3 className="lp-compare-col-heading" style={{ color: '#fb7185' }}>
                                    ✗ {copy.compare.without.heading[L]}
                                </h3>
                                {copy.compare.without.items.map((item, i) => (
                                    <div className="lp-compare-item" key={i}>
                                        <span style={{ color: '#fb7185', flexShrink: 0 }}>✗</span>
                                        <span style={{ color: '#94a3b8' }}>{item[L]}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="lp-compare-divider">→</div>

                            <div className="lp-compare-column lp-compare-with">
                                <h3 className="lp-compare-col-heading" style={{ color: '#34d399' }}>
                                    ✓ {copy.compare.with.heading[L]}
                                </h3>
                                {copy.compare.with.items.map((item, i) => (
                                    <div className="lp-compare-item" key={i}>
                                        <span style={{ color: '#34d399', flexShrink: 0 }}>✓</span>
                                        <span>{item[L]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* Right: Interactive Comparison Graph SVG */}
                    <div className="lp-split-media">
                        <ComparisonGraphSVG
                            className="lp-split-img lp-compare-banner-img lp-tilt-card"
                            style={{ transformStyle: 'preserve-3d' }}
                        />
                    </div>
                </div>
            </section>

            {/* ═══ 5. SOCIAL PROOF ══════════════════════════ */}
            <section className="lp-section lp-proof" ref={proofRef}>
                <span className="lp-section-label">{copy.proof.label[L]}</span>
                <div className="lp-stats-row">
                    {copy.proof.stats.map((s, i) => (
                        <div className="lp-stat lp-stat-animated" key={i} style={{ animationDelay: `${i * 0.15}s` }}>
                            <div className="lp-stat-number">{s.value}</div>
                            <div className="lp-stat-label">{s.label[L]}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══ 6. PRICING ═══════════════════════════════ */}
            <section className="lp-section lp-pricing" ref={pricingRef}>
                <span className="lp-section-label">{copy.pricing.label[L]}</span>
                <h2 className="lp-section-title">{copy.pricing.title[L]}</h2>
                <p className="lp-section-subtitle">{copy.pricing.subtitle[L]}</p>

                <div className="lp-pricing-grid">
                    {copy.pricing.plans.map((plan, i) => (
                        <div className={`lp-plan-card ${plan.popular ? 'popular lp-animated-border' : ''} lp-spotlight-card`} key={i}>
                            {plan.popular && plan.badge && (
                                <div className="lp-plan-badge">{plan.badge[L]}</div>
                            )}
                            <div className="lp-plan-name">{plan.name}</div>
                            <div className="lp-plan-accounts">{plan.accounts[L]}</div>
                            <div className="lp-plan-price-row">
                                <span className="lp-plan-price">
                                    {typeof plan.price === 'string' ? plan.price : plan.price[L]}
                                </span>
                                {plan.period[L] && (
                                    <span className="lp-plan-period">{plan.period[L]}</span>
                                )}
                            </div>
                            {plan.originalPrice && (
                                <div className="lp-plan-original-price">
                                    <span className="lp-plan-strikethrough">{plan.originalPrice}/mo</span>
                                    {plan.discount && (
                                        <span className="lp-plan-discount">{plan.discount[L]}</span>
                                    )}
                                </div>
                            )}
                            {plan.billedNote && (
                                <div className="lp-plan-billed">{plan.billedNote[L]}</div>
                            )}

                            {/* Savings box */}
                            <div className="lp-plan-savings-box">
                                <div className="lp-plan-savings-value">{plan.savings[L]}</div>
                            </div>

                            {plan.roi && (
                                <div className="lp-plan-roi">{plan.roi[L]}</div>
                            )}

                            <ul className="lp-plan-features">
                                {plan.features.map((feat, j) => (
                                    <li key={j}>
                                        <span style={{ color: '#22c55e' }}>✓</span>
                                        {feat[L]}
                                    </li>
                                ))}
                            </ul>
                            <button
                                className={`lp-plan-cta ${plan.popular ? 'primary' : ''}`}
                                onClick={goAuth}
                            >
                                {plan.cta[L]}
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══ 7. FINAL CTA ═════════════════════════════ */}
            <section className="lp-section lp-final" ref={finalRef}>
                {/* Background SVG celebration layer */}
                <div className="lp-final-bg" style={{ overflow: 'hidden' }}>
                    <SimpleFreedomSVG className="lp-final-bg-svg" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                </div>

                <h2 className="lp-final-headline">
                    {copy.final.title[L][0]}
                    <br />
                    <span className="lp-gradient-text lp-shimmer-text">{copy.final.title[L][1]}</span>
                </h2>
                <div style={{
                    marginTop: '3rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.25rem',
                }}>
                    <button ref={magneticCtaRef} className="lp-hero-cta lp-pulse-glow lp-magnetic-btn" onClick={goAuth}>
                        {copy.final.cta[L]} →
                    </button>
                    <p className="lp-final-sub">
                        {copy.final.sub[L]}
                    </p>
                </div>
            </section>

            {/* ─── Footer ──────────────────────────────────── */}
            <footer className="lp-footer">
                <div className="lp-footer-links">
                    <a className="lp-footer-link" href="/terms">{copy.footer.terms[L]}</a>
                    <a className="lp-footer-link" href="/privacy">{copy.footer.privacy[L]}</a>
                </div>
                <p className="lp-footer-copy">{copy.footer.copy}</p>
            </footer>
        </div>
    );
}
