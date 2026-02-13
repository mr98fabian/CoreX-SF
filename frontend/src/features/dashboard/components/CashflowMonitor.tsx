import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming you have a utils file for classnames

// Define types for the API response
interface CashflowData {
    timeframe: string;
    type: 'income' | 'expense';
    total_amount: number;
    transaction_count: number;
}

export default function CashflowMonitor() {
    const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'annual'>('monthly');
    const [type, setType] = useState<'income' | 'expense'>('income');
    const [data, setData] = useState<CashflowData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`http://localhost:8001/api/dashboard/cashflow_monitor?timeframe=${timeframe}&type=${type}`);
                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                } else {
                    console.error('Failed to fetch cashflow data');
                }
            } catch (error) {
                console.error('Error fetching cashflow data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [timeframe, type]);

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    return (
        <Card className="border-zinc-800 bg-zinc-900/50 relative overflow-hidden">
            <div className={cn("absolute top-0 left-0 w-1 h-full transition-colors duration-300",
                type === 'income' ? "bg-emerald-500" : "bg-rose-500")} />

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pl-4">
                <CardTitle className="text-sm font-medium text-zinc-400">
                    {type === 'income' ? 'Total Income' : 'Total Expenses'}
                </CardTitle>
                <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-1 mr-2">
                        <Label htmlFor="mode-toggle" className={cn("text-xs cursor-pointer select-none", type === 'income' ? "text-emerald-500 font-bold" : "text-zinc-500")}>In</Label>
                        <Switch
                            id="mode-toggle"
                            checked={type === 'expense'}
                            onCheckedChange={(checked) => setType(checked ? 'expense' : 'income')}
                            className={cn("data-[state=checked]:bg-rose-500 data-[state=unchecked]:bg-emerald-500")}
                        />
                        <Label htmlFor="mode-toggle" className={cn("text-xs cursor-pointer select-none", type === 'expense' ? "text-rose-500 font-bold" : "text-zinc-500")}>Out</Label>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pl-4">
                <div className="flex justify-between items-baseline mb-4">
                    {loading ? (
                        <Skeleton className="h-8 w-32 bg-zinc-800" />
                    ) : (
                        <div className={cn("text-2xl font-bold transition-colors duration-300",
                            type === 'income' ? "text-emerald-500" : "text-rose-500")}>
                            {data ? formatMoney(data.total_amount) : '$0.00'}
                        </div>
                    )}
                    {type === 'income' ?
                        <TrendingUp className="h-4 w-4 text-emerald-500 opacity-50" strokeWidth={1.5} /> :
                        <TrendingDown className="h-4 w-4 text-rose-500 opacity-50" strokeWidth={1.5} />
                    }
                </div>

                <Tabs defaultValue="monthly" className="w-[400px]" onValueChange={(v) => setTimeframe(v as any)}>
                    <TabsList className="grid w-full grid-cols-4 bg-zinc-800/50 h-8">
                        <TabsTrigger value="daily" className="text-xs data-[state=active]:bg-zinc-700 data-[state=active]:text-white h-6">1D</TabsTrigger>
                        <TabsTrigger value="weekly" className="text-xs data-[state=active]:bg-zinc-700 data-[state=active]:text-white h-6">7D</TabsTrigger>
                        <TabsTrigger value="monthly" className="text-xs data-[state=active]:bg-zinc-700 data-[state=active]:text-white h-6">30D</TabsTrigger>
                        <TabsTrigger value="annual" className="text-xs data-[state=active]:bg-zinc-700 data-[state=active]:text-white h-6">1Y</TabsTrigger>
                    </TabsList>
                </Tabs>

                <p className="text-xs text-zinc-500 mt-3 text-right">
                    {loading ? <Skeleton className="h-3 w-12 bg-zinc-800 ml-auto" /> :
                        `${data?.transaction_count || 0} transactions`}
                </p>
            </CardContent>
        </Card>
    );
}
