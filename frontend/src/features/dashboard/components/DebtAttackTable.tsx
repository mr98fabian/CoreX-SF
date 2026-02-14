import { useEffect, useState } from "react";
import { ArrowBigRight, ShieldCheck, Zap, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { TransactionDialog } from "./TransactionDialog";
import { apiFetch } from '@/lib/api';

interface Account {
    id: number;
    name: string;
    balance: number;
    apr: number;
    min_payment: number;
    type: string;
}

interface VelocityProjections {
    velocity_amount: number;
    velocity_power: number;
}

const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

export default function DebtAttackTable() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [velocityData, setVelocityData] = useState<VelocityProjections | null>(null);

    useEffect(() => {
        // Fetch Accounts using centralized apiFetch (handles auth + base URL)
        apiFetch<Account[]>("/api/accounts")
            .then((data) => setAccounts(data))
            .catch(() => setAccounts([]));

        // Fetch Velocity Data
        apiFetch<VelocityProjections>("/api/velocity/projections")
            .then((data) => setVelocityData(data))
            .catch(() => setVelocityData(null));
    }, []);

    const totalMinPayments = accounts
        .filter((acc) => acc.type === "debt")
        .reduce((sum, acc) => sum + acc.min_payment, 0);

    const consolidatedDebts = accounts.filter(acc => acc.type === 'debt');

    // Find highest APR debt (Avalanche)
    const velocityTarget = consolidatedDebts.sort((a, b) => b.apr - a.apr)[0];
    const velocityAmount = velocityData?.velocity_amount || 0;

    return (
        <Card className="border-slate-800 bg-slate-950/50 backdrop-blur-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-xl text-white flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
                        Debt Attack Strategy
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                        Avalanche Method: Highest interest debts first.
                    </CardDescription>
                </div>
                <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-500">
                    POWER: {formatMoney(velocityAmount)}/mo
                </Badge>
            </CardHeader>
            <CardContent>
                {consolidatedDebts.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                        <ShieldCheck className="h-12 w-12 mx-auto text-emerald-500 mb-2 opacity-50" />
                        <p>No debts detected. You are free!</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* ACTIVE TARGET */}
                        {velocityTarget && (
                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/10 to-transparent group-hover:translate-x-full duration-1000 transition-transform"></div>

                                <div className="flex justify-between items-start relative mb-4">
                                    <div>
                                        <div className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" /> Priority Target
                                        </div>
                                        <h3 className="text-lg font-bold text-white">{velocityTarget.name}</h3>
                                        <div className="text-sm text-slate-400">{velocityTarget.apr}% APR</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-white">{formatMoney(velocityTarget.balance)}</div>
                                        <div className="text-xs text-zinc-500">Remaining Balance</div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400">Attack Progress</span>
                                            <span className="text-amber-400 font-mono">
                                                {velocityAmount > 0 ? 'ACCELERATED' : 'STANDARD'}
                                            </span>
                                        </div>
                                        <Progress value={35} className="h-2 bg-slate-900" indicatorClassName="bg-amber-500" />
                                    </div>

                                    <TransactionDialog
                                        // Wait, logic in modal: 
                                        // Expense -> -Amount
                                        // Income -> +Amount
                                        // Debt Balance logic in backend: balance -= amount
                                        // So if I send POSITIVE amount, balance reduces.
                                        // So I should use "income" type (visually "Payment")? 
                                        // Or "expense" type (visually "Spend")?
                                        // Let's us "income" type but label as "Payment". 
                                        // OR better, create a new type "payment" in backend? No time.
                                        // I'll use "income" (positive amount) and description "Debt Payment".
                                        defaultType="income"
                                        defaultAccountId={velocityTarget.id.toString()}
                                        defaultAmount={velocityTarget.min_payment + velocityAmount}
                                        defaultDescription={`Velocity Attack on ${velocityTarget.name}`}
                                        onSuccess={() => window.location.reload()}
                                    >
                                        <Button className="bg-amber-600 hover:bg-slate-800 text-white font-bold shadow-lg shadow-amber-900/20 animate-pulse">
                                            PAY {formatMoney(velocityTarget.min_payment + velocityAmount)}
                                            <ArrowBigRight className="ml-1 h-4 w-4" />
                                        </Button>
                                    </TransactionDialog>
                                </div>
                            </div>
                        )}

                        {/* TABLE OF OTHERS */}
                        <div className="rounded-lg border border-zinc-800 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-900/50 text-zinc-400">
                                    <tr className="border-b border-zinc-800">
                                        <th className="py-3 px-4 text-left font-medium">Debt Name</th>
                                        <th className="py-3 px-4 text-left font-medium">APR</th>
                                        <th className="py-3 px-4 text-right font-medium">Balance</th>
                                        <th className="py-3 px-4 text-right font-medium">Min Pay</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-800/50">
                                    {consolidatedDebts.map((account) => (
                                        <tr key={account.id} className="group hover:bg-slate-900/50 transition-colors">
                                            <td className="py-3 px-4 text-white font-medium flex items-center gap-2">
                                                {account.id === velocityTarget?.id && <Zap className="h-3 w-3 text-amber-500" />}
                                                {account.name}
                                            </td>
                                            <td className="py-3 px-4 text-zinc-300">{account.apr}%</td>
                                            <td className="py-3 px-4 text-right text-zinc-300 font-mono">
                                                {formatMoney(account.balance)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-zinc-400">
                                                {formatMoney(account.min_payment)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center text-sm px-2">
                            <span className="text-zinc-500">Total Monthly Commitments</span>
                            <span className="text-rose-400 font-bold">{formatMoney(totalMinPayments)}/mo</span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
