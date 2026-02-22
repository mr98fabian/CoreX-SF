import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { useLanguage } from '@/contexts/LanguageContext';

interface Transaction {
    id: number;
    account_id: number;
    date: string;
    amount: number;
    description: string;
    category: string;
}

export default function RecentTransactions() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const { formatDateShort } = useFormatMoney();
    const { t } = useLanguage();

    useEffect(() => {
        apiFetch<Transaction[]>('/api/transactions/recent?limit=8')
            .then(data => {
                setTransactions(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching transactions:", err);
                setTransactions([]);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 h-full">
                <CardContent className="flex items-center justify-center p-12 h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500" strokeWidth={1.5} />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 h-full">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-slate-800 dark:text-slate-100">{t('dashboard.recentTx.title')}</CardTitle>
                <Badge variant="outline" className="text-xs border-slate-300 dark:border-slate-700 text-slate-500 font-normal">
                    Real-time Sync
                </Badge>
            </CardHeader>
            <CardContent className="space-y-1">
                {transactions.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 italic">
                        No transactions found. Connect a bank and sync to see data.
                    </div>
                ) : (
                    transactions.map((tx) => (
                        <div
                            key={tx.id}
                            className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900/40 transition-colors cursor-pointer"
                        >
                            {/* Date */}
                            <span className="font-mono text-slate-500 text-[11px] w-10 shrink-0 leading-tight text-center">
                                {formatDateShort(tx.date)}
                            </span>

                            {/* Description + Category */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                                    {tx.description}
                                </p>
                                <Badge variant="secondary" className="mt-0.5 bg-slate-800 text-slate-400 hover:bg-slate-700 text-[10px] px-1.5 py-0">
                                    {tx.category}
                                </Badge>
                            </div>

                            {/* Amount */}
                            <span className={`font-mono font-semibold text-sm shrink-0 ${tx.amount > 0 ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-100'}`}>
                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
