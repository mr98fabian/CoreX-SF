import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';
import { Loader2 } from 'lucide-react';
import { withPlanLimit } from '@/lib/planLimits';

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

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xl">
                <p className="text-slate-400 text-xs mb-2">{label}</p>
                <p className="text-zinc-500 text-sm">
                    Bank: <span className="text-zinc-600 dark:text-zinc-300 ml-1">${payload[0].value.toLocaleString()}</span>
                </p>
                <p className="text-blue-500 text-sm font-bold">
                    KoreX: <span className="text-slate-900 dark:text-white ml-1">${payload[1].value.toLocaleString()}</span>
                </p>
            </div>
        );
    }
    return null;
};

// Generate month names starting from current month
const getMonthNames = (): string[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const result: string[] = [];
    for (let i = 0; i < 12; i++) {
        result.push(months[(currentMonth + i) % 12]);
    }
    return result;
};

// Generate projection data based on actual debt
const generateProjections = (totalDebt: number, minPayments: number, velocityPower: number): ChartDataPoint[] => {
    const months = getMonthNames();
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
    const [data, setData] = useState<ChartDataPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiFetch<VelocityData>(withPlanLimit('/api/velocity/projections'))
            .then((velocityData) => {
                const projections = generateProjections(
                    velocityData.total_debt || 0,
                    velocityData.total_min_payments || 0,
                    velocityData.velocity_power || 0
                );
                setData(projections);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching velocity data:', err);
                setData([]);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return (
            <Card className="h-full border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50">
                <CardContent className="flex items-center justify-center h-[380px]">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" strokeWidth={1.5} />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-zinc-100">Debt Burndown Projection</CardTitle>
                <CardDescription className="text-zinc-500">
                    Comparing standard bank payments vs. KoreX Velocity Strategy
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minHeight={1}>
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                {/* Velocity Gradient: Blue to transparent */}
                                <linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorBank" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#71717a" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#71717a" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} className="[&>line]:stroke-zinc-200 dark:[&>line]:stroke-zinc-800" stroke="currentColor" opacity={0.3} />
                            <XAxis
                                dataKey="month"
                                stroke="#52525b"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12, fill: '#71717a' }}
                            />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '5 5' }} />
                            <Area
                                type="monotone"
                                dataKey="bankBalance"
                                stroke="#71717a"
                                fillOpacity={1}
                                fill="url(#colorBank)"
                                strokeWidth={2}
                            />
                            <Area
                                type="monotone"
                                dataKey="velocityBalance"
                                stroke="#3b82f6"
                                fillOpacity={1}
                                fill="url(#colorVelocity)"
                                strokeWidth={3}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
