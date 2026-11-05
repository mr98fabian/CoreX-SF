/**
 * Landing (Fase 6) in unison with the app: same tokens, stripe, fonts and data
 * rules. Sober hero with THE CALENDAR as the public demo (example data,
 * labeled), the plan table from the same source as the app (server limits +
 * billing prices), the founder story and a sourced competitor comparison.
 * Wide on desktop, one column on mobile.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, ListChecks, Wallet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { buildMonths } from '@/lib/calendarSeries';
import { DebtCalendar } from '@/components/kx/DebtCalendar';
import { PlanCards } from '@/components/kx/PlanCards';
import { AmberRule, Section } from '@/components/kx';
import { VelocityCalculatorModal } from './VelocityCalculatorModal';

// Example data only (fictional), shown labeled as such: a plan that goes from
// ~$28K to $0 in five months, as in the approved preview.
const EXAMPLE_START = 28451;
const EXAMPLE_TIMELINE = [23900, 18600, 13100, 7300, 0];

export default function KxLanding() {
    const { language, setLanguage } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Tu deuda, pintada en el tiempo' : 'Your debt, painted on time');
    const navigate = useNavigate();
    const [calcOpen, setCalcOpen] = useState(false);

    const months = useMemo(() => {
        const now = new Date();
        const timeline = EXAMPLE_TIMELINE.map((total_balance, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, total_balance };
        });
        return buildMonths(timeline, EXAMPLE_START, now);
    }, []);
    // Example paydays: every other Friday
    const paydays = (y: number, m: number) => {
        const set = new Set<number>();
        for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
            const date = new Date(y, m, d);
            if (date.getDay() === 5 && Math.floor(date.getTime() / (7 * 864e5)) % 2 === 0) set.add(d);
        }
        return set;
    };

    const steps = [
        { icon: Wallet, t: es ? 'Anota tus deudas' : 'Add your debts', d: es ? 'Tarjetas, préstamos y tu cuenta de cheques. Sin conectar tu banco si no quieres.' : 'Cards, loans and your checking account. No bank link required.' },
        { icon: ListChecks, t: es ? 'KoreX arma tu ruta' : 'KoreX builds your route', d: es ? 'Te dice qué deuda atacar primero y con cuánto, un día a la vez.' : 'It tells you which debt to attack first and with how much, one day at a time.' },
        { icon: CalendarDays, t: es ? 'Mira el rojo volverse verde' : 'Watch red turn green', d: es ? 'Tu calendario muestra tu deuda en el tiempo hasta el día en que llega a $0.' : 'Your calendar shows your debt over time until the day it hits $0.' },
    ];

    return (
        <div className="kx-scope min-h-[100dvh]">
            {/* Top bar */}
            <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
                <img src="/korex-logotipo.svg" alt="KoreX" className="h-9" />
                <nav className="flex items-center gap-3 text-sm">
                    <button onClick={() => setLanguage(es ? 'en' : 'es')} className="rounded-full border border-kx-line px-3 py-1.5 text-xs font-semibold text-kx-ink2" aria-label={es ? 'Cambiar a inglés' : 'Switch to Spanish'}>
                        {es ? 'EN' : 'ES'}
                    </button>
                    <Link to="/login" className="font-semibold text-kx-ink2 hover:text-kx-ink">{es ? 'Entrar' : 'Sign in'}</Link>
                </nav>
            </header>
            <AmberRule className="mx-auto max-w-6xl" />

            {/* Hero: phrase + editorial headline on the left, the calendar on the right */}
            <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pt-16">
                <div>
                    <p className="kx-label text-kx-amber-soft">{es ? 'Velocity banking, sin letra chica' : 'Velocity banking, no fine print'}</p>
                    <h1 className="mt-4 font-editorial text-[44px] font-[400] leading-[1.02] tracking-tight text-kx-ink sm:text-[58px]">
                        {es ? <>Tu deuda,<br />pintada en el tiempo.</> : <>Your debt,<br />painted on time.</>}
                    </h1>
                    <p className="mt-5 max-w-md text-[16.5px] leading-relaxed text-kx-ink2">
                        {es ? 'Empieza en rojo y se aclara mes a mes, hasta el día en que todo se pone verde. KoreX te dice qué pagar hoy para llegar antes.'
                            : 'It starts red and clears month by month, until the day everything turns green. KoreX tells you what to pay today to get there sooner.'}
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                        <button onClick={() => setCalcOpen(true)} className="rounded-xl bg-kx-amber px-5 py-3 text-sm font-bold text-[#111418]">
                            {es ? 'Calcula tu fecha gratis' : 'Calculate your date free'}
                        </button>
                        <button onClick={() => navigate('/login')} className="rounded-xl border border-kx-line px-5 py-3 text-sm font-semibold text-kx-ink">
                            {es ? 'Probar el demo' : 'Try the demo'}
                        </button>
                    </div>
                    <p className="mt-3 text-xs text-kx-ink3">{es ? 'Sin registro para calcular. Las cifras son estimaciones.' : 'No signup to calculate. Figures are estimates.'}</p>
                </div>
                <Section tone="neutral" title={es ? 'Ejemplo · el color es la deuda' : 'Example · color is debt'}>
                    <DebtCalendar months={months} maxDebt={EXAMPLE_START} paydays={paydays} example />
                </Section>
            </section>

            {/* How it works — 3 steps, one line each */}
            <section className="mx-auto max-w-6xl px-5 pb-16">
                <p className="kx-label">{es ? 'Cómo funciona' : 'How it works'}</p>
                <ol className="mt-5 grid gap-6 md:grid-cols-3">
                    {steps.map(({ icon: Icon, t, d }, i) => (
                        <li key={t} className="border-t border-kx-line pt-5">
                            <span className="flex items-center gap-2.5">
                                <span className="kx-tech text-xs text-kx-amber-soft">0{i + 1}</span>
                                <Icon className="h-5 w-5 text-kx-ink2" strokeWidth={1.75} aria-hidden="true" />
                            </span>
                            <h2 className="mt-3 text-lg font-semibold text-kx-ink">{t}</h2>
                            <p className="mt-1.5 text-sm leading-relaxed text-kx-ink2">{d}</p>
                        </li>
                    ))}
                </ol>
            </section>

            {/* Plans — same source as the app */}
            <section id="planes" className="mx-auto max-w-6xl px-5 pb-16">
                <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
                    <div>
                        <p className="kx-label">{es ? 'Planes' : 'Plans'}</p>
                        <h2 className="mt-3 font-editorial text-[34px] font-[400] leading-tight text-kx-ink">{es ? 'Empieza gratis. Conecta tu IA cuando pagues.' : 'Start free. Connect your AI when you pay.'}</h2>
                        <p className="mt-3 text-sm leading-relaxed text-kx-ink2">
                            {es ? 'El plan anual equivale a 2 meses gratis. Cancela cuando quieras.' : 'The annual plan equals 2 months free. Cancel anytime.'}
                        </p>
                    </div>
                    <PlanCards onChoose={() => navigate('/login')} ctaLabel={(p) => (es ? `Empezar con ${p.name}` : `Start with ${p.name}`)} />
                </div>
            </section>

            {/* Founder story + sourced comparison */}
            <section className="mx-auto max-w-3xl px-5 pb-20">
                <p className="kx-label">{es ? 'Nuestra historia' : 'Our story'}</p>
                <p className="mt-4 font-editorial text-[24px] font-[400] leading-snug text-kx-ink">
                    {es ? 'KoreX nació de una deuda real. Nuestro fundador está saliendo de sus propias deudas con este mismo sistema, paso a paso.'
                        : 'KoreX was born from real debt. Our founder is getting out of his own debt with this very system, step by step.'}
                </p>
                <p className="mt-3 text-[15px] leading-relaxed text-kx-ink2">
                    {es ? 'Sin gurús ni programas de miles de dólares: los trucos que usan los que saben de dinero, a un precio justo.'
                        : 'No gurus, no thousand-dollar programs: the tricks people who know money use, at a fair price.'}
                </p>
                <p className="mt-6 rounded-2xl border border-kx-line bg-kx-surface p-4 text-sm text-kx-ink2">
                    {es ? 'United First Financial cobraba ' : 'United First Financial charged '}<b className="kx-num text-kx-ink">$3,500</b>
                    {es ? ' por su programa (plan de agente, octubre de 2019). KoreX: desde ' : ' for its program (agent plan, October 2019). KoreX: from '}
                    <b className="kx-num text-kx-ink">$9.99</b>{es ? ' al mes.' : ' a month.'}
                </p>
            </section>

            <footer className="border-t border-kx-line">
                <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-kx-ink3 sm:flex-row sm:items-center sm:justify-between">
                    <p>{es ? 'KoreX es una herramienta educativa: todas las cifras son estimaciones, no asesoría financiera.' : 'KoreX is an educational tool: every figure is an estimate, not financial advice.'}</p>
                    <span className="flex gap-4">
                        <Link to="/terms" className="hover:text-kx-ink2">{es ? 'Términos' : 'Terms'}</Link>
                        <Link to="/privacy" className="hover:text-kx-ink2">{es ? 'Privacidad' : 'Privacy'}</Link>
                    </span>
                </div>
            </footer>

            <VelocityCalculatorModal open={calcOpen} onOpenChange={setCalcOpen} isEs={es} />
        </div>
    );
}
