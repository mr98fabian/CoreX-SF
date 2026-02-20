/**
 * OnboardingWizard — 7-step fullscreen modal collecting financial data.
 * Steps: Welcome → Income → Expenses → Assets → Debts → Peace Shield → Success
 * Uses existing APIs (POST /api/cashflow, POST /api/accounts, PUT /api/strategy/peace-shield).
 * All steps except Welcome, Peace Shield, and Success require ≥1 item.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { apiFetch } from '@/lib/api';
import {
    Rocket, TrendingUp, TrendingDown, Wallet, CreditCard,
    CheckCircle, Plus, Trash2, ChevronRight, ChevronLeft,
    DollarSign, Sparkles, Shield, Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BANK_NAMES, getCardsByBank, getNationalAverageAPR, type CardAPRInfo } from '@/lib/creditCardAPRs';

// ── Types ──────────────────────────────────────────────────
interface CashflowFormData {
    name: string;
    amount: string;
    category: 'income' | 'expense';
    frequency: string;
    day_of_month: number;
    day_of_week: number;
    date_specific_1: number;
    date_specific_2: number;
    month_of_year: number;
    is_variable: boolean;
}

interface AccountFormData {
    name: string;
    type: string;
    balance: string;
    interest_rate: string;
    min_payment: string;
    debt_subtype: string;
    credit_limit: string;
}

interface AddedItem {
    id: number;
    name: string;
    amount: number;
    min_payment?: number;
}

// ── Quick-Start Templates ──────────────────────────────────
const INCOME_TEMPLATES = [
    { nameEn: 'Salary', nameEs: 'Salario', icon: '💼', defaultFreq: 'monthly' },
    { nameEn: 'Freelance', nameEs: 'Freelance', icon: '💻', defaultFreq: 'monthly' },
    { nameEn: 'Business', nameEs: 'Negocio', icon: '🏢', defaultFreq: 'monthly' },
    { nameEn: 'Investments', nameEs: 'Inversiones', icon: '📈', defaultFreq: 'monthly' },
    { nameEn: 'Side Hustle', nameEs: 'Ingreso Extra', icon: '🔥', defaultFreq: 'biweekly' },
    { nameEn: 'Government Aid', nameEs: 'Ayuda Gobierno', icon: '🏛️', defaultFreq: 'monthly' },
];

const EXPENSE_TEMPLATES = [
    { nameEn: 'Rent', nameEs: 'Renta', icon: '🏠', defaultFreq: 'monthly' },
    { nameEn: 'Electricity', nameEs: 'Electricidad', icon: '⚡', defaultFreq: 'monthly' },
    { nameEn: 'Water', nameEs: 'Agua', icon: '💧', defaultFreq: 'monthly' },
    { nameEn: 'Internet', nameEs: 'Internet', icon: '📡', defaultFreq: 'monthly' },
    { nameEn: 'Groceries', nameEs: 'Comida', icon: '🛒', defaultFreq: 'weekly' },
    { nameEn: 'Insurance', nameEs: 'Seguro', icon: '🛡️', defaultFreq: 'monthly' },
    { nameEn: 'Phone', nameEs: 'Teléfono', icon: '📱', defaultFreq: 'monthly' },
    { nameEn: 'Gas/Transport', nameEs: 'Gas/Transporte', icon: '⛽', defaultFreq: 'weekly' },
    { nameEn: 'Subscriptions', nameEs: 'Suscripciones', icon: '📺', defaultFreq: 'monthly' },
    { nameEn: 'Gym', nameEs: 'Gimnasio', icon: '🏋️', defaultFreq: 'monthly' },
];

const DEBT_TEMPLATES = [
    { nameEn: 'Credit Card', nameEs: 'Tarjeta de Crédito', icon: '💳', subtype: 'credit_card' },
    { nameEn: 'Auto Loan', nameEs: 'Préstamo Auto', icon: '🚗', subtype: 'auto_loan' },
    { nameEn: 'Mortgage', nameEs: 'Hipoteca', icon: '🏡', subtype: 'mortgage' },
    { nameEn: 'Personal Loan', nameEs: 'Préstamo Personal', icon: '🤝', subtype: 'personal_loan' },
    { nameEn: 'Student Loan', nameEs: 'Préstamo Estudiantil', icon: '🎓', subtype: 'student_loan' },
    { nameEn: 'HELOC', nameEs: 'Línea de Crédito', icon: '🏦', subtype: 'heloc' },
];

// ── Slide animation variants ───────────────────────────────
const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 300 : -300,
        opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({
        x: direction < 0 ? 300 : -300,
        opacity: 0,
    }),
};

// ── Infer interest_type from subtype (same as AccountsPage) ─
const REVOLVING_SUBTYPES = ['credit_card', 'heloc'];
function inferInterestType(subtype: string): string {
    return REVOLVING_SUBTYPES.includes(subtype) ? 'revolving' : 'fixed';
}

// ── Main Component ─────────────────────────────────────────
interface OnboardingWizardProps {
    onComplete: () => Promise<void>;
    onSkip?: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
    const { t, language } = useLanguage();
    const [currentStep, setCurrentStep] = useState(0);
    const [direction, setDirection] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Items added per step
    const [incomeItems, setIncomeItems] = useState<AddedItem[]>([]);
    const [expenseItems, setExpenseItems] = useState<AddedItem[]>([]);
    const [assetItems, setAssetItems] = useState<AddedItem[]>([]);
    const [debtItems, setDebtItems] = useState<AddedItem[]>([]);
    const [shieldAmount, setShieldAmount] = useState('1000');

    // ── Cashflow form (shared for income & expense steps) ────
    const defaultCashflow: CashflowFormData = {
        name: '',
        amount: '',
        category: 'income',
        frequency: 'monthly',
        day_of_month: 1,
        day_of_week: 0,
        date_specific_1: 15,
        date_specific_2: 30,
        month_of_year: 1,
        is_variable: false,
    };
    const [cashflowForm, setCashflowForm] = useState<CashflowFormData>(defaultCashflow);

    // ── Account form (shared for asset & debt steps) ─────────
    const defaultAccount: AccountFormData = {
        name: '',
        type: 'checking',
        balance: '',
        interest_rate: '0',
        min_payment: '0',
        debt_subtype: 'credit_card',
        credit_limit: '',
    };
    const [accountForm, setAccountForm] = useState<AccountFormData>(defaultAccount);

    // APR suggestion state
    const [showAPRSuggestions, setShowAPRSuggestions] = useState(false);
    const [selectedBank, setSelectedBank] = useState<string | null>(null);

    // ── Navigation ───────────────────────────────────────────
    const goNext = () => {
        setDirection(1);
        setCurrentStep(prev => Math.min(prev + 1, 6));
    };

    const goBack = () => {
        setDirection(-1);
        setCurrentStep(prev => Math.max(prev - 1, 0));
    };

    // Can the user proceed to the next step?
    const canProceed = (): boolean => {
        switch (currentStep) {
            case 0: return true; // Welcome — always
            case 1: return incomeItems.length >= 1;
            case 2: return expenseItems.length >= 1;
            case 3: return assetItems.length >= 1;
            case 4: return debtItems.length >= 1;
            case 5: return parseFloat(shieldAmount) > 0; // Peace Shield
            default: return true;
        }
    };

    // ── Add Cashflow Item ────────────────────────────────────
    const addCashflowItem = async (category: 'income' | 'expense') => {
        if (!cashflowForm.name || !cashflowForm.amount) return;

        setIsSubmitting(true);
        try {
            const payload: Record<string, unknown> = {
                name: cashflowForm.name,
                amount: parseFloat(cashflowForm.amount),
                category,
                frequency: cashflowForm.frequency,
                is_variable: cashflowForm.is_variable,
                day_of_month: cashflowForm.day_of_month,
            };

            // Add frequency-specific fields
            if (cashflowForm.frequency === 'weekly' || cashflowForm.frequency === 'biweekly') {
                payload.day_of_week = cashflowForm.day_of_week;
            }
            if (cashflowForm.frequency === 'semi_monthly') {
                payload.date_specific_1 = cashflowForm.date_specific_1;
                payload.date_specific_2 = cashflowForm.date_specific_2;
            }
            if (cashflowForm.frequency === 'annually') {
                payload.month_of_year = cashflowForm.month_of_year;
            }

            const result = await apiFetch<{ id: number }>('/api/cashflow', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            const newItem: AddedItem = {
                id: result.id,
                name: cashflowForm.name,
                amount: parseFloat(cashflowForm.amount),
            };

            if (category === 'income') {
                setIncomeItems(prev => [...prev, newItem]);
            } else {
                setExpenseItems(prev => [...prev, newItem]);
            }

            // Reset form
            setCashflowForm({
                ...defaultCashflow,
                category,
            });
        } catch (err) {
            console.error('Failed to add cashflow item:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Delete Cashflow Item ─────────────────────────────────
    const deleteCashflowItem = async (id: number, category: 'income' | 'expense') => {
        try {
            await apiFetch(`/api/cashflow/${id}`, { method: 'DELETE' });
            if (category === 'income') {
                setIncomeItems(prev => prev.filter(i => i.id !== id));
            } else {
                setExpenseItems(prev => prev.filter(i => i.id !== id));
            }
        } catch (err) {
            console.error('Failed to delete item:', err);
        }
    };

    // ── Add Account ──────────────────────────────────────────
    const addAccount = async (type: 'checking' | 'savings' | 'debt') => {
        if (!accountForm.name || !accountForm.balance) return;

        setIsSubmitting(true);
        try {
            const payload: Record<string, unknown> = {
                name: accountForm.name,
                type,
                balance: parseFloat(accountForm.balance),
                interest_rate: parseFloat(accountForm.interest_rate || '0'),
                min_payment: parseFloat(accountForm.min_payment || '0'),
                payment_frequency: 'monthly',
            };

            if (type === 'debt') {
                payload.debt_subtype = accountForm.debt_subtype;
                payload.interest_type = inferInterestType(accountForm.debt_subtype);
                // Include credit_limit for revolving debt types
                if (['credit_card', 'heloc'].includes(accountForm.debt_subtype) && accountForm.credit_limit) {
                    payload.credit_limit = parseFloat(accountForm.credit_limit);
                }
            }

            const result = await apiFetch<{ id: number }>('/api/accounts', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            const newItem: AddedItem = {
                id: result.id,
                name: accountForm.name,
                amount: parseFloat(accountForm.balance),
                ...(type === 'debt' && { min_payment: parseFloat(accountForm.min_payment || '0') }),
            };

            if (type === 'debt') {
                setDebtItems(prev => [...prev, newItem]);
            } else {
                setAssetItems(prev => [...prev, newItem]);
            }

            setAccountForm({ ...defaultAccount, type });
        } catch (err) {
            console.error('Failed to add account:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Delete Account ───────────────────────────────────────
    const deleteAccount = async (id: number, isDebt: boolean) => {
        try {
            await apiFetch(`/api/accounts/${id}`, { method: 'DELETE' });
            if (isDebt) {
                setDebtItems(prev => prev.filter(i => i.id !== id));
            } else {
                setAssetItems(prev => prev.filter(i => i.id !== id));
            }
        } catch (err) {
            console.error('Failed to delete account:', err);
        }
    };

    // ── Format money ─────────────────────────────────────────
    const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // ── Template click handler ───────────────────────────────
    const applyTemplate = (name: string, freq: string, category: 'income' | 'expense') => {
        setCashflowForm(prev => ({
            ...prev,
            name,
            category,
            frequency: freq,
        }));
    };

    const applyDebtTemplate = (name: string, subtype: string) => {
        setAccountForm(prev => ({
            ...prev,
            name,
            type: 'debt',
            debt_subtype: subtype,
        }));
    };

    // ── Frequency-specific day fields ────────────────────────
    const renderDayFields = () => {
        const freq = cashflowForm.frequency;

        if (freq === 'weekly' || freq === 'biweekly') {
            return (
                <div className="space-y-2">
                    <Label className="text-slate-400 text-xs">{t('cashflow.whichDay')}</Label>
                    <div className="flex justify-between gap-1">
                        {[
                            { en: 'Mon', es: 'Lun' }, { en: 'Tue', es: 'Mar' }, { en: 'Wed', es: 'Mié' },
                            { en: 'Thu', es: 'Jue' }, { en: 'Fri', es: 'Vie' }, { en: 'Sat', es: 'Sáb' },
                            { en: 'Sun', es: 'Dom' }
                        ].map((day, idx) => (
                            <Button
                                key={idx}
                                type="button"
                                variant={cashflowForm.day_of_week === idx ? "default" : "outline"}
                                className={`h-9 w-9 p-0 text-xs ${cashflowForm.day_of_week === idx
                                    ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
                                    : 'bg-slate-950/50 border-white/10 text-slate-400 hover:text-white hover:bg-white/5'}`}
                                onClick={() => setCashflowForm(prev => ({ ...prev, day_of_week: idx }))}
                            >
                                {language === 'es' ? day.es[0] : day.en[0]}
                            </Button>
                        ))}
                    </div>
                </div>
            );
        }

        if (freq === 'monthly') {
            return (
                <div className="space-y-2">
                    <Label className="text-slate-400 text-xs">{t('cashflow.dayOfMonth')}</Label>
                    <Input
                        type="number"
                        min="1" max="31"
                        className="bg-slate-950/50 border-white/10 text-white h-10"
                        value={cashflowForm.day_of_month}
                        onChange={e => setCashflowForm(prev => ({ ...prev, day_of_month: parseInt(e.target.value) || 1 }))}
                    />
                </div>
            );
        }

        if (freq === 'semi_monthly') {
            return (
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label className="text-slate-400 text-xs">{t('cashflow.firstPayDay')}</Label>
                        <Input
                            type="number" min="1" max="15" placeholder="15"
                            className="bg-slate-950/50 border-white/10 text-white h-10"
                            value={cashflowForm.date_specific_1}
                            onChange={e => setCashflowForm(prev => ({ ...prev, date_specific_1: parseInt(e.target.value) || 15 }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-400 text-xs">{t('cashflow.secondPayDay')}</Label>
                        <Input
                            type="number" min="16" max="31" placeholder="30"
                            className="bg-slate-950/50 border-white/10 text-white h-10"
                            value={cashflowForm.date_specific_2}
                            onChange={e => setCashflowForm(prev => ({ ...prev, date_specific_2: parseInt(e.target.value) || 30 }))}
                        />
                    </div>
                </div>
            );
        }

        if (freq === 'annually') {
            return (
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label className="text-slate-400 text-xs">{t('cashflow.month')}</Label>
                        <Select
                            value={cashflowForm.month_of_year.toString()}
                            onValueChange={val => setCashflowForm(prev => ({ ...prev, month_of_year: parseInt(val) }))}
                        >
                            <SelectTrigger className="bg-slate-950/50 border-white/10 text-white h-10">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[200] bg-slate-950 border-slate-800 text-white">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <SelectItem key={m} value={m.toString()}>
                                        {new Date(0, m - 1).toLocaleString(language === 'es' ? 'es' : 'en', { month: 'long' })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-400 text-xs">{t('cashflow.day')}</Label>
                        <Input
                            type="number" min="1" max="31"
                            className="bg-slate-950/50 border-white/10 text-white h-10"
                            value={cashflowForm.day_of_month}
                            onChange={e => setCashflowForm(prev => ({ ...prev, day_of_month: parseInt(e.target.value) || 1 }))}
                        />
                    </div>
                </div>
            );
        }

        return null;
    };

    // ── Added items list ─────────────────────────────────────
    const renderItemList = (items: AddedItem[], onDelete: (id: number) => void, colorClass: string) => (
        <div className="space-y-2 mt-4 max-h-40 overflow-y-auto">
            {items.map(item => (
                <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex justify-between items-center p-3 rounded-lg bg-slate-950/60 border border-${colorClass}-500/20`}
                >
                    <div className="flex items-center gap-3">
                        <CheckCircle className={`h-4 w-4 text-${colorClass}-500`} />
                        <span className="text-white text-sm font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`font-mono text-sm text-${colorClass}-400`}>{fmt(item.amount)}</span>
                        <button
                            onClick={() => onDelete(item.id)}
                            className="text-slate-600 hover:text-rose-400 transition-colors"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </motion.div>
            ))}
        </div>
    );

    // ── STEP RENDERERS ───────────────────────────────────────

    // Step 0: Welcome
    const renderWelcome = () => (
        <div className="flex flex-col items-center justify-center text-center space-y-6 py-4">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-xl shadow-amber-500/30"
            >
                <Rocket className="h-10 w-10 text-white" />
            </motion.div>

            <div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-2">
                    {t('onboarding.welcomeTitle')}
                </h2>
                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                    {t('onboarding.welcomeDesc')}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-sm w-full mt-4">
                {[
                    { icon: TrendingUp, label: t('onboarding.feature1'), color: 'emerald' },
                    { icon: CreditCard, label: t('onboarding.feature2'), color: 'blue' },
                    { icon: TrendingDown, label: t('onboarding.feature3'), color: 'amber' },
                    { icon: Sparkles, label: t('onboarding.feature4'), color: 'purple' },
                ].map((feat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                        className={`p-3 rounded-xl bg-${feat.color}-500/10 border border-${feat.color}-500/20 text-center`}
                    >
                        <feat.icon className={`h-5 w-5 text-${feat.color}-400 mx-auto mb-1`} />
                        <span className="text-xs text-slate-300">{feat.label}</span>
                    </motion.div>
                ))}
            </div>
        </div>
    );

    // Step 1 & 2: Cashflow (Income / Expense)
    const renderCashflowStep = (category: 'income' | 'expense') => {
        const isIncome = category === 'income';
        const items = isIncome ? incomeItems : expenseItems;
        const templates = isIncome ? INCOME_TEMPLATES : EXPENSE_TEMPLATES;
        const colorClass = isIncome ? 'emerald' : 'rose';
        const Icon = isIncome ? TrendingUp : TrendingDown;

        return (
            <div className="space-y-4">
                <div className="text-center mb-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full bg-${colorClass}-500/10 border border-${colorClass}-500/20 mb-3`}>
                        <Icon className={`h-4 w-4 text-${colorClass}-400`} />
                        <span className={`text-xs font-semibold text-${colorClass}-400 uppercase tracking-wider`}>
                            {isIncome ? t('onboarding.stepIncome') : t('onboarding.stepExpenses')}
                        </span>
                    </div>
                    <h2 className="text-xl font-bold text-white">{isIncome ? t('onboarding.incomeTitle') : t('onboarding.expensesTitle')}</h2>
                    <p className="text-slate-400 text-sm mt-1">{isIncome ? t('onboarding.incomeDesc') : t('onboarding.expensesDesc')}</p>
                </div>

                {/* Quick-Start Templates */}
                <div>
                    <Label className="text-slate-500 text-xs mb-2 block">{t('onboarding.quickSelect')}</Label>
                    <div className="flex flex-wrap gap-2">
                        {templates.map((tmpl, i) => (
                            <button
                                key={i}
                                onClick={() => applyTemplate(language === 'es' ? tmpl.nameEs : tmpl.nameEn, tmpl.defaultFreq, category)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                  ${cashflowForm.name === (language === 'es' ? tmpl.nameEs : tmpl.nameEn)
                                        ? `bg-${colorClass}-500/20 border border-${colorClass}-500/40 text-${colorClass}-300`
                                        : 'bg-slate-900/60 border border-white/5 text-slate-400 hover:bg-slate-800/80 hover:text-white'
                                    }`}
                            >
                                <span>{tmpl.icon}</span>
                                {language === 'es' ? tmpl.nameEs : tmpl.nameEn}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Form */}
                <div className="space-y-3 bg-slate-900/40 rounded-xl p-4 border border-white/5">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-slate-400 text-xs">{t('cashflow.nameDesc')}</Label>
                            <Input
                                placeholder={isIncome ? (language === 'es' ? 'ej. Salario' : 'e.g. Salary') : (language === 'es' ? 'ej. Renta' : 'e.g. Rent')}
                                className="bg-slate-950/50 border-white/10 text-white h-10 text-sm"
                                value={cashflowForm.name}
                                onChange={e => setCashflowForm(prev => ({ ...prev, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-slate-400 text-xs">{t('cashflow.amount')}</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                                <Input
                                    type="number" placeholder="0.00"
                                    className="bg-slate-950/50 border-white/10 text-white pl-7 h-10 text-sm font-mono"
                                    value={cashflowForm.amount}
                                    onChange={e => setCashflowForm(prev => ({ ...prev, amount: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label className="text-slate-400 text-xs">{t('cashflow.frequency')}</Label>
                            <Select
                                value={cashflowForm.frequency}
                                onValueChange={val => setCashflowForm(prev => ({ ...prev, frequency: val }))}
                            >
                                <SelectTrigger className="bg-slate-950/50 border-white/10 text-white h-10 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="z-[200] bg-slate-950 border-slate-800 text-white">
                                    <SelectItem value="weekly">{t('cashflow.freqWeekly')}</SelectItem>
                                    <SelectItem value="biweekly">{t('cashflow.freqBiweekly')}</SelectItem>
                                    <SelectItem value="semi_monthly">{t('cashflow.freqSemiMonthly')}</SelectItem>
                                    <SelectItem value="monthly">{t('cashflow.freqMonthly')}</SelectItem>
                                    <SelectItem value="annually">{t('cashflow.freqAnnually')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            {renderDayFields()}
                        </div>
                    </div>

                    <Button
                        onClick={() => addCashflowItem(category)}
                        disabled={!cashflowForm.name || !cashflowForm.amount || isSubmitting}
                        className={`w-full h-10 gap-2 ${isIncome
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-rose-600 hover:bg-rose-500 text-white'
                            }`}
                    >
                        <Plus size={16} />
                        {isSubmitting ? (language === 'es' ? 'Guardando...' : 'Saving...') : t('onboarding.addItem')}
                    </Button>
                </div>

                {/* Added Items */}
                {items.length > 0 && renderItemList(
                    items,
                    (id) => deleteCashflowItem(id, category),
                    colorClass
                )}

                {/* Minimum warning */}
                {items.length === 0 && (
                    <p className="text-amber-400/60 text-xs text-center italic">
                        {t('onboarding.minOneRequired')}
                    </p>
                )}
            </div>
        );
    };

    // Step 3: Assets (checking/savings)
    const renderAssetsStep = () => (
        <div className="space-y-4">
            <div className="text-center mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-3">
                    <Wallet className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                        {t('onboarding.stepAssets')}
                    </span>
                </div>
                <h2 className="text-xl font-bold text-white">{t('onboarding.assetsTitle')}</h2>
                <p className="text-slate-400 text-sm mt-1">{t('onboarding.assetsDesc')}</p>
            </div>

            <div className="space-y-3 bg-slate-900/40 rounded-xl p-4 border border-white/5">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label className="text-slate-400 text-xs">{t('accounts.accountName')}</Label>
                        <Input
                            placeholder={language === 'es' ? 'ej. Banco Principal' : 'e.g. Main Bank'}
                            className="bg-slate-950/50 border-white/10 text-white h-10 text-sm"
                            value={accountForm.name}
                            onChange={e => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-400 text-xs">{t('accounts.type')}</Label>
                        <Select
                            value={accountForm.type}
                            onValueChange={val => setAccountForm(prev => ({ ...prev, type: val }))}
                        >
                            <SelectTrigger className="bg-slate-950/50 border-white/10 text-white h-10 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[200] bg-slate-950 border-slate-800 text-white">
                                <SelectItem value="checking">{t('accounts.checking')}</SelectItem>
                                <SelectItem value="savings">{t('accounts.savings')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-slate-400 text-xs">{t('accounts.currentBalance')}</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                        <Input
                            type="number" placeholder="0.00"
                            className="bg-slate-950/50 border-white/10 text-white pl-7 h-10 text-sm font-mono"
                            value={accountForm.balance}
                            onChange={e => setAccountForm(prev => ({ ...prev, balance: e.target.value }))}
                        />
                    </div>
                </div>

                <Button
                    onClick={() => addAccount(accountForm.type as 'checking' | 'savings')}
                    disabled={!accountForm.name || !accountForm.balance || isSubmitting}
                    className="w-full h-10 gap-2 bg-blue-600 hover:bg-blue-500 text-white"
                >
                    <Plus size={16} />
                    {isSubmitting ? (language === 'es' ? 'Guardando...' : 'Saving...') : t('onboarding.addItem')}
                </Button>
            </div>

            {assetItems.length > 0 && renderItemList(assetItems, (id) => deleteAccount(id, false), 'blue')}
            {assetItems.length === 0 && (
                <p className="text-amber-400/60 text-xs text-center italic">{t('onboarding.minOneRequired')}</p>
            )}
        </div>
    );

    // Step 4: Debts
    const renderDebtsStep = () => (
        <div className="space-y-4">
            <div className="text-center mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-3">
                    <CreditCard className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                        {t('onboarding.stepDebts')}
                    </span>
                </div>
                <h2 className="text-xl font-bold text-white">{t('onboarding.debtsTitle')}</h2>
                <p className="text-slate-400 text-sm mt-1">{t('onboarding.debtsDesc')}</p>
            </div>

            {/* Quick-Start Templates */}
            <div>
                <Label className="text-slate-500 text-xs mb-2 block">{t('onboarding.quickSelect')}</Label>
                <div className="flex flex-wrap gap-2">
                    {DEBT_TEMPLATES.map((tmpl, i) => (
                        <button
                            key={i}
                            onClick={() => applyDebtTemplate(language === 'es' ? tmpl.nameEs : tmpl.nameEn, tmpl.subtype)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                ${accountForm.name === (language === 'es' ? tmpl.nameEs : tmpl.nameEn)
                                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                                    : 'bg-slate-900/60 border border-white/5 text-slate-400 hover:bg-slate-800/80 hover:text-white'
                                }`}
                        >
                            <span>{tmpl.icon}</span>
                            {language === 'es' ? tmpl.nameEs : tmpl.nameEn}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3 bg-slate-900/40 rounded-xl p-4 border border-white/5">
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Label className="text-slate-400 text-xs">{t('accounts.accountName')}</Label>
                        <Input
                            placeholder={language === 'es' ? 'ej. Visa Gold' : 'e.g. Visa Gold'}
                            className="bg-slate-950/50 border-white/10 text-white h-10 text-sm"
                            value={accountForm.name}
                            onChange={e => setAccountForm(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-400 text-xs">{t('accounts.debtType')}</Label>
                        <Select
                            value={accountForm.debt_subtype}
                            onValueChange={val => setAccountForm(prev => ({ ...prev, debt_subtype: val }))}
                        >
                            <SelectTrigger className="bg-slate-950/50 border-white/10 text-white h-10 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="z-[200] bg-slate-950 border-slate-800 text-white">
                                <SelectItem value="credit_card">{language === 'es' ? 'Tarjeta de Crédito' : 'Credit Card'}</SelectItem>
                                <SelectItem value="auto_loan">{language === 'es' ? 'Préstamo Auto' : 'Auto Loan'}</SelectItem>
                                <SelectItem value="mortgage">{language === 'es' ? 'Hipoteca' : 'Mortgage'}</SelectItem>
                                <SelectItem value="personal_loan">{language === 'es' ? 'Préstamo Personal' : 'Personal Loan'}</SelectItem>
                                <SelectItem value="student_loan">{language === 'es' ? 'Préstamo Estudiantil' : 'Student Loan'}</SelectItem>
                                <SelectItem value="heloc">HELOC</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                        <Label className="text-slate-400 text-xs">{t('accounts.currentBalance')}</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                            <Input
                                type="number" placeholder="0.00"
                                className="bg-slate-950/50 border-white/10 text-white pl-7 h-10 text-sm font-mono"
                                value={accountForm.balance}
                                onChange={e => setAccountForm(prev => ({ ...prev, balance: e.target.value }))}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-400 text-xs">{t('accounts.apr')}</Label>
                        <div className="relative">
                            <Input
                                type="number" placeholder="0" step="0.1"
                                className="bg-slate-950/50 border-white/10 text-white h-10 text-sm font-mono pr-7"
                                value={accountForm.interest_rate}
                                onChange={e => setAccountForm(prev => ({ ...prev, interest_rate: e.target.value }))}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">%</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-slate-400 text-xs">{t('accounts.minPayment')}</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                            <Input
                                type="number" placeholder="0"
                                className="bg-slate-950/50 border-white/10 text-white pl-7 h-10 text-sm font-mono"
                                value={accountForm.min_payment}
                                onChange={e => setAccountForm(prev => ({ ...prev, min_payment: e.target.value }))}
                            />
                        </div>
                    </div>
                </div>

                <Button
                    onClick={() => addAccount('debt')}
                    disabled={!accountForm.name || !accountForm.balance || isSubmitting}
                    className="w-full h-10 gap-2 bg-amber-600 hover:bg-amber-500 text-white"
                >
                    <Plus size={16} />
                    {isSubmitting ? (language === 'es' ? 'Guardando...' : 'Saving...') : t('onboarding.addItem')}
                </Button>
            </div>

            {debtItems.length > 0 && renderItemList(debtItems, (id) => deleteAccount(id, true), 'amber')}
            {debtItems.length === 0 && (
                <p className="text-amber-400/60 text-xs text-center italic">{t('onboarding.minOneRequired')}</p>
            )}
        </div>
    );

    // ── Precomputed totals (used by Peace Shield + Success) ─────
    const totalIncome = incomeItems.reduce((sum, i) => sum + i.amount, 0);
    const totalExpenses = expenseItems.reduce((sum, i) => sum + i.amount, 0);
    const totalAssets = assetItems.reduce((sum, i) => sum + i.amount, 0);
    const totalDebt = debtItems.reduce((sum, i) => sum + i.amount, 0);

    // Step 5: Peace Shield — Surplus Comfort Zone
    const monthlySurplus = totalIncome - totalExpenses;
    const totalMinPayments = debtItems.reduce((sum, i) => sum + (i.min_payment || 0), 0);
    const suggestedShield = (totalExpenses + totalMinPayments) * 3;

    const saveShieldTarget = async () => {
        const amount = parseFloat(shieldAmount);
        if (!amount || amount <= 0) return;
        try {
            await apiFetch('/api/strategy/user/me/shield', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: amount }),
            });
        } catch {
            // Non-blocking — shield will use default if this fails
        }
    };

    const renderPeaceShieldStep = () => (
        <div className="space-y-5">
            {/* Step badge */}
            <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
                    <Shield size={14} />
                    {language === 'es' ? 'PASO 5 — ESCUDO DE PAZ' : 'STEP 5 — PEACE SHIELD'}
                </div>
            </div>

            {/* Title & Explanation */}
            <div className="text-center space-y-2">
                <h2 className="text-xl font-extrabold text-white">
                    {language === 'es' ? 'Tu Escudo de Paz' : 'Your Peace Shield'}
                </h2>
                <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
                    {language === 'es'
                        ? 'KoreX trabaja SOLO con el sobrante de lo que tú te sientas cómodo. Nunca tocará dinero que necesites para vivir o pagar tus cuentas.'
                        : 'KoreX ONLY works with the surplus you feel comfortable with. It will never touch money you need for bills or living expenses.'
                    }
                </p>
            </div>

            {/* Visual Shield Concept */}
            <div className="relative p-4 rounded-2xl bg-gradient-to-b from-cyan-500/5 to-transparent border border-cyan-500/15">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-cyan-500/15 flex items-center justify-center">
                        <Shield className="h-6 w-6 text-cyan-400" />
                    </div>
                    <div>
                        <p className="text-white font-semibold text-sm">
                            {language === 'es' ? '¿Cómo funciona?' : 'How does it work?'}
                        </p>
                        <p className="text-slate-500 text-xs">
                            {language === 'es' ? 'Tu colchón de seguridad' : 'Your safety cushion'}
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-400 text-xs font-bold">1</span>
                        </div>
                        <p className="text-slate-300 text-sm">
                            {language === 'es'
                                ? 'Tú defines cuánto dinero siempre quieres tener disponible — tu "escudo".'
                                : 'You define how much money you always want available — your "shield".'
                            }
                        </p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                            <span className="text-amber-400 text-xs font-bold">2</span>
                        </div>
                        <p className="text-slate-300 text-sm">
                            {language === 'es'
                                ? 'KoreX SOLO usa el dinero que sobra DESPUÉS de tu escudo para atacar deudas.'
                                : 'KoreX ONLY uses money left over AFTER your shield to attack debts.'
                            }
                        </p>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 w-6 h-6 rounded-full bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
                            <span className="text-cyan-400 text-xs font-bold">3</span>
                        </div>
                        <p className="text-slate-300 text-sm">
                            {language === 'es'
                                ? 'Si tu balance baja del escudo, los ataques se pausan automáticamente. Tú siempre estás protegido.'
                                : 'If your balance drops below the shield, attacks pause automatically. You are always protected.'
                            }
                        </p>
                    </div>
                </div>

                {/* Credit Limit — only for revolving types */}
                {['credit_card', 'heloc'].includes(accountForm.debt_subtype) && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <Label className="text-blue-400 text-xs font-semibold">{language === 'es' ? 'Límite de Crédito' : 'Credit Limit'}</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                            <Input
                                type="number" placeholder="5000" step="100"
                                className="bg-slate-950/50 border-white/10 text-white pl-7 h-10 text-sm font-mono"
                                value={accountForm.credit_limit}
                                onChange={e => setAccountForm(prev => ({ ...prev, credit_limit: e.target.value }))}
                            />
                        </div>
                    </div>
                )}

                {/* APR Suggestion — only for credit cards */}
                {accountForm.debt_subtype === 'credit_card' && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <button
                            type="button"
                            onClick={() => setShowAPRSuggestions(!showAPRSuggestions)}
                            className="flex items-center gap-2 text-xs text-amber-500 hover:text-amber-400 transition-colors mb-1"
                        >
                            <Lightbulb size={13} />
                            {showAPRSuggestions
                                ? (language === 'es' ? 'Ocultar sugerencias APR' : 'Hide APR suggestions')
                                : (language === 'es' ? '¿No sabes tu APR? Ver sugerencias por banco' : "Don't know your APR? See bank suggestions")
                            }
                        </button>
                        {showAPRSuggestions && (
                            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-2">
                                <p className="text-[11px] text-slate-500 mb-1">
                                    {language === 'es' ? 'Promedio nacional' : 'National avg'}: <span className="font-mono text-amber-400">{getNationalAverageAPR()}%</span>
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {BANK_NAMES.map(bank => (
                                        <button
                                            key={bank}
                                            type="button"
                                            onClick={() => setSelectedBank(selectedBank === bank ? null : bank)}
                                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${selectedBank === bank
                                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                    : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:bg-slate-800/80'
                                                }`}
                                        >
                                            {bank}
                                        </button>
                                    ))}
                                </div>
                                {selectedBank && (
                                    <div className="mt-1.5 space-y-1 max-h-28 overflow-y-auto">
                                        {getCardsByBank(selectedBank).map((card: CardAPRInfo) => (
                                            <button
                                                key={`${card.bank}-${card.card}`}
                                                type="button"
                                                onClick={() => {
                                                    setAccountForm(prev => ({ ...prev, interest_rate: card.aprTypical.toString() }));
                                                    setShowAPRSuggestions(false);
                                                    setSelectedBank(null);
                                                }}
                                                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-white/5 hover:border-amber-500/30 transition-all text-left group"
                                            >
                                                <span className="text-[11px] font-medium text-white">{card.card}</span>
                                                <span className="font-mono text-[11px] text-amber-400 group-hover:text-amber-300">{card.aprTypical}%</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Shield Amount Input */}
            <div className="space-y-2">
                <Label className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    {language === 'es' ? 'Tu Meta del Escudo' : 'Your Shield Target'}
                </Label>
                <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                        type="number"
                        min="100"
                        step="100"
                        className="pl-9 h-12 bg-slate-950/50 border-cyan-500/20 text-white text-lg font-mono focus:border-cyan-400 focus:ring-cyan-400/20"
                        value={shieldAmount}
                        onChange={e => setShieldAmount(e.target.value)}
                        placeholder="1000"
                    />
                </div>
                <p className="text-xs text-slate-600">
                    {language === 'es'
                        ? `Recomendado: ${fmt(suggestedShield)} (3 meses de gastos + pagos mínimos)`
                        : `Recommended: ${fmt(suggestedShield)} (3 months of expenses + min payments)`
                    }
                </p>
            </div>

            {/* Monthly Surplus Info */}
            {monthlySurplus > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/15">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-300 text-sm">
                        {language === 'es'
                            ? `Tu sobrante mensual: ${fmt(monthlySurplus)} — esto es lo que KoreX usará.`
                            : `Your monthly surplus: ${fmt(monthlySurplus)} — this is what KoreX will use.`
                        }
                    </span>
                </div>
            )}
        </div>
    );

    // Step 6: Success

    const renderSuccess = () => (
        <div className="flex flex-col items-center justify-center text-center space-y-6 py-4">
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30"
            >
                <CheckCircle className="h-10 w-10 text-white" />
            </motion.div>

            <div>
                <h2 className="text-2xl font-extrabold text-white mb-2">{t('onboarding.successTitle')}</h2>
                <p className="text-slate-400 max-w-md mx-auto">{t('onboarding.successDesc')}</p>
            </div>

            {/* Mini Dashboard Summary */}
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-xs text-emerald-400 font-semibold uppercase">{t('onboarding.summaryIncome')}</div>
                    <div className="text-lg font-bold text-white font-mono">{fmt(totalIncome)}</div>
                    <div className="text-xs text-slate-500">{incomeItems.length} {language === 'es' ? 'fuentes' : 'sources'}</div>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                    <div className="text-xs text-rose-400 font-semibold uppercase">{t('onboarding.summaryExpenses')}</div>
                    <div className="text-lg font-bold text-white font-mono">{fmt(totalExpenses)}</div>
                    <div className="text-xs text-slate-500">{expenseItems.length} {language === 'es' ? 'gastos' : 'expenses'}</div>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="text-xs text-blue-400 font-semibold uppercase">{t('onboarding.summaryAssets')}</div>
                    <div className="text-lg font-bold text-white font-mono">{fmt(totalAssets)}</div>
                    <div className="text-xs text-slate-500">{assetItems.length} {language === 'es' ? 'cuentas' : 'accounts'}</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <div className="text-xs text-amber-400 font-semibold uppercase">{t('onboarding.summaryDebts')}</div>
                    <div className="text-lg font-bold text-white font-mono">{fmt(totalDebt)}</div>
                    <div className="text-xs text-slate-500">{debtItems.length} {language === 'es' ? 'deudas' : 'debts'}</div>
                </div>
            </div>

            {/* Net Surplus */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${totalIncome - totalExpenses >= 0
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}>
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-semibold">
                    {language === 'es' ? 'Surplus Mensual' : 'Monthly Surplus'}: {fmt(totalIncome - totalExpenses)}
                </span>
            </div>

            {/* Pro Tip: Quick Transactions */}
            <div className="w-full max-w-sm mt-2 p-3 rounded-xl bg-slate-800/60 border border-white/5 text-left">
                <p className="text-xs font-semibold text-amber-400 mb-1">💡 {language === 'es' ? 'Pro Tip' : 'Pro Tip'}</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                    {language === 'es'
                        ? 'En el Dashboard verás los botones "+ Ingreso" y "- Gasto". Úsalos para registrar transacciones no planificadas (reembolsos, regalos, reparaciones) y mantener tus proyecciones precisas.'
                        : 'On the Dashboard you\'ll see "+ Income" and "- Expense" buttons. Use them to log unplanned transactions (refunds, gifts, repairs) to keep your projections accurate.'}
                </p>
            </div>
        </div>
    );

    // ── Step content mapping ─────────────────────────────────
    const renderStep = () => {
        switch (currentStep) {
            case 0: return renderWelcome();
            case 1: return renderCashflowStep('income');
            case 2: return renderCashflowStep('expense');
            case 3: return renderAssetsStep();
            case 4: return renderDebtsStep();
            case 5: return renderPeaceShieldStep();
            case 6: return renderSuccess();
            default: return null;
        }
    };

    // ── Step labels for progress ─────────────────────────────
    const steps = [
        { icon: Rocket, label: t('onboarding.progressWelcome') },
        { icon: TrendingUp, label: t('onboarding.progressIncome') },
        { icon: TrendingDown, label: t('onboarding.progressExpenses') },
        { icon: Wallet, label: t('onboarding.progressAssets') },
        { icon: CreditCard, label: t('onboarding.progressDebts') },
        { icon: Shield, label: language === 'es' ? 'Escudo' : 'Shield' },
        { icon: CheckCircle, label: t('onboarding.progressDone') },
    ];

    // ── Handle final completion ──────────────────────────────
    const handleFinish = async () => {
        setIsSubmitting(true);
        await onComplete();
        setIsSubmitting(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-950/95 border border-white/10 shadow-2xl shadow-amber-500/5"
            >
                {/* Progress Bar */}
                <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-sm px-6 pt-5 pb-3 border-b border-white/5">
                    <div className="flex justify-between items-center mb-3">
                        {steps.map((step, i) => (
                            <div key={i} className="flex flex-col items-center flex-1">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${i < currentStep
                                    ? 'bg-amber-500 text-white'
                                    : i === currentStep
                                        ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400'
                                        : 'bg-slate-800/50 text-slate-600'
                                    }`}>
                                    <step.icon size={14} />
                                </div>
                                <span className={`text-[9px] mt-1 hidden md:block ${i <= currentStep ? 'text-slate-400' : 'text-slate-700'}`}>
                                    {step.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    {/* Progress line */}
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                            animate={{ width: `${(currentStep / 6) * 100}%` }}
                            transition={{ duration: 0.3 }}
                        />
                    </div>
                </div>

                {/* Step Content */}
                <div className="px-6 py-4 min-h-[400px]">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={currentStep}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.25 }}
                        >
                            {renderStep()}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Navigation Footer */}
                <div className="sticky bottom-0 z-10 bg-slate-950/95 backdrop-blur-sm px-6 py-4 border-t border-white/5">
                    <div className="flex justify-between items-center gap-3">
                        {currentStep > 0 && currentStep < 6 ? (
                            <Button
                                variant="ghost"
                                onClick={goBack}
                                className="text-slate-400 hover:text-white gap-1"
                            >
                                <ChevronLeft size={16} />
                                {t('onboarding.back')}
                            </Button>
                        ) : (
                            <div />
                        )}

                        {currentStep < 6 ? (
                            <Button
                                onClick={async () => {
                                    // Save shield target when leaving step 5
                                    if (currentStep === 5) await saveShieldTarget();
                                    goNext();
                                }}
                                disabled={!canProceed()}
                                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white gap-1 px-6 disabled:opacity-40"
                            >
                                {currentStep === 0 ? t('onboarding.letsGo') : t('onboarding.continue')}
                                <ChevronRight size={16} />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleFinish}
                                disabled={isSubmitting}
                                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white gap-2 px-8"
                            >
                                <Sparkles size={16} />
                                {isSubmitting
                                    ? (language === 'es' ? 'Finalizando...' : 'Finishing...')
                                    : t('onboarding.goToDashboard')
                                }
                            </Button>
                        )}
                    </div>
                    {/* Skip link — only before the success step */}
                    {onSkip && currentStep < 6 && (
                        <button
                            onClick={onSkip}
                            className="w-full mt-3 text-xs text-slate-500 hover:text-slate-300 transition-colors text-center"
                        >
                            {language === 'es' ? 'Omitir por ahora →' : 'Skip for now →'}
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
