/**
 * Today's single mission, as the server computes it (velocity_engine.get_daily_mission,
 * exposed as `mision` by /api/dashboard and /api/strategy/command-center).
 * Inicio and Plan render THIS card, so the two screens can never disagree.
 * Voice of the house: one mission, one amount, one date. Every figure is an estimate.
 */
import { MoneyAmount } from '@/components/MoneyAmount';
import { Section } from '@/components/kx';

export type MissionType = 'corte' | 'estado' | 'minimo' | 'prestamo' | 'avalancha' | 'faltante';
export interface DailyMission {
    tipo: MissionType;
    cuenta: string;
    monto: number;
    fecha_accion: string;
    fecha_evento: string;
    obligacion?: 'corte' | 'estado' | 'minimo' | 'prestamo';
    copy?: string;
}
export interface MissionResult { mision: DailyMission | null; faltante?: DailyMission | null; reserva: number; ataque: number; objetivo: string | null }

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// YYYY-MM-DD anchored at noon (negative timezones would fall a day back)
const isoDate = (s: string) => new Date(`${s}T12:00:00`);

/** mission = the headline; faltante = the first obligation the cash can't reach (secondary warning). */
export function MissionCard({ mission, faltante, es }: { mission: DailyMission; faltante?: DailyMission | null; es: boolean }) {
    const months = es ? MONTHS_ES : MONTHS_EN;
    const fmt = (s: string) => { const d = isoDate(s); return es ? `${d.getDate()} de ${months[d.getMonth()]}` : `${months[d.getMonth()]} ${d.getDate()}`; };
    const action = isoDate(mission.fecha_accion);
    const X = mission.cuenta;
    const $ = <b className="kx-num font-semibold text-kx-amber-soft"><MoneyAmount value={mission.monto} /></b>;
    const noun = (t?: string) => es
        ? ({ corte: 'el corte', estado: 'el estado', minimo: 'el mínimo', prestamo: 'el pago' } as Record<string, string>)[t ?? ''] ?? ''
        : ({ corte: 'the cut of', estado: 'the statement of', minimo: 'the minimum of', prestamo: 'the payment of' } as Record<string, string>)[t ?? ''] ?? '';

    const [title, body] = (() => {
        switch (mission.tipo) {
            case 'corte': return es
                ? [`Deja la ${X} en $0`, <>Paga {$} a más tardar el {fmt(mission.fecha_accion)} para que reporte $0 el {fmt(mission.fecha_evento)}.</>]
                : [`Take ${X} to $0`, <>Pay {$} by {fmt(mission.fecha_accion)} so it reports $0 on {fmt(mission.fecha_evento)}.</>];
            case 'estado': return es
                ? [`Paga el estado de la ${X}`, <>{$} antes del {fmt(mission.fecha_evento)}.</>]
                : [`Pay the ${X} statement`, <>{$} before {fmt(mission.fecha_evento)}.</>];
            case 'minimo': return es
                ? [`Paga el mínimo de la ${X}`, <>{$} antes del {fmt(mission.fecha_evento)}, según tu estado de cuenta.</>]
                : [`Pay the ${X} minimum`, <>{$} before {fmt(mission.fecha_evento)}, per your statement.</>];
            case 'prestamo': return es
                ? [`Reserva el pago de la ${X}`, <>{$} para el {fmt(mission.fecha_evento)}.</>]
                : [`Set aside the ${X} payment`, <>{$} for {fmt(mission.fecha_evento)}.</>];
            case 'faltante': return es
                ? [`Te faltan fondos`, <>Te faltan {$} para cubrir {noun(mission.obligacion)} de la {X} del {fmt(mission.fecha_evento)}.</>]
                : [`You're short`, <>You need {$} more to cover {noun(mission.obligacion)} {X} on {fmt(mission.fecha_evento)}.</>];
            default: return es
                ? [`Ataca la ${X}`, <>Con {$} hoy.</>]
                : [`Attack ${X}`, <>With {$} today.</>];
        }
    })();

    return (
        <Section tone={mission.tipo === 'faltante' ? 'debt' : 'amber'} title={es ? 'Hoy · tu único pendiente' : 'Today · your one to-do'}>
            <div className="flex items-center gap-4" data-testid="mission" data-tipo={mission.tipo}>
                <div className="flex-none border-r border-[rgba(245,158,11,.3)] pr-4 text-center">
                    <p className="kx-num font-editorial text-2xl text-kx-ink">{action.getDate()}</p>
                    <p className="kx-tech text-[10px] uppercase text-kx-amber-soft">{months[action.getMonth()].slice(0, 3)}</p>
                </div>
                <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-kx-ink" data-testid="mission-title">{title}</p>
                    <p className="text-[13.5px] text-kx-ink2" data-testid="mission-body">{body}</p>
                    <p className="text-[11.5px] text-kx-ink2">{es ? 'Monto estimado con tus datos de hoy.' : 'Estimated from your data today.'}</p>
                    {faltante && mission.tipo !== 'faltante' && (
                        <p data-testid="mission-faltante" className="mt-1.5 text-[12.5px] text-kx-debt">
                            {es
                                ? <>Ojo: te faltan <b className="kx-num font-semibold"><MoneyAmount value={faltante.monto} /></b> para cubrir {noun(faltante.obligacion)} de la {faltante.cuenta} del {fmt(faltante.fecha_evento)}.</>
                                : <>Heads up: you need <b className="kx-num font-semibold"><MoneyAmount value={faltante.monto} /></b> more to cover {noun(faltante.obligacion)} {faltante.cuenta} on {fmt(faltante.fecha_evento)}.</>}
                        </p>
                    )}
                </div>
            </div>
        </Section>
    );
}
