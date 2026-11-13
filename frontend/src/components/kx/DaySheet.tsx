/**
 * The day sheet: tap a calendar day → what happens that day, in plain Spanish.
 * Order: the date as you'd say it (+ HOY), the projected debt (labeled
 * "Proyección": daily values are interpolated from the monthly engine), COBRAS
 * (blue), TE COBRAN (bills · minimums due · cards that close), and ONE closing
 * hero: "Ese día entran $X y salen $Y". Data comes from the server's month
 * (GET /api/calendar/events, mapped by lib/calendarEvents.toDayDetail): the same
 * functions as the daily mission, so a cut's "pay by" date is the mission's.
 */
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import type { DayDetail } from '@/lib/calendarSeries';
import { Raccoon } from '@/components/kx';
import { AccountLogo } from '@/components/AccountLogo';
import { useAccountLogos } from '@/hooks/useAccounts';
import { Link } from 'react-router-dom';
import { cardHint } from '@/features/subscriptions/subscriptionText';

const DAYS = { es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
const MONTHS = {
    es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

function Row({ name, amount, sub, tone, logo, to }: { name: string; amount: string; sub?: string; tone: 'in' | 'out'; logo?: string | null; to?: string }) {
    const body = (
        <>
            {logo !== undefined && <AccountLogo name={name} src={logo} />}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-kx-ink">{name}</span>
                {sub && <span className="block text-xs text-kx-ink2">{sub}</span>}
            </span>
            <span className={`kx-num whitespace-nowrap text-[15px] font-semibold ${tone === 'in' ? 'text-kx-pay' : 'text-kx-ink'}`}>{amount}</span>
        </>
    );
    const cls = 'flex items-center justify-between gap-3 py-2.5';
    return (
        <li className="border-t border-[var(--kx-line-soft)] first:border-t-0">
            {to ? <Link to={to} className={`kx-press ${cls}`}>{body}</Link> : <div className={cls}>{body}</div>}
        </li>
    );
}

const payByLabel = (iso: string, es: boolean) => {
    const d = new Date(`${iso}T12:00:00`);
    return es ? `${d.getDate()} de ${MONTHS.es[d.getMonth()]}` : `${MONTHS.en[d.getMonth()]} ${d.getDate()}`;
};

export function DaySheet({ detail, onClose, today }: { detail: DayDetail | null; onClose: () => void; today: Date }) {
    const { language } = useLanguage();
    const es = language === 'es';
    const { formatMoney } = useFormatMoney();
    const logoOf = useAccountLogos();
    const d = detail?.date;
    const isToday = !!d && d.toDateString() === today.toDateString();
    const charges = detail ? [...detail.expenses, ...detail.minimums.map((m) => ({ ...m, sub: es ? 'pago mínimo vence hoy' : 'minimum payment due' }))] : [];
    const subs = detail?.subscriptions ?? [];
    const quiet = detail && !detail.incoming.length && !charges.length && !subs.length && !detail.cuts.length;

    return (
        <Sheet open={!!detail} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="bottom"
                className="kx-scope max-h-[86dvh] overflow-y-auto rounded-t-3xl border-kx-line bg-kx-sheet data-[state=open]:duration-[480ms] data-[state=closed]:duration-[240ms]">
                {detail && d && (
                    <div className="mx-auto max-w-xl space-y-5 pb-4">
                        <SheetHeader className="text-left">
                            <SheetTitle className="flex items-center gap-2.5 font-editorial text-[24px] font-[460] text-kx-ink">
                                {es ? `${DAYS.es[d.getDay()]} ${d.getDate()} de ${MONTHS.es[d.getMonth()]}` : `${DAYS.en[d.getDay()]}, ${MONTHS.en[d.getMonth()]} ${d.getDate()}`}
                                {isToday && <span className="kx-tech rounded bg-kx-amber px-1.5 py-0.5 text-[10px] font-bold text-kx-on-amber">{es ? 'HOY' : 'TODAY'}</span>}
                            </SheetTitle>
                            <SheetDescription className="text-kx-ink2">
                                {es ? 'Proyección de tu deuda ese día: ' : 'Projected debt that day: '}
                                <b className="kx-num text-kx-ink">≈ {formatMoney(Math.round(detail.projected)).replace(/[.,]00$/, '')}</b>
                                <span className="block text-[11px] text-kx-ink3">{es ? 'Estimación del plan, no un saldo exacto.' : 'A plan estimate, not an exact balance.'}</span>
                            </SheetDescription>
                        </SheetHeader>

                        {detail.incoming.length > 0 && (
                            <section>
                                <p className="kx-label mb-1 text-kx-pay">{es ? 'Cobras' : 'You get paid'}</p>
                                <ul>{detail.incoming.map((l, i) => <Row key={i} name={l.name} amount={`+${formatMoney(l.amount)}`} tone="in" />)}</ul>
                            </section>
                        )}

                        {(charges.length > 0 || subs.length > 0 || detail.cuts.length > 0) && (
                            <section>
                                <p className="kx-label mb-1">{es ? 'Te cobran' : 'You get charged'}</p>
                                <ul>
                                    {charges.map((l, i) => <Row key={`c${i}`} name={l.name} amount={`−${formatMoney(l.amount)}`} sub={'sub' in l ? (l.sub as string) : undefined} tone="out" logo={'sub' in l ? logoOf(l.name) : undefined} />)}
                                    {subs.map((x, i) => (
                                        <Row key={`s${x.id}-${i}`} name={x.name} amount={`−${formatMoney(x.amount)}`} tone="out" logo={x.logo_url} to="/dashboard/subscriptions"
                                            sub={[es ? 'suscripción' : 'subscription', cardHint(x.account_name)].filter(Boolean).join(' · ')} />
                                    ))}
                                    {detail.cuts.map((c, i) => (
                                        <Row key={`k${i}`} name={es ? `Corta la ${c.name}` : `${c.name} closes`} amount={formatMoney(c.balance)}
                                            sub={[es ? 'que reporte en $0: este es su saldo hoy' : 'make it report $0: this is its balance today',
                                                c.payBy && (es ? `Paga a más tardar el ${payByLabel(c.payBy, true)}` : `Pay by ${payByLabel(c.payBy, false)}`)].filter(Boolean).join(' · ')}
                                            tone="out" logo={logoOf(c.name)} />
                                    ))}
                                </ul>
                            </section>
                        )}

                        <div className="rounded-2xl border border-kx-line bg-kx-bg p-4">
                            {quiet ? (
                                <p className="flex items-center gap-3 font-editorial text-[20px] text-kx-ink">
                                    <Raccoon moment="quiet" />
                                    {es ? 'Día tranquilo: no entra ni sale nada.' : 'Quiet day: nothing in, nothing out.'}
                                </p>
                            ) : (
                                <p className="text-[15px] leading-snug text-kx-ink2">
                                    {es ? 'Ese día entran ' : 'That day '}<b className="kx-num font-editorial text-[22px] font-[460] text-kx-pay">{formatMoney(detail.totalIn)}</b>
                                    {es ? ' y salen ' : ' comes in and '}<b className="kx-num font-editorial text-[22px] font-[460] text-kx-ink">{formatMoney(detail.totalOut)}</b>{es ? '.' : ' goes out.'}
                                    {detail.cuts.length > 0 && <span className="mt-1 block text-xs text-kx-ink3">{es ? 'El corte no es un cobro: es la meta de reportar $0.' : 'A cut is not a charge: it is the target to report $0.'}</span>}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
