import { useState, useEffect } from 'react';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import { useToast } from '@/components/ui/use-toast';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Tag, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────
interface CategoryData {
    name: string;
    amount: number;
}

interface MonthlyTrend {
    month: string;
    income: number;
    expense: number;
    net: number;
}

interface AnalyticsSummary {
    avg_monthly_spending: number;
    total_3m_spending: number;
    top_category: string;
    top_category_amount: number;
    transaction_count: number;
}

// ─── Category Colors ─────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
    Food: 'bg-orange-500',
    Transport: 'bg-blue-500',
    Entertainment: 'bg-purple-500',
    Shopping: 'bg-pink-500',
    Utilities: 'bg-teal-500',
    Health: 'bg-red-500',
    Housing: 'bg-indigo-500',
    Insurance: 'bg-cyan-500',
    Education: 'bg-emerald-500',
    Uncategorized: 'bg-slate-500',
};

function getCategoryColor(name: string): string {
    return CATEGORY_COLORS[name] || 'bg-amber-500';
}

// ─── Component ─────────────────────────────────────────────
export default function AnalyticsPage() {
    const { t } = useLanguage();
    usePageTitle(t('nav.analytics'));
    const { formatMoney } = useFormatMoney();
    const { toast } = useToast();

    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [categories, setCategories] = useState<CategoryData[]>([]);
    const [trend, setTrend] = useState<MonthlyTrend[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            apiFetch<any>('/api/analytics/summary'),
            apiFetch<any>('/api/analytics/spending-by-category'),
            apiFetch<any>('/api/analytics/monthly-trend'),
        ])
            .then(([summaryData, catData, trendData]) => {
                setSummary(summaryData);
                setCategories(catData.categories || []);
                setTrend(trendData.trend || []);
            })
            .catch((err) => {
                console.error('Analytics load error:', err);
                toast({ title: 'Error', description: 'Failed to load analytics data.', variant: 'destructive' });
            })
            .finally(() => setIsLoading(false));
    }, []);

    // ─── Skeleton ─────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="container mx-auto p-6 space-y-6 max-w-7xl animate-in fade-in duration-500">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-5 w-96" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
            </div>
        );
    }

    // ─── Max bar for scaling the visual chart ─────────────
    const maxCatAmount = categories.length > 0 ? Math.max(...categories.map((c) => c.amount)) : 1;
    const maxTrendVal = trend.length > 0 ? Math.max(...trend.flatMap((t) => [t.income, t.expense])) : 1;

    return (
        <div className="container mx-auto p-6 space-y-8 max-w-7xl animate-in fade-in duration-700 pb-20">
            {/* Header */}
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <BarChart3 className="text-amber-500" size={28} />
                    Analytics
                </h1>
                <p className="text-muted-foreground">
                    Spending insights and financial trends to optimize your velocity strategy.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/30 border-slate-200 dark:border-white/5">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <DollarSign className="text-amber-500" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Avg Monthly Spending</p>
                            <p className="text-2xl font-bold">{formatMoney(summary?.avg_monthly_spending ?? 0)}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/30 border-slate-200 dark:border-white/5">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                            <TrendingDown className="text-red-500" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total 3-Month Spend</p>
                            <p className="text-2xl font-bold">{formatMoney(summary?.total_3m_spending ?? 0)}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/30 border-slate-200 dark:border-white/5">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <Tag className="text-purple-500" size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Top Category</p>
                            <p className="text-2xl font-bold">{summary?.top_category ?? 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">{formatMoney(summary?.top_category_amount ?? 0)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Spending by Category — Horizontal bars */}
            <Card className="border-slate-200 dark:border-white/5">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 size={18} className="text-amber-500" />
                        Spending by Category
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {categories.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No spending data available yet.</p>
                    ) : (
                        categories.map((cat) => {
                            const pct = (cat.amount / maxCatAmount) * 100;
                            return (
                                <div key={cat.name} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium flex items-center gap-2">
                                            <span className={`h-2.5 w-2.5 rounded-full ${getCategoryColor(cat.name)}`} />
                                            {cat.name}
                                        </span>
                                        <span className="text-muted-foreground font-mono">{formatMoney(cat.amount)}</span>
                                    </div>
                                    <div className="h-3 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${getCategoryColor(cat.name)} transition-all duration-700 ease-out`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </CardContent>
            </Card>

            {/* Monthly Trend — Visual "bar chart" */}
            <Card className="border-slate-200 dark:border-white/5">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-500" />
                        Monthly Income vs Expense
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {trend.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No trend data available yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {trend.map((month) => (
                                <div key={month.month} className="space-y-2 p-3 rounded-lg bg-slate-50 dark:bg-white/[0.02]">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-semibold">{month.month}</span>
                                        <span className={`font-mono font-bold flex items-center gap-1 ${month.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {month.net >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                            {formatMoney(Math.abs(month.net))} net
                                        </span>
                                    </div>
                                    {/* Income bar */}
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="w-16 text-emerald-500 font-medium">Income</span>
                                        <div className="flex-1 h-2.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                                                style={{ width: `${(month.income / maxTrendVal) * 100}%` }}
                                            />
                                        </div>
                                        <span className="w-24 text-right font-mono text-muted-foreground">{formatMoney(month.income)}</span>
                                    </div>
                                    {/* Expense bar */}
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="w-16 text-red-500 font-medium">Expense</span>
                                        <div className="flex-1 h-2.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-red-500 rounded-full transition-all duration-700"
                                                style={{ width: `${(month.expense / maxTrendVal) * 100}%` }}
                                            />
                                        </div>
                                        <span className="w-24 text-right font-mono text-muted-foreground">{formatMoney(month.expense)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
