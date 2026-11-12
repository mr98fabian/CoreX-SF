/**
 * Ajustes → KoreX con tu IA: the paid tutorial ("usa la app CON tu IA").
 * Gate: useEffectivePlan (server status only). Starter, demo or no answer = locked
 * view with what it includes + CTA to Planes. Paid/founder = the AI Pack guide.
 * Content mirrors the house instructions the MCP server ships (mcp/korex_mcp.py).
 */
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useEffectivePlan } from '@/hooks/useEffectivePlan';
import { AmberRule, BankHeader, Section, StatePhrase } from '@/components/kx';
import { AIKit } from '@/components/AIKit';

type Step = { es: [string, string]; en: [string, string] };

const STEPS: Step[] = [
    {
        es: ['Qué hace tu IA conectada', 'Tu IA lee tus cuentas y tu plan con tu token, te dice cuánto pagar y antes de qué corte, simula compras y registra pagos que tú le confirmas. Se presenta con el nombre que le pongas y habla con el tono de tu perfil.'],
        en: ['What your connected AI does', 'Your AI reads your accounts and plan with your token, tells you how much to pay and before which cut, simulates purchases and records payments you confirm. It goes by the name you give it and speaks in your profile’s tone.'],
    },
    {
        es: ['Crea tu token kx_', 'Ajustes → Conecta tu IA: ponle nombre, marca solo los permisos que quieras darle y toca Crear. El token empieza con kx_ y se muestra una sola vez: cópialo en ese momento. Lo puedes revocar cuando quieras y deja de funcionar al instante.'],
        en: ['Create your kx_ token', 'Settings → Connect your AI: name it, tick only the permissions you want to give, tap Create. The token starts with kx_ and is shown once: copy it right then. Revoke it anytime and it stops working instantly.'],
    },
    {
        es: ['Conecta tu IA (MCP)', 'Agrega el servidor KoreX (MCP) a tu asistente — Claude Desktop, Claude Code o cualquier cliente MCP — con tu token en KOREX_API_TOKEN. Solo ve tus datos y solo con los permisos de ese token.'],
        en: ['Connect your AI (MCP)', 'Add the KoreX server (MCP) to your assistant — Claude Desktop, Claude Code or any MCP client — with your token in KOREX_API_TOKEN. It only sees your data, only with that token’s permissions.'],
    },
    {
        es: ['Primera sincronización y primera misión', 'Al conectarse por primera vez te dice tus horas de sincronización. Después, una idea y una misión por mensaje: la primera suele ser revisar tu próximo corte.'],
        en: ['First sync and first mission', 'On first connect it tells you your sync hours. Then one idea and one mission per message: the first is usually your next cut.'],
    },
    {
        es: ['Avisos de corte y chequeo semanal', 'Te avisa 2 días antes de cada corte (el último día útil para pagar es corte − 2) y hace una revisión semanal el día que cobras. Máximo 1 aviso al día y silencio de 21:30 a 07:00.'],
        en: ['Cut alerts and weekly check', 'It warns you 2 days before each cut (the last useful day to pay is cut − 2) and does a weekly review on your payday. At most 1 alert a day, quiet from 21:30 to 07:00.'],
    },
];

const INCLUDES = {
    es: ['Tu IA conectada a KoreX con token kx_ y permisos que tú eliges', 'Avisos antes de cada corte y revisión semanal', 'Registro de pagos que tú confirmas', 'Simulaciones de compra con tus números reales'],
    en: ['Your AI connected to KoreX with a kx_ token and permissions you choose', 'Alerts before every cut and a weekly review', 'Recording of payments you confirm', 'Purchase simulations with your real numbers'],
};

export default function IAGuidePage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'KoreX con tu IA' : 'KoreX with your AI');
    const { loading, paid } = useEffectivePlan();

    return (
        <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-6 px-5 pt-6">
                <BankHeader title={es ? 'KoreX con tu IA' : 'KoreX with your AI'} greeting={es ? 'usa la app con tu IA' : 'use the app with your AI'} />
                <AmberRule />

                {loading && <div className="h-40 animate-pulse rounded-[20px] bg-kx-surface" aria-busy="true" data-testid="ia-loading" />}

                {!loading && !paid && (
                    <div data-testid="ia-locked" className="space-y-6">
                        <StatePhrase>{es ? 'Esta guía es del plan pago: conecta tu IA cuando pagues.' : 'This guide is for the paid plan: connect your AI when you pay.'}</StatePhrase>
                        <Section tone="neutral" title={es ? 'Qué incluye' : 'What it includes'}>
                            <ul className="space-y-2.5">
                                {INCLUDES[es ? 'es' : 'en'].map((line) => (
                                    <li key={line} className="flex items-start gap-2.5 text-[14px] text-kx-ink2">
                                        <Lock className="mt-0.5 h-4 w-4 flex-none text-kx-ink3" strokeWidth={1.75} aria-hidden="true" />{line}
                                    </li>
                                ))}
                            </ul>
                        </Section>
                        <Link to="/dashboard/settings/plans" className="kx-press block rounded-2xl bg-kx-amber py-3.5 text-center text-[15px] font-bold text-[#111418]">
                            {es ? 'Ver planes' : 'See plans'}
                        </Link>
                    </div>
                )}

                {!loading && paid && (
                    <div data-testid="ia-guide" className="space-y-6">
                        <StatePhrase tone="amber">{es ? 'Tu IA opera tu KoreX contigo. Tú decides; ella te acompaña.' : 'Your AI runs your KoreX with you. You decide; it keeps you company.'}</StatePhrase>
                        <ol className="space-y-3">
                            {STEPS.map((s, i) => {
                                const [title, body] = es ? s.es : s.en;
                                return (
                                    <li key={title} className="flex gap-3.5 rounded-[18px] border border-kx-line bg-kx-surface p-4 shadow-[var(--kx-elev-1)]">
                                        <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-kx-amber text-[13px] font-bold text-[#111418]">{i + 1}</span>
                                        <span className="min-w-0">
                                            <span className="block text-[15px] font-semibold text-kx-ink">{title}</span>
                                            <span className="mt-1 block text-[13px] leading-relaxed text-kx-ink2">{body}</span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                        <Section tone="amber" title={es ? 'La regla de oro' : 'The golden rule'}>
                            <p className="text-[14px] leading-relaxed text-kx-ink">
                                {es ? 'La IA nunca mueve dinero. KoreX registra y planea; los pagos los haces tú en tu banco, y un pago solo se registra con tu captura o tu confirmación escrita. Tú apruebas todo.'
                                    : 'The AI never moves money. KoreX records and plans; you make payments in your bank, and a payment is recorded only with your screenshot or written confirmation. You approve everything.'}
                            </p>
                            <p className="mt-2 text-[12.5px] text-kx-ink3">{es ? 'Toda cifra que te dé es una estimación.' : 'Every figure it gives you is an estimate.'}</p>
                        </Section>
                        {/* Same kit as Conecta tu IA, with <TU_TOKEN> for whoever created their token before */}
                        <AIKit es={es} />
                        <Link to="/dashboard/settings#ia" className="kx-press block rounded-2xl bg-kx-amber py-3.5 text-center text-[15px] font-bold text-[#111418]">
                            {es ? 'Crear mi token' : 'Create my token'}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
