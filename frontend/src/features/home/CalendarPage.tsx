/**
 * Calendario — the signature piece with its own section: the full navigable
 * debt calendar (month by month to the freedom month). Same canonical data as
 * Inicio (useKxSummary), so the numbers match.
 */
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useKxSummary } from '@/hooks/useKxSummary';
import { BankHeader, ErrorState, Section } from '@/components/kx';
import { DebtCalendar } from '@/components/kx/DebtCalendar';

export default function CalendarPage() {
    const { language } = useLanguage();
    const es = language === 'es';
    usePageTitle(es ? 'Calendario' : 'Calendar');
    const s = useKxSummary();

    return (
        <div className="kx-scope -m-4 min-h-full pb-8 md:-m-8 lg:pb-10">
            <div className="mx-auto max-w-xl space-y-5 px-5 pt-6">
                <BankHeader title={es ? 'Tu calendario de deuda' : 'Your debt calendar'} />
                {s.loading && <div className="h-[420px] kx-shimmer rounded-[20px]" aria-busy="true" />}
                {s.error && <ErrorState text={es ? 'No pudimos cargar tu calendario.' : "We couldn't load your calendar."} retry={es ? 'Reintentar' : 'Retry'} onRetry={s.reload} />}
                {!s.loading && !s.error && (s.totalDebt <= 0
                    ? <Section tone="paid" title={es ? 'Todo en verde' : 'All green'}>
                        <p className="text-sm text-kx-ink2">{es ? 'No tienes deuda registrada: tu calendario está en verde.' : 'No debt on record: your calendar is green.'}</p>
                    </Section>
                    : <Section tone="neutral" title={es ? 'El color es tu deuda' : 'Color is your debt'}>
                        <DebtCalendar live months={s.months} maxDebt={s.totalDebt} />
                    </Section>)}
            </div>
        </div>
    );
}
