import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MoneyAmount } from '@/components/MoneyAmount';
import { AssumptionsBreakdown, type ProjectionAssumptions } from '@/components/AssumptionsBreakdown';
import { API_BASE } from '@/lib/api';
import { Loader2, ArrowRight } from 'lucide-react';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isEs: boolean;
}

interface PreviewResult {
    standard_debt_free_date: string;
    velocity_debt_free_date: string;
    months_saved: number;
    years_saved: number;
    interest_saved: number;
    assumptions: ProjectionAssumptions;
}

/**
 * VelocityCalculatorModal — the calculation the landing's "Calculate Your
 * Savings" CTA promises. No signup, no personal data: 3 numbers in, a real
 * projection out from the same engine the authenticated app uses
 * (POST /api/public/velocity-preview). Signup is offered only AFTER the
 * user sees their own number — never before.
 */
export function VelocityCalculatorModal({ open, onOpenChange, isEs }: Props) {
    const navigate = useNavigate();
    const [debtBalance, setDebtBalance] = useState('');
    const [apr, setApr] = useState('');
    const [monthlySurplus, setMonthlySurplus] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<PreviewResult | null>(null);

    const locale = isEs ? 'es-ES' : 'en-US';

    const reset = () => {
        setResult(null);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/api/public/velocity-preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    debt_balance: parseFloat(debtBalance),
                    apr: parseFloat(apr),
                    monthly_surplus: parseFloat(monthlySurplus),
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.detail || `HTTP ${res.status}`);
            }
            setResult(await res.json());
        } catch {
            setError(isEs
                ? 'No pudimos calcularlo. Revisa los números e intenta de nuevo.'
                : "We couldn't calculate this. Check your numbers and try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEs ? 'Calcula tu ahorro' : 'Calculate your savings'}</DialogTitle>
                    <DialogDescription>
                        {isEs
                            ? 'Sin registro. 3 números, tu proyección real.'
                            : 'No signup. 3 numbers, your real projection.'}
                    </DialogDescription>
                </DialogHeader>

                {!result ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="calc-balance">{isEs ? 'Balance total de deuda' : 'Total debt balance'}</Label>
                            <Input id="calc-balance" type="number" min="1" step="0.01" required
                                placeholder="12000" value={debtBalance}
                                onChange={(e) => setDebtBalance(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="calc-apr">{isEs ? 'Tasa de interés (APR %)' : 'Interest rate (APR %)'}</Label>
                            <Input id="calc-apr" type="number" min="0" max="100" step="0.01" required
                                placeholder="22.99" value={apr}
                                onChange={(e) => setApr(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="calc-surplus">{isEs ? 'Excedente mensual disponible' : 'Monthly surplus available'}</Label>
                            <Input id="calc-surplus" type="number" min="1" step="0.01" required
                                placeholder="300" value={monthlySurplus}
                                onChange={(e) => setMonthlySurplus(e.target.value)} />
                        </div>
                        {error && <p className="text-xs text-rose-500">{error}</p>}
                        <Button type="submit" variant="premium" className="w-full" disabled={loading}>
                            {loading
                                ? <Loader2 size={16} className="animate-spin" />
                                : (isEs ? 'Calcular mi fecha' : 'Calculate my date')}
                        </Button>
                    </form>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="text-center py-2">
                            <p className="text-xs text-muted-foreground mb-1">
                                {isEs ? 'Podrías ser libre de deudas en' : 'You could be debt-free by'}
                            </p>
                            <p className="text-3xl font-extrabold font-display tabular-nums text-foreground">
                                {new Date(`${result.velocity_debt_free_date}T12:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                vs.{' '}
                                <span className="line-through">
                                    {new Date(`${result.standard_debt_free_date}T12:00:00`).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                                </span>
                                {' '}{isEs ? 'con pagos mínimos' : 'with minimum payments'}
                            </p>
                        </div>

                        <div className="rounded-xl bg-secondary/40 border border-border p-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">{isEs ? 'Interés total ahorrado (estimado)' : 'Total interest saved (estimate)'}</p>
                            <MoneyAmount value={result.interest_saved} className="text-2xl text-emerald-500" />
                        </div>

                        <AssumptionsBreakdown assumptions={result.assumptions} className="flex flex-col items-center" />

                        <Button
                            variant="premium"
                            className="w-full"
                            onClick={() => {
                                // Handoff to onboarding: prefill the debts step instead of
                                // making the user re-type what they just entered here.
                                sessionStorage.setItem('korex_calc_handoff', JSON.stringify({
                                    debt_balance: debtBalance,
                                    apr,
                                    monthly_surplus: monthlySurplus,
                                }));
                                navigate('/login');
                            }}
                        >
                            {isEs ? 'Crear cuenta gratis para guardar esto' : 'Create a free account to save this'}
                            <ArrowRight size={16} className="ml-1.5" />
                        </Button>
                        <button
                            type="button"
                            onClick={reset}
                            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {isEs ? '← Probar otros números' : '← Try different numbers'}
                        </button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
