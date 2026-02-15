/**
 * PDFReportGenerator.ts
 * ─────────────────────────────────────────────────────────
 * Generates a professional monthly financial PDF report
 * using jsPDF + jspdf-autotable.
 *
 * Sections:
 *   1. Cover / Header
 *   2. Financial Summary (Dashboard KPIs)
 *   3. Accounts Overview (table)
 *   4. Recent Transactions (table)
 *   5. Footer with generation timestamp
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiFetch } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────

interface DashboardData {
    total_debt: number;
    total_liquid: number;
    velocity_target: string;
    net_worth: number;
    monthly_income: number;
    monthly_expenses: number;
    debt_count: number;
    asset_count: number;
    peace_shield_months: number;
}

interface AccountRow {
    id: number;
    name: string;
    type: string;
    balance: number;
    interest_rate: number;
    credit_limit?: number;
    min_payment?: number;
}

interface TransactionRow {
    id: number;
    date: string;
    amount: number;
    description: string;
    category: string;
}

// Translation strings for PDF content
interface PDFTranslations {
    title: string;
    subtitle: string;
    generated: string;
    financialSummary: string;
    totalDebt: string;
    totalLiquid: string;
    netWorth: string;
    monthlyIncome: string;
    monthlyExpenses: string;
    peaceShield: string;
    months: string;
    accountsOverview: string;
    accountName: string;
    type: string;
    balance: string;
    apr: string;
    minPayment: string;
    recentTransactions: string;
    date: string;
    description: string;
    category: string;
    amount: string;
    debt: string;
    asset: string;
    footer: string;
    noAccounts: string;
    noTransactions: string;
}

const TRANSLATIONS: Record<'en' | 'es', PDFTranslations> = {
    en: {
        title: 'CoreX Financial Report',
        subtitle: 'Monthly Financial Summary',
        generated: 'Generated on',
        financialSummary: 'Financial Summary',
        totalDebt: 'Total Debt',
        totalLiquid: 'Total Liquidity',
        netWorth: 'Net Worth',
        monthlyIncome: 'Monthly Income',
        monthlyExpenses: 'Monthly Expenses',
        peaceShield: 'Peace Shield',
        months: 'months',
        accountsOverview: 'Accounts Overview',
        accountName: 'Account Name',
        type: 'Type',
        balance: 'Balance',
        apr: 'APR (%)',
        minPayment: 'Min Payment',
        recentTransactions: 'Recent Transactions',
        date: 'Date',
        description: 'Description',
        category: 'Category',
        amount: 'Amount',
        debt: 'Debt',
        asset: 'Asset',
        footer: 'CoreX Financial System — Velocity Banking Engine',
        noAccounts: 'No accounts found.',
        noTransactions: 'No recent transactions found.',
    },
    es: {
        title: 'Reporte Financiero CoreX',
        subtitle: 'Resumen Financiero Mensual',
        generated: 'Generado el',
        financialSummary: 'Resumen Financiero',
        totalDebt: 'Deuda Total',
        totalLiquid: 'Liquidez Total',
        netWorth: 'Patrimonio Neto',
        monthlyIncome: 'Ingreso Mensual',
        monthlyExpenses: 'Gastos Mensuales',
        peaceShield: 'Escudo de Paz',
        months: 'meses',
        accountsOverview: 'Resumen de Cuentas',
        accountName: 'Nombre de Cuenta',
        type: 'Tipo',
        balance: 'Saldo',
        apr: 'TAE (%)',
        minPayment: 'Pago Mínimo',
        recentTransactions: 'Transacciones Recientes',
        date: 'Fecha',
        description: 'Descripción',
        category: 'Categoría',
        amount: 'Monto',
        debt: 'Deuda',
        asset: 'Activo',
        footer: 'CoreX Financial System — Motor de Velocity Banking',
        noAccounts: 'No se encontraron cuentas.',
        noTransactions: 'No se encontraron transacciones recientes.',
    },
};

// ─── Helpers ──────────────────────────────────────────────

const formatCurrency = (value: number, currency = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
    }).format(value);
};

const formatDate = (dateStr: string, language: 'en' | 'es'): string => {
    const locale = language === 'es' ? 'es-ES' : 'en-US';
    try {
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(new Date(dateStr));
    } catch {
        return dateStr;
    }
};

// ─── Color Palette (RGB tuples) ──────────────────────────

const COLORS = {
    primary: [16, 185, 129] as [number, number, number],      // emerald-500
    dark: [15, 23, 42] as [number, number, number],            // slate-900
    medium: [100, 116, 139] as [number, number, number],       // slate-500
    light: [226, 232, 240] as [number, number, number],        // slate-200
    white: [255, 255, 255] as [number, number, number],
    accent: [251, 191, 36] as [number, number, number],        // amber-400
    red: [239, 68, 68] as [number, number, number],            // red-500
    blue: [59, 130, 246] as [number, number, number],          // blue-500
    tableHeaderBg: [30, 41, 59] as [number, number, number],   // slate-800
    tableStripeBg: [241, 245, 249] as [number, number, number], // slate-100
};

// ═══════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════

export async function generateMonthlyReport(
    language: 'en' | 'es' = 'en',
    currency = 'USD',
): Promise<void> {
    const t = TRANSLATIONS[language];

    // ── 1. Fetch all data in parallel ─────────────────────
    const [dashboardData, accountsData, transactionsData] = await Promise.all([
        apiFetch<DashboardData>('/api/dashboard').catch(() => null),
        apiFetch<AccountRow[]>('/api/accounts').catch(() => []),
        apiFetch<TransactionRow[]>('/api/transactions/recent?limit=50').catch(() => []),
    ]);

    const accounts = Array.isArray(accountsData) ? accountsData : [];
    const transactions = Array.isArray(transactionsData) ? transactionsData : [];

    // ── 2. Create PDF document ────────────────────────────
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
    });

    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    const contentW = pageW - margin * 2;
    let y = margin;

    // ── 3. Cover / Header ─────────────────────────────────
    // Gradient-like header bar
    doc.setFillColor(...COLORS.dark);
    doc.rect(0, 0, pageW, 55, 'F');

    // Accent line
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 55, pageW, 2, 'F');

    // Title
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text(t.title, margin, 25);

    // Subtitle
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.primary);
    doc.text(t.subtitle, margin, 35);

    // Generated date
    const now = new Date();
    const locale = language === 'es' ? 'es-ES' : 'en-US';
    const dateStr = new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(now);

    doc.setFontSize(9);
    doc.setTextColor(...COLORS.medium);
    doc.text(`${t.generated} ${dateStr}`, margin, 45);

    y = 65;

    // ── 4. Financial Summary KPI Cards ────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text(t.financialSummary, margin, y);
    y += 8;

    if (dashboardData) {
        const kpis = [
            { label: t.totalDebt, value: formatCurrency(dashboardData.total_debt, currency), color: COLORS.red },
            { label: t.totalLiquid, value: formatCurrency(dashboardData.total_liquid, currency), color: COLORS.blue },
            { label: t.netWorth, value: formatCurrency(dashboardData.net_worth, currency), color: COLORS.primary },
            { label: t.monthlyIncome, value: formatCurrency(dashboardData.monthly_income, currency), color: COLORS.primary },
            { label: t.monthlyExpenses, value: formatCurrency(dashboardData.monthly_expenses, currency), color: COLORS.accent },
            { label: t.peaceShield, value: `${dashboardData.peace_shield_months.toFixed(1)} ${t.months}`, color: COLORS.blue },
        ];

        const cardW = (contentW - 10) / 3; // 3 columns
        const cardH = 22;
        const cardGap = 5;

        kpis.forEach((kpi, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const cx = margin + col * (cardW + cardGap);
            const cy = y + row * (cardH + cardGap);

            // Card background
            doc.setFillColor(248, 250, 252); // slate-50
            doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'F');

            // Left accent bar
            doc.setFillColor(...kpi.color);
            doc.rect(cx, cy + 2, 2, cardH - 4, 'F');

            // Label
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLORS.medium);
            doc.text(kpi.label, cx + 6, cy + 8);

            // Value
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORS.dark);
            doc.text(kpi.value, cx + 6, cy + 17);
        });

        y += Math.ceil(kpis.length / 3) * (cardH + cardGap) + 8;
    } else {
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.medium);
        doc.text('Dashboard data unavailable.', margin, y);
        y += 12;
    }

    // ── 5. Accounts Table ─────────────────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text(t.accountsOverview, margin, y);
    y += 3;

    if (accounts.length > 0) {
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [[t.accountName, t.type, t.balance, t.apr, t.minPayment]],
            body: accounts.map((a) => [
                a.name,
                a.type === 'debt' ? t.debt : t.asset,
                formatCurrency(a.balance, currency),
                a.interest_rate ? `${a.interest_rate}%` : '—',
                a.min_payment ? formatCurrency(a.min_payment, currency) : '—',
            ]),
            headStyles: {
                fillColor: COLORS.tableHeaderBg,
                textColor: COLORS.white,
                fontStyle: 'bold',
                fontSize: 9,
            },
            bodyStyles: {
                fontSize: 9,
                textColor: COLORS.dark,
            },
            alternateRowStyles: {
                fillColor: COLORS.tableStripeBg,
            },
            columnStyles: {
                2: { halign: 'right' },
                3: { halign: 'center' },
                4: { halign: 'right' },
            },
            theme: 'grid',
            styles: {
                lineColor: COLORS.light,
                lineWidth: 0.3,
                cellPadding: 3,
            },
        });

        // Get the Y position after the table
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    } else {
        y += 5;
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.medium);
        doc.text(t.noAccounts, margin, y);
        y += 12;
    }

    // ── 6. Check if we need a new page ────────────────────
    if (y > 230) {
        doc.addPage();
        y = margin;
    }

    // ── 7. Recent Transactions Table ──────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.dark);
    doc.text(t.recentTransactions, margin, y);
    y += 3;

    if (transactions.length > 0) {
        autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            head: [[t.date, t.description, t.category, t.amount]],
            body: transactions.slice(0, 30).map((tx) => [
                formatDate(tx.date, language),
                tx.description.length > 40 ? tx.description.substring(0, 37) + '...' : tx.description,
                tx.category || '—',
                formatCurrency(tx.amount, currency),
            ]),
            headStyles: {
                fillColor: COLORS.tableHeaderBg,
                textColor: COLORS.white,
                fontStyle: 'bold',
                fontSize: 9,
            },
            bodyStyles: {
                fontSize: 8,
                textColor: COLORS.dark,
            },
            alternateRowStyles: {
                fillColor: COLORS.tableStripeBg,
            },
            columnStyles: {
                3: { halign: 'right' },
            },
            theme: 'grid',
            styles: {
                lineColor: COLORS.light,
                lineWidth: 0.3,
                cellPadding: 2.5,
            },
        });
    } else {
        y += 5;
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.medium);
        doc.text(t.noTransactions, margin, y);
    }

    // ── 8. Footer on all pages ────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        const pageH = doc.internal.pageSize.getHeight();

        // Footer line
        doc.setDrawColor(...COLORS.light);
        doc.setLineWidth(0.3);
        doc.line(margin, pageH - 15, pageW - margin, pageH - 15);

        // Footer text
        doc.setFontSize(7);
        doc.setTextColor(...COLORS.medium);
        doc.text(t.footer, margin, pageH - 10);
        doc.text(`${i} / ${totalPages}`, pageW - margin, pageH - 10, { align: 'right' });
    }

    // ── 9. Save ───────────────────────────────────────────
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(now);
    const filename = `CoreX_Report_${monthName}_${now.getFullYear()}.pdf`;
    doc.save(filename);
}
