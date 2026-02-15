import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
            <Card className="border-slate-800 bg-slate-950/50 h-full">
                <CardContent className="flex items-center justify-center p-12 h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-500" strokeWidth={1.5} />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-slate-800 bg-slate-950/50 h-full">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-slate-800 dark:text-slate-100">{t('dashboard.recentTx.title')}</CardTitle>
                <Badge variant="outline" className="text-xs border-slate-700 text-slate-500 font-normal">
                    Real-time Sync
                </Badge>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="border-slate-800 hover:bg-transparent">
                            <TableHead className="text-slate-500 w-[80px]">Date</TableHead>
                            <TableHead className="text-slate-500">Description</TableHead>
                            <TableHead className="text-slate-500">Category</TableHead>
                            <TableHead className="text-slate-500 text-right">Amount</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-10 text-slate-500 italic">
                                    No transactions found. Connect a bank and sync to see data.
                                </TableCell>
                            </TableRow>
                        ) : (
                            transactions.map((tx) => (
                                <TableRow key={tx.id} className="border-slate-800 hover:bg-slate-900/40 cursor-pointer">
                                    <TableCell className="font-mono text-slate-400 text-xs">{formatDateShort(tx.date)}</TableCell>
                                    <TableCell className="text-slate-800 dark:text-slate-100 font-medium max-w-[200px] truncate">{tx.description}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="bg-slate-800 text-slate-400 hover:bg-slate-700 whitespace-nowrap">
                                            {tx.category}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className={`text-right font-mono font-medium ${tx.amount > 0 ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-100'}`}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
