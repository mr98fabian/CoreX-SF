import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { apiFetch } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { withPlanLimit } from '@/lib/planLimits';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChartDataPoint {
    month: string;
    bankBalance: number;
    velocityBalance: number;
}

interface VelocityData {
    total_debt: number;
    velocity_power: number;
    total_min_payments: number;
}

// Generate locale-aware month abbreviations starting from current month
const getMonthNames = (locale: string): string[] => {
    const currentMonth = new Date().getMonth();
    const result: string[] = [];
    for (let i = 0; i < 12; i++) {
        const date = new Date(2024, (currentMonth + i) % 12, 1);
        result.push(date.toLocaleString(locale, { month: 'short' }));
    }
    return result;
};

// Generate projection data based on actual debt
const generateProjections = (totalDebt: number, minPayments: number, velocityPower: number, locale = 'en-US'): ChartDataPoint[] => {
    const months = getMonthNames(locale);
    const data: ChartDataPoint[] = [];

    let bankBalance = totalDebt;
    let velocityBalance = totalDebt;

    // Assuming average APR of 15% for simulation
    const monthlyInterestRate = 0.15 / 12;

    for (let i = 0; i < 12; i++) {
        data.push({
            month: months[i],
            bankBalance: Math.max(0, Math.round(bankBalance)),
            velocityBalance: Math.max(0, Math.round(velocityBalance))
        });

        // Standard (bank) strategy: minimums only, interest accrues
        const bankInterest = bankBalance * monthlyInterestRate;
        bankBalance = Math.max(0, bankBalance + bankInterest - minPayments);

        // Velocity strategy: minimums + velocity power, more principal paid
        const velocityInterest = velocityBalance * monthlyInterestRate;
        velocityBalance = Math.max(0, velocityBalance + velocityInterest - minPayments - velocityPower);
    }

    return data;
};

export default function DebtBurndownChart() {
    const { t, language } = useLanguage();
    const locale = language === 'es' ? 'es-ES' : 'en-US';
    const [data, setData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);

    const chartConfig = {
        bankBalance: {
            label: t('dashboard.burndown.bank'),
            color: 'hsl(var(--muted-foreground))',
        },
        velocityBalance: {
            label: 'KoreX',
            color: '#10b981', // emerald — positive financial movement per brand-design-system
        },
    } satisfies ChartConfig;

    useEffect(() => {
        apiFetch<VelocityData>(withPlanLimit('/api/velocity/projections'))
            .then((velocityData) => {
                const projections = generateProjections(
                    velocityData.total_debt || 0,
                    velocityData.total_min_payments || 0,
                    velocityData.velocity_power || 0,
                    locale
                );
                setData(projections);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching velocity data:', err);
                setData([]);
                setLoading(false);
            });
    }, [locale]);

    if (loading) {
        return (
            <Card className="h-full">
                <CardContent className="flex items-center justify-center h-[380px]">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle>{t('dashboard.burndown.title')}</CardTitle>
                <CardDescription className="text-muted-foreground">
                    {t('dashboard.burndown.desc')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
                    <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-velocityBalance)" stopOpacity={0.35} />
                                <stop offset="95%" stopColor="var(--color-velocityBalance)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorBank" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-bankBalance)" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="var(--color-bankBalance)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis hide domain={['auto', 'auto']} />
                        <ChartTooltip
                            cursor={{ stroke: 'var(--color-velocityBalance)', strokeWidth: 1, strokeDasharray: '5 5' }}
                            content={<ChartTooltipContent indicator="dot" />}
                        />
                        <Area
                            type="monotone"
                            dataKey="bankBalance"
                            stroke="var(--color-bankBalance)"
                            fillOpacity={1}
                            fill="url(#colorBank)"
                            strokeWidth={2}
                        />
                        <Area
                            type="monotone"
                            dataKey="velocityBalance"
                            stroke="var(--color-velocityBalance)"
                            fillOpacity={1}
                            fill="url(#colorVelocity)"
                            strokeWidth={3}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
