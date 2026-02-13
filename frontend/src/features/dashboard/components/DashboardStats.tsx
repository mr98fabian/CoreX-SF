import { TrendingDown, Wallet, Calendar, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardStats() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* KPI Card 1: Total Debt Load */}
            <Card className="border-slate-800 bg-slate-950/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Total Debt Load</CardTitle>
                    <TrendingDown className="h-4 w-4 text-rose-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-white">$142,500.00</div>
                    <p className="text-xs text-rose-500 mt-1">+$230 interest accrued</p>
                </CardContent>
            </Card>

            {/* KPI Card 2: Monthly Free Cashflow */}
            <Card className="border-slate-800 bg-slate-950/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Monthly Cashflow</CardTitle>
                    <Wallet className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-white">$1,850.00</div>
                    <p className="text-xs text-emerald-500 mt-1">Velocity Ready</p>
                </CardContent>
            </Card>

            {/* KPI Card 3: Potential Interest Saved (NEW) */}
            <Card className="border-slate-800 bg-slate-950/50 border-t-2 border-t-yellow-500/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Potential Savings</CardTitle>
                    <PiggyBank className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-yellow-500">$86,400.00</div>
                    <p className="text-xs text-yellow-600/80 mt-1">vs. Traditional Bank</p>
                </CardContent>
            </Card>

            {/* KPI Card 4: Debt-Free Date */}
            <Card className="border-slate-800 bg-slate-950/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Debt-Free Date</CardTitle>
                    <Calendar className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-white">Oct 14, 2029</div>
                    <p className="text-xs text-blue-500 mt-1">3.2 years faster</p>
                </CardContent>
            </Card>
        </div>
    );
}
