import { useState } from "react";
import { useLanguage } from '@/contexts/LanguageContext';
import { apiFetch } from '@/lib/api';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, Repeat, Lock, CreditCard, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCashflowStats } from "../hooks/useCashflowStats";
import type { Timeframe, CashflowItem } from "../hooks/useCashflowStats";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CashflowManager({ refreshKey = 0, lockedIds = new Set<number>(), onUpgrade }: { refreshKey?: number; lockedIds?: Set<number>; onUpgrade?: () => void }) {
    const { items, fetchCashflow, calculateStats, formatMoney } = useCashflowStats(refreshKey);
    const { t } = useLanguage();
    const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('monthly');

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
    const [newItem, setNewItem] = useState<Partial<CashflowItem>>({
        category: 'expense',
        frequency: 'monthly',
        day_of_month: 1,
        is_variable: false,
        day_of_week: 0,
        date_specific_1: 15,
        date_specific_2: 30
    });

    const stats = calculateStats(currentTimeframe);

    const handleAdd = async () => {
        if (!newItem.name || !newItem.amount) {
            alert(t('cashflow.fillNameAmount'));
            return;
        }

        try {
            await apiFetch('/api/cashflow', {
                method: 'POST',
                body: JSON.stringify(newItem)
            });

            fetchCashflow();
            setIsDialogOpen(false);
            setNewItem({
                category: 'expense',
                frequency: 'monthly',
                day_of_month: 1,
                is_variable: false,
                day_of_week: 0,
                date_specific_1: 15,
                date_specific_2: 30
            });
        } catch (e) {
            console.error("Add failed", e);
        }
    };

    const requestDelete = (id: number, name: string) => {
        setDeleteTarget({ id, name });
    };

    const confirmDeleteItem = async () => {
        if (!deleteTarget) return;
        try {
            await apiFetch(`/api/cashflow/${deleteTarget.id}`, { method: 'DELETE' });
            fetchCashflow();
        } catch (e) {
            console.error("Delete failed", e);
        } finally {
            setDeleteTarget(null);
        }
    };

    const income = items.filter(i => i.category === 'income');
    const expenses = items.filter(i => i.category === 'expense' && !i.is_debt_virtual);
    const debtItems = items.filter(i => i.is_debt_virtual);

    return (
        <div className="space-y-8">
            {/* 1. Timeframe Toggle */}
            <div className="flex justify-center">
                <Tabs defaultValue="monthly" className="w-full max-w-md" onValueChange={(val) => setCurrentTimeframe(val as Timeframe)}>
                    <TabsList className="grid w-full grid-cols-4 bg-[#0f0f0f]/50 border border-kx-line">
                        <TabsTrigger value="daily">{t('cashflow.daily')}</TabsTrigger>
                        <TabsTrigger value="weekly">{t('cashflow.weekly')}</TabsTrigger>
                        <TabsTrigger value="monthly">{t('cashflow.monthly')}</TabsTrigger>
                        <TabsTrigger value="annually">{t('cashflow.yearly')}</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* 2. Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="glass-card border-l-4 border-l-kx-line relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--kx-ink)_3%,transparent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-kx-ink flex items-center gap-2 uppercase tracking-wider">
                            <TrendingUp className="h-4 w-4" /> {t(`cashflow.${currentTimeframe === 'annually' ? 'yearly' : currentTimeframe}`)} {t('cashflow.income')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-kx-ink drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                            {formatMoney(stats.income)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-card border-l-4 border-l-kx-debt relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--kx-debt)_5%,transparent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-kx-debt flex items-center gap-2 uppercase tracking-wider">
                            <TrendingDown className="h-4 w-4" /> {t(`cashflow.${currentTimeframe === 'annually' ? 'yearly' : currentTimeframe}`)} {t('cashflow.expenses')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-kx-ink drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]">
                            {formatMoney(stats.expenses)}
                        </div>
                        {stats.debtExpenses > 0 && (
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-kx-ink3">{t('cashflow.fixed')}: {formatMoney(stats.regularExpenses)}</span>
                                    <span className="text-kx-amber">{t('cashflow.debt')}: {formatMoney(stats.debtExpenses)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs mt-1">
                                    <span className={`font-semibold ${stats.debtDrainPct > 50 ? 'text-kx-debt' :
 stats.debtDrainPct > 30 ? 'text-kx-amber' : 'text-kx-paid'
 }`}>
                                        {stats.debtDrainPct.toFixed(0)}% {t('cashflow.debtDrain')}
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="glass-card border-l-4 border-l-kx-line relative overflow-hidden group">
                    <div className="absolute inset-0 bg-kx-raised opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-kx-ink2 flex items-center gap-2 uppercase tracking-wider">
                            <Wallet className="h-4 w-4" /> {t('cashflow.netSurplus')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-extrabold drop-shadow-md ${stats.surplus >= 0 ? 'text-kx-ink2' : 'text-kx-amber'}`}>
                            {formatMoney(stats.surplus)}
                        </div>
                        <p className="text-xs text-kx-ink3 mt-1 capitalize">
                            {t('cashflow.available')} {t(`cashflow.${currentTimeframe === 'annually' ? 'yearly' : currentTimeframe}`).toLowerCase()}
                        </p>
                        {stats.surplus > 0 && (
                            <div className="flex flex-col gap-0.5 mt-1.5">
                                {currentTimeframe !== 'annually' && (
                                    <span className="text-xs text-kx-amber font-semibold">
                                        ⚡ {formatMoney(stats.surplus * (currentTimeframe === 'daily' ? 365.25 : currentTimeframe === 'weekly' ? 52.14 : 12))}/año
                                    </span>
                                )}
                                <span className="text-xs text-kx-amber font-medium">
                                    🎯 {((stats.surplus / stats.income) * 100).toFixed(0)}% {t('cashflow.attackPower') || 'Poder de Ataque'}
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 3. Recurring Transactions List */}
            <div className="flex flex-wrap justify-between items-center gap-3 pt-4 border-t border-kx-line">
                <h2 className="text-lg sm:text-xl font-bold text-kx-ink flex items-center gap-2 min-w-0">
                    <Repeat className="text-kx-ink3 shrink-0" size={20} /> {t('cashflow.recurringTransactions')}
                </h2>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="border-kx-line bg-[#0f0f0f]/50 hover:bg-kx-raised text-kx-ink2 hover:text-kx-ink gap-2 transition-all">
                            <Plus size={16} /> {t('cashflow.addRecurring')}
                        </Button>
                    </DialogTrigger>
                    {/* ... (Dialog Content remains mostly same, can be modularized later) ... */}
                    <DialogContent className="glass-panel sm:max-w-[450px] bg-kx-raised border-kx-line text-kx-ink">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold">{t('cashflow.addRecurringItem')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-5 py-4">
                            {/* Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-kx-ink2">{t('cashflow.type')}</Label>
                                    <Select
                                        value={newItem.category}
                                        onValueChange={(val) => setNewItem({ ...newItem, category: val as 'income' | 'expense' })}
                                    >
                                        <SelectTrigger className="bg-kx-raised border-kx-line text-kx-ink h-11">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-kx-bg border-kx-line text-kx-ink">
                                            <SelectItem value="income">{t('cashflow.incomeOption')}</SelectItem>
                                            <SelectItem value="expense">{t('cashflow.expenseOption')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-kx-ink2">{t('cashflow.amount')}</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kx-ink3">$</span>
                                        <Input
                                            type="number"
                                            placeholder="0.00"
                                            className="bg-kx-raised border-kx-line text-kx-ink pl-7 h-11 font-mono"
                                            value={newItem.amount || ''}
                                            onChange={e => setNewItem({ ...newItem, amount: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Name */}
                            <div className="space-y-2">
                                <Label className="text-kx-ink2">{t('cashflow.nameDesc')}</Label>
                                <Input
                                    placeholder="e.g. Salary, Rent, Spotify..."
                                    className="bg-kx-raised border-kx-line text-kx-ink h-11"
                                    value={newItem.name || ''}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                />
                            </div>

                            {/* Frequency */}
                            <div className="space-y-2">
                                <Label className="text-kx-ink2">{t('cashflow.frequency')}</Label>
                                <Select
                                    value={newItem.frequency}
                                    onValueChange={(val) => setNewItem({ ...newItem, frequency: val })}
                                >
                                    <SelectTrigger className="bg-kx-raised border-kx-line text-kx-ink h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-kx-bg border-kx-line text-kx-ink">
                                        <SelectItem value="weekly">{t('cashflow.freqWeekly')}</SelectItem>
                                        <SelectItem value="biweekly">{t('cashflow.freqBiweekly')}</SelectItem>
                                        <SelectItem value="semi_monthly">{t('cashflow.freqSemiMonthly')}</SelectItem>
                                        <SelectItem value="monthly">{t('cashflow.freqMonthly')}</SelectItem>
                                        <SelectItem value="annually">{t('cashflow.freqAnnually')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Dynamic Fields */}
                            {(newItem.frequency === 'weekly' || newItem.frequency === 'biweekly') && (
                                <div className="space-y-2">
                                    <Label className="text-kx-ink2">{t('cashflow.whichDay')}</Label>
                                    <div className="flex justify-between gap-1">
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                                            <Button
                                                key={day}
                                                type="button"
                                                variant={newItem.day_of_week === idx ? "default" : "outline"}
                                                className={`h-9 w-9 p-0 ${newItem.day_of_week === idx ? 'bg-kx-amber hover:bg-kx-amber text-[#111418] border-kx-amber' : 'bg-kx-raised border-kx-line text-kx-ink2 hover:text-kx-ink hover:bg-kx-surface'}`}
                                                onClick={() => setNewItem({ ...newItem, day_of_week: idx })}
                                            >
                                                {day[0]}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {newItem.frequency === 'monthly' && (
                                <div className="space-y-2">
                                    <Label className="text-kx-ink2">{t('cashflow.dayOfMonth')}</Label>
                                    <Input
                                        type="number"
                                        min="1" max="31"
                                        className="bg-kx-raised border-kx-line text-kx-ink h-11"
                                        value={newItem.day_of_month || ''}
                                        onChange={e => setNewItem({ ...newItem, day_of_month: parseInt(e.target.value) })}
                                    />
                                </div>
                            )}

                            {newItem.frequency === 'semi_monthly' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-kx-ink2">{t('cashflow.firstPayDay')}</Label>
                                        <Input
                                            type="number"
                                            min="1" max="15"
                                            placeholder="15"
                                            className="bg-kx-raised border-kx-line text-kx-ink h-11"
                                            value={newItem.date_specific_1 || ''}
                                            onChange={e => setNewItem({ ...newItem, date_specific_1: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-kx-ink2">{t('cashflow.secondPayDay')}</Label>
                                        <Input
                                            type="number"
                                            min="16" max="31"
                                            placeholder="30"
                                            className="bg-kx-raised border-kx-line text-kx-ink h-11"
                                            value={newItem.date_specific_2 || ''}
                                            onChange={e => setNewItem({ ...newItem, date_specific_2: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            )}

                            {newItem.frequency === 'annually' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-kx-ink2">{t('cashflow.month')}</Label>
                                        <Select
                                            value={newItem.month_of_year?.toString()}
                                            onValueChange={(val) => setNewItem({ ...newItem, month_of_year: parseInt(val) })}
                                        >
                                            <SelectTrigger className="bg-kx-raised border-kx-line text-kx-ink h-11">
                                                <SelectValue placeholder="Month" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-kx-bg border-kx-line text-kx-ink">
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                    <SelectItem key={m} value={m.toString()}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-kx-ink2">{t('cashflow.day')}</Label>
                                        <Input
                                            type="number"
                                            min="1" max="31"
                                            className="bg-kx-raised border-kx-line text-kx-ink h-11"
                                            value={newItem.day_of_month || ''}
                                            onChange={e => setNewItem({ ...newItem, day_of_month: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-kx-ink2">{t('cashflow.variable')}</Label>
                                <Select
                                    value={newItem.is_variable ? "yes" : "no"}
                                    onValueChange={(val) => setNewItem({ ...newItem, is_variable: val === 'yes' })}
                                >
                                    <SelectTrigger className="bg-kx-raised border-kx-line text-kx-ink h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-kx-bg border-kx-line text-kx-ink">
                                        <SelectItem value="no">{t('cashflow.fixedAmount')}</SelectItem>
                                        <SelectItem value="yes">{t('cashflow.variableAvg')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={handleAdd} variant="premium" className="w-full h-12 text-lg mt-4">
                                {t('cashflow.saveItem')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Income Column */}
                <div className="space-y-4">
                    <h3 className="text-kx-ink font-semibold text-sm uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-kx-line">
                        <TrendingUp size={16} /> {t('cashflow.incomeStreams')}
                    </h3>
                    {income.length === 0 && (
                        <div className="text-kx-ink2 italic text-sm p-4 border border-dashed border-kx-line rounded-lg text-center">
                            {t('cashflow.noIncome')}
                        </div>
                    )}
                    {income.map(item => (
                        <div key={item.id} className="flex justify-between items-center gap-3 p-3 sm:p-4 rounded-xl bg-kx-raised border border-kx-line group hover:border-kx-ink3 hover:bg-kx-surface transition-all duration-300">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="bg-[color-mix(in_srgb,var(--kx-ink)_6%,transparent)] p-2.5 rounded-lg group-hover:bg-[color-mix(in_srgb,var(--kx-ink)_10%,transparent)] transition-colors">
                                    <TrendingUp size={18} className="text-kx-ink2" />
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate font-semibold text-kx-ink group-hover:text-kx-ink transition-colors">{item.name}</div>
                                    <div className="text-xs text-kx-ink3 flex items-center gap-1.5 mt-0.5">
                                        <span className="bg-kx-surface px-1.5 py-0.5 rounded text-kx-ink2">{item.frequency}</span>
                                        <span>• {t('cashflow.dayPrefix')} {item.day_of_month}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-none items-center gap-2">
                                <span className="font-mono text-kx-ink font-bold text-base sm:text-lg">+{formatMoney(item.amount)}</span> {/* Display raw amount here, maybe update later to show timeframe specific */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => requestDelete(item.id, item.name)}
                                    className="h-8 w-8 text-kx-ink2 hover:text-kx-debt hover:bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] md:opacity-0 md:group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Expense Column */}
                <div className="space-y-4">
                    <h3 className="text-kx-debt font-semibold text-sm uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-kx-line">
                        <TrendingDown size={16} /> {t('cashflow.recurringExpenses')}
                    </h3>
                    {expenses.length === 0 && debtItems.length === 0 && (
                        <div className="text-kx-ink2 italic text-sm p-4 border border-dashed border-kx-line rounded-lg text-center">
                            {t('cashflow.noExpenses')}
                        </div>
                    )}
                    {expenses.map(item => (
                        <div key={item.id} className="flex justify-between items-center gap-3 p-3 sm:p-4 rounded-xl bg-kx-raised border border-[color-mix(in_srgb,var(--kx-debt)_20%,transparent)] group hover:border-[color-mix(in_srgb,var(--kx-debt)_30%,transparent)] hover:bg-kx-surface transition-all duration-300">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] p-2.5 rounded-lg group-hover:bg-[color-mix(in_srgb,var(--kx-debt)_20%,transparent)] transition-colors">
                                    <TrendingDown size={18} className="text-kx-debt" />
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate font-semibold text-kx-ink group-hover:text-kx-debt transition-colors">{item.name}</div>
                                    <div className="text-xs text-kx-ink3 flex items-center gap-1.5 mt-0.5">
                                        <span className="bg-kx-surface px-1.5 py-0.5 rounded text-kx-ink2">{item.frequency}</span>
                                        <span>• {t('cashflow.dayPrefix')} {item.day_of_month}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-none items-center gap-2">
                                <span className="font-mono text-kx-debt font-bold text-base sm:text-lg">{formatMoney(item.amount)}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => requestDelete(item.id, item.name)}
                                    className="h-8 w-8 text-kx-ink2 hover:text-kx-debt hover:bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] md:opacity-0 md:group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {/* Debt Obligations — Auto-generated from active debts */}
                    {debtItems.length > 0 && (
                        <>
                            <h3 className="text-kx-amber font-semibold text-sm uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-[color-mix(in_srgb,var(--kx-amber)_20%,transparent)] mt-6">
                                <CreditCard size={16} /> {t('cashflow.debtObligations')}
                                <span className="text-xs font-normal text-kx-amber ml-auto">{t('cashflow.autoSynced')}</span>
                            </h3>
                            {debtItems.map(item => {
                                const isLocked = !!(item.source_account_id && lockedIds.has(item.source_account_id));
                                return (
                                    <div
                                        key={item.id}
                                        className={`relative flex justify-between items-center gap-3 p-3 sm:p-4 rounded-xl transition-all duration-300 ${isLocked
 ? 'bg-kx-raised border border-[color-mix(in_srgb,var(--kx-debt)_15%,transparent)] opacity-50 cursor-pointer hover:opacity-70 hover:border-[color-mix(in_srgb,var(--kx-debt)_30%,transparent)]'
 : 'bg-[color-mix(in_srgb,var(--kx-amber)_20%,transparent)] border border-[color-mix(in_srgb,var(--kx-amber)_30%,transparent)] group hover:border-[color-mix(in_srgb,var(--kx-amber)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--kx-amber)_30%,transparent)]'
 }`}
                                        onClick={isLocked && onUpgrade ? onUpgrade : undefined}
                                    >
                                        {/* Lock overlay for locked accounts */}
                                        {isLocked && (
                                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-xl">
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] border border-[color-mix(in_srgb,var(--kx-debt)_20%,transparent)]">
                                                    <Lock size={12} className="text-kx-debt" />
                                                    <span className="text-[10px] font-bold text-kx-debt uppercase tracking-wider">{t('cashflow.locked')}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className={`p-2.5 rounded-lg transition-colors ${isLocked
 ? 'bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)]'
 : 'bg-[color-mix(in_srgb,var(--kx-amber)_10%,transparent)] group-hover:bg-[color-mix(in_srgb,var(--kx-amber)_20%,transparent)]'
 }`}>
                                                <CreditCard size={18} className={isLocked ? 'text-kx-debt' : 'text-kx-amber'} />
                                            </div>
                                            <div>
                                                <div className={`font-semibold transition-colors ${isLocked
 ? 'text-kx-ink3'
 : 'text-kx-ink group-hover:text-kx-amber'
 }`}>{item.name}</div>
                                                <div className="text-xs text-kx-ink3 flex items-center gap-1.5 mt-0.5">
                                                    <span className={`px-1.5 py-0.5 rounded ${isLocked
 ? 'bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] text-kx-debt'
 : 'bg-[color-mix(in_srgb,var(--kx-amber)_10%,transparent)] text-kx-amber'
 }`}>{item.interest_rate}% APR</span>
                                                    <span>• {t('cashflow.dueDay')} {item.day_of_month}</span>
                                                </div>
                                                {item.debt_balance !== undefined && (
                                                    <div className={`text-xs mt-1 ${isLocked ? 'text-kx-debt' : 'text-kx-amber'}`}>
                                                        {formatMoney(item.debt_balance)} {t('cashflow.remaining')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-none items-center gap-2">
                                            <span className={`font-mono font-bold text-lg ${isLocked ? 'text-kx-ink3' : 'text-kx-amber'
 }`}>{formatMoney(item.amount)}</span>
                                            <div className={`h-8 w-8 flex items-center justify-center ${isLocked ? 'text-kx-debt' : 'text-kx-amber'
 }`} title={isLocked ? t('cashflow.upgradeToUnlock') : t('cashflow.autoManaged')}>
                                                <Lock size={14} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent className="glass-panel border-[color-mix(in_srgb,var(--kx-debt)_50%,transparent)] bg-kx-surface">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-kx-debt flex items-center gap-2">
                            <AlertCircle size={20} /> {t('cashflow.deleteConfirmTitle') || 'Eliminar Transacción'}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-kx-ink2 ">
                            {t('cashflow.deleteConfirmDesc') || '¿Eliminar'} <strong className="text-kx-ink">{deleteTarget?.name}</strong>{'? '}
                            {t('cashflow.deleteConfirmWarn') || 'Esta acción no se puede deshacer.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-kx-line hover:bg-kx-raised text-kx-ink ">
                            {t('accounts.cancel') || 'Cancelar'}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteItem} className="bg-kx-debt hover:bg-kx-debt text-[#111418] shadow-lg ">
                            {t('cashflow.deleteConfirmAction') || 'Sí, Eliminar'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
