import { createContext, useContext, useState, type ReactNode } from "react";

// ─── Supported Languages ────────────────────────────────────────────
type Language = "en" | "es";

// ─── Translation Dictionary ─────────────────────────────────────────
const translations: Record<string, Record<Language, string>> = {
    // ═══════════════════════════════════════════════════════════════════
    //  GLOBAL / NAVIGATION
    // ═══════════════════════════════════════════════════════════════════
    "nav.dashboard": { en: "Dashboard", es: "Panel" },
    "nav.actionPlan": { en: "Action Plan", es: "Plan de Acción" },
    "nav.accounts": { en: "My Accounts", es: "Mis Cuentas" },
    "nav.settings": { en: "Settings", es: "Configuración" },
    "nav.signOut": { en: "Sign Out", es: "Cerrar Sesión" },
    "nav.coreX": { en: "CoreX", es: "CoreX" },

    // ═══════════════════════════════════════════════════════════════════
    //  DASHBOARD PAGE
    // ═══════════════════════════════════════════════════════════════════
    "dashboard.greeting.morning": { en: "Good Morning", es: "Buenos Días" },
    "dashboard.greeting.afternoon": { en: "Good Afternoon", es: "Buenas Tardes" },
    "dashboard.greeting.evening": { en: "Good Evening", es: "Buenas Noches" },
    "dashboard.engineOnline": { en: "VELOCITY ENGINE v2 ONLINE", es: "MOTOR VELOCITY v2 EN LÍNEA" },
    "dashboard.loading": { en: "Initializing KoreX Engine...", es: "Inicializando Motor KoreX..." },
    "dashboard.income": { en: "+ Income", es: "+ Ingreso" },
    "dashboard.expense": { en: "- Expense", es: "- Gasto" },
    "dashboard.totalDebt": { en: "Total Debt", es: "Deuda Total" },
    "dashboard.totalDebtDesc": { en: "All active liabilities combined", es: "Todas las deudas activas combinadas" },
    "dashboard.liquidCash": { en: "Liquid Cash", es: "Efectivo Disponible" },
    "dashboard.liquidCashDesc": { en: "Available for strategic deployment", es: "Disponible para despliegue estratégico" },
    "dashboard.interestSaved": { en: "Projected Savings", es: "Ahorro Proyectado" },
    "dashboard.interestSavedDesc": { en: "Interest you'll never pay", es: "Intereses que nunca pagarás" },
    "dashboard.timeSaved": { en: "Time Accelerated", es: "Tiempo Acelerado" },
    "dashboard.timeSavedDesc": { en: "Years ahead of schedule", es: "Años adelantado al plan" },
    "dashboard.years": { en: "yrs", es: "años" },
    "dashboard.strategy": { en: "STRATEGY", es: "ESTRATEGIA" },
    "dashboard.analysis": { en: "ANALYSIS", es: "ANÁLISIS" },

    // Dashboard sub-components
    "dashboard.freedomClock.title": { en: "Freedom Clock", es: "Reloj de Libertad" },
    "dashboard.freedomClock.debtFree": { en: "DEBT-FREE DATE", es: "FECHA LIBRE DE DEUDAS" },
    "dashboard.freedomClock.standard": { en: "Standard", es: "Estándar" },
    "dashboard.freedomClock.velocity": { en: "Velocity", es: "Velocidad" },
    "dashboard.freedomClock.perMonth": { en: "/ mo", es: "/ mes" },

    "dashboard.peaceShield.title": { en: "Peace Shield", es: "Escudo de Paz" },
    "dashboard.peaceShield.status": { en: "Shield Status", es: "Estado del Escudo" },
    "dashboard.peaceShield.protected": { en: "PROTECTED", es: "PROTEGIDO" },
    "dashboard.peaceShield.vulnerable": { en: "VULNERABLE", es: "VULNERABLE" },
    "dashboard.peaceShield.recommended": { en: "Recommended", es: "Recomendado" },
    "dashboard.peaceShield.months": { en: "months expenses", es: "meses de gastos" },

    "dashboard.attackEquity.title": { en: "Attack Equity", es: "Capital de Ataque" },
    "dashboard.attackEquity.available": { en: "Available for Attack", es: "Disponible para Atacar" },
    "dashboard.attackEquity.nextAction": { en: "Next Action Date", es: "Próxima Fecha de Acción" },

    "dashboard.debtAttack.title": { en: "Debt Attack Table", es: "Tabla de Ataque a Deudas" },
    "dashboard.debtAttack.target": { en: "VELOCITY TARGET", es: "OBJETIVO VELOCITY" },
    "dashboard.debtAttack.power": { en: "POWER", es: "PODER" },
    "dashboard.debtAttack.balance": { en: "Balance", es: "Saldo" },
    "dashboard.debtAttack.apr": { en: "APR", es: "TAE" },
    "dashboard.debtAttack.minPayment": { en: "Min Payment", es: "Pago Mínimo" },
    "dashboard.debtAttack.pay": { en: "PAY", es: "PAGAR" },
    "dashboard.debtAttack.totalMin": { en: "Total Minimum", es: "Mínimo Total" },

    "dashboard.cashflowHeat.title": { en: "Cashflow Heat Map", es: "Mapa de Calor de Flujo" },
    "dashboard.cashflowHeat.balance": { en: "Balance", es: "Saldo" },
    "dashboard.cashflowHeat.income": { en: "Income", es: "Ingresos" },
    "dashboard.cashflowHeat.expenses": { en: "Expenses", es: "Gastos" },
    "dashboard.cashflowHeat.vsYesterday": { en: "vs yesterday", es: "vs ayer" },
    "dashboard.cashflowHeat.min": { en: "Min", es: "Mín" },
    "dashboard.cashflowHeat.max": { en: "Max", es: "Máx" },

    "dashboard.recentTx.title": { en: "Recent Transactions", es: "Transacciones Recientes" },
    "dashboard.recentTx.noData": { en: "No transactions yet.", es: "Aún no hay transacciones." },

    "dashboard.purchaseSim.title": { en: "Purchase Simulator", es: "Simulador de Compra" },
    "dashboard.purchaseSim.amount": { en: "Purchase Amount", es: "Monto de Compra" },
    "dashboard.purchaseSim.simulate": { en: "Simulate", es: "Simular" },
    "dashboard.purchaseSim.costInInterest": { en: "Cost in Interest", es: "Costo en Intereses" },
    "dashboard.purchaseSim.daysDelayed": { en: "Days Delayed", es: "Días de Retraso" },

    "dashboard.whatIf.title": { en: "What-If Simulator", es: "Simulador ¿Qué-Si?" },
    "dashboard.whatIf.extraCash": { en: "Extra Monthly Cash", es: "Efectivo Extra Mensual" },

    "dashboard.freedomPath.title": { en: "Freedom Path Calendar", es: "Calendario Camino a la Libertad" },
    "dashboard.freedomPath.interestPaid": { en: "Total Interest Paid", es: "Total de Intereses Pagados" },

    "dashboard.cashflowMonitor.title": { en: "Cashflow Monitor", es: "Monitor de Flujo de Caja" },

    // ═══════════════════════════════════════════════════════════════════
    //  ACCOUNTS PAGE
    // ═══════════════════════════════════════════════════════════════════
    "accounts.title": { en: "My Accounts", es: "Mis Cuentas" },
    "accounts.subtitle": { en: "Manage your liabilities, assets, and transactions.", es: "Administra tus pasivos, activos y transacciones." },
    "accounts.totalLiquidity": { en: "Total Liquidity", es: "Liquidez Total" },
    "accounts.totalDebt": { en: "Total Debt", es: "Deuda Total" },
    "accounts.netWorth": { en: "Net Worth", es: "Patrimonio Neto" },
    "accounts.liabilities": { en: "Liabilities", es: "Pasivos" },
    "accounts.assets": { en: "Assets", es: "Activos" },
    "accounts.addDebt": { en: "Add Debt", es: "Agregar Deuda" },
    "accounts.addCash": { en: "Add Cash Account", es: "Agregar Cuenta de Efectivo" },
    "accounts.balance": { en: "Balance", es: "Saldo" },
    "accounts.apr": { en: "APR", es: "TAE" },
    "accounts.minPayment": { en: "Min. Payment", es: "Pago Mínimo" },
    "accounts.closingDay": { en: "Closing Day", es: "Día de Corte" },
    "accounts.creditLimit": { en: "Credit Limit", es: "Límite de Crédito" },
    "accounts.delete": { en: "Delete", es: "Eliminar" },
    "accounts.confirmDelete": { en: "Are you sure you want to delete this account?", es: "¿Estás seguro de que deseas eliminar esta cuenta?" },
    "accounts.noDebts": { en: "No debts added yet. Add your first liability to get started.", es: "No tienes deudas aún. Agrega tu primer pasivo para comenzar." },
    "accounts.noAssets": { en: "No cash accounts yet. Add your first asset.", es: "No tienes cuentas de efectivo. Agrega tu primer activo." },
    "accounts.name": { en: "Account Name", es: "Nombre de Cuenta" },
    "accounts.type": { en: "Type", es: "Tipo" },
    "accounts.save": { en: "Save", es: "Guardar" },
    "accounts.cancel": { en: "Cancel", es: "Cancelar" },
    "accounts.edit": { en: "Edit", es: "Editar" },
    "accounts.adjust": { en: "Adjust Balance", es: "Ajustar Saldo" },
    "accounts.newBalance": { en: "New Balance", es: "Nuevo Saldo" },
    "accounts.transactions": { en: "Transactions", es: "Transacciones" },
    "accounts.addTransaction": { en: "Add Transaction", es: "Agregar Transacción" },
    "accounts.amount": { en: "Amount", es: "Monto" },
    "accounts.description": { en: "Description", es: "Descripción" },
    "accounts.date": { en: "Date", es: "Fecha" },
    "accounts.interestRate": { en: "Interest Rate (%)", es: "Tasa de Interés (%)" },
    "accounts.cashflowStats": { en: "Cashflow Statistics", es: "Estadísticas de Flujo" },

    // ═══════════════════════════════════════════════════════════════════
    //  ACTION PLAN PAGE
    // ═══════════════════════════════════════════════════════════════════
    "actionPlan.title": { en: "Action Plan", es: "Plan de Acción" },
    "actionPlan.subtitle": { en: "Your scheduled financial movements and execution history.", es: "Tus movimientos financieros programados e historial de ejecución." },
    "actionPlan.scheduledMoves": { en: "Scheduled Movements", es: "Movimientos Programados" },
    "actionPlan.executionHistory": { en: "Execution History", es: "Historial de Ejecución" },
    "actionPlan.date": { en: "Date", es: "Fecha" },
    "actionPlan.type": { en: "Type", es: "Tipo" },
    "actionPlan.source": { en: "Source", es: "Origen" },
    "actionPlan.destination": { en: "Destination", es: "Destino" },
    "actionPlan.amount": { en: "Amount", es: "Monto" },
    "actionPlan.status": { en: "Status", es: "Estado" },
    "actionPlan.noMoves": { en: "No scheduled movements for this month.", es: "No hay movimientos programados para este mes." },
    "actionPlan.noHistory": { en: "No execution history yet.", es: "Aún no hay historial de ejecución." },
    "actionPlan.execute": { en: "Execute", es: "Ejecutar" },
    "actionPlan.skip": { en: "Skip", es: "Omitir" },
    "actionPlan.pending": { en: "Pending", es: "Pendiente" },
    "actionPlan.completed": { en: "Completed", es: "Completado" },
    "actionPlan.skipped": { en: "Skipped", es: "Omitido" },
    "actionPlan.debtAttack": { en: "Debt Attack", es: "Ataque a Deuda" },
    "actionPlan.payment": { en: "Payment", es: "Pago" },
    "actionPlan.income": { en: "Income", es: "Ingreso" },
    "actionPlan.transfer": { en: "Transfer", es: "Transferencia" },

    // ═══════════════════════════════════════════════════════════════════
    //  STRATEGY PAGE COMPONENTS
    // ═══════════════════════════════════════════════════════════════════
    "strategy.morningBriefing.title": { en: "Morning Briefing", es: "Briefing Matutino" },
    "strategy.morningBriefing.liquidity": { en: "in strategic liquidity", es: "en liquidez estratégica" },
    "strategy.morningBriefing.actions": { en: "Recommended Actions", es: "Acciones Recomendadas" },

    "strategy.confidence.title": { en: "Confidence Meter", es: "Medidor de Confianza" },
    "strategy.confidence.level": { en: "Confidence Level", es: "Nivel de Confianza" },
    "strategy.confidence.balance": { en: "Balance", es: "Saldo" },

    "strategy.freedom.title": { en: "Freedom Counter", es: "Contador de Libertad" },
    "strategy.freedom.debtFreeDate": { en: "Debt-Free Date", es: "Fecha Libre de Deudas" },

    "strategy.cashflowMap.title": { en: "Tactical Cashflow Map", es: "Mapa Táctico de Flujo" },
    "strategy.cashflowMap.startBalance": { en: "Start Balance", es: "Saldo Inicial" },
    "strategy.cashflowMap.minProjected": { en: "Min Projected", es: "Mínimo Proyectado" },

    // ═══════════════════════════════════════════════════════════════════
    //  SETTINGS PAGE
    // ═══════════════════════════════════════════════════════════════════
    // Settings page header
    "settings.title": { en: "Settings", es: "Configuración" },
    "settings.subtitle": { en: "Manage your profile, preferences, and system configuration.", es: "Administra tu perfil, preferencias y configuración del sistema." },

    // Sidebar nav
    "settings.nav.profile": { en: "Profile", es: "Perfil" },
    "settings.nav.appearance": { en: "Appearance", es: "Apariencia" },
    "settings.nav.algorithm": { en: "Algorithm", es: "Algoritmo" },
    "settings.nav.notifications": { en: "Notifications", es: "Notificaciones" },
    "settings.nav.data": { en: "Data Management", es: "Gestión de Datos" },
    "settings.nav.about": { en: "About", es: "Acerca de" },

    // Profile section
    "settings.profile.title": { en: "Profile Information", es: "Información del Perfil" },
    "settings.profile.subtitle": { en: "Manage your personal details and account identity.", es: "Administra tus datos personales e identidad de cuenta." },
    "settings.profile.displayName": { en: "Display Name", es: "Nombre para Mostrar" },
    "settings.profile.email": { en: "Email Address", es: "Correo Electrónico" },
    "settings.profile.save": { en: "Save Profile", es: "Guardar Perfil" },

    // Appearance section
    "settings.appearance.title": { en: "Appearance & Language", es: "Apariencia e Idioma" },
    "settings.appearance.subtitle": { en: "Customize how CoreX looks and communicates.", es: "Personaliza cómo se ve y comunica CoreX." },
    "settings.appearance.language": { en: "Language", es: "Idioma" },
    "settings.appearance.languageDesc": { en: "Select your preferred language", es: "Selecciona tu idioma preferido" },
    "settings.appearance.currency": { en: "Currency Format", es: "Formato de Moneda" },
    "settings.appearance.currencyDesc": { en: "How monetary values are displayed", es: "Cómo se muestran los valores monetarios" },
    "settings.appearance.dateFormat": { en: "Date Format", es: "Formato de Fecha" },
    "settings.appearance.dateDesc": { en: "How dates are displayed throughout the app", es: "Cómo se muestran las fechas en la aplicación" },
    "settings.appearance.theme": { en: "Theme", es: "Tema" },
    "settings.appearance.themeDesc": { en: "Switch between dark and light mode", es: "Cambiar entre modo oscuro y claro" },
    "settings.appearance.themeDark": { en: "Dark", es: "Oscuro" },
    "settings.appearance.themeLight": { en: "Light", es: "Claro" },
    "settings.appearance.save": { en: "Save Appearance", es: "Guardar Apariencia" },

    // Algorithm section
    "settings.algorithm.title": { en: "The Brain", es: "El Cerebro" },
    "settings.algorithm.subtitle": { en: "Fine-tune the Velocity Banking algorithm parameters.", es: "Ajusta los parámetros del algoritmo de Velocity Banking." },
    "settings.algorithm.strategyMode": { en: "Strategy Mode", es: "Modo de Estrategia" },
    "settings.algorithm.balanced": { en: "Balanced", es: "Balanceado" },
    "settings.algorithm.balancedDesc": { en: "Optimal mix of savings and debt payoff. Recommended.", es: "Mezcla óptima entre ahorro y pago de deudas. Recomendado." },
    "settings.algorithm.aggressive": { en: "Aggressive Velocity", es: "Velocidad Agresiva" },
    "settings.algorithm.aggressiveDesc": { en: "Maximizes cashflow speed. Higher risk tolerance.", es: "Maximiza la velocidad del flujo. Mayor tolerancia al riesgo." },
    "settings.algorithm.emergencyFund": { en: "Emergency Fund Protection Floor", es: "Piso de Protección del Fondo de Emergencia" },
    "settings.algorithm.emergencyDesc": { en: "The amount of cash liquidity the algorithm will NEVER touch.", es: "La cantidad de liquidez que el algoritmo NUNCA tocará." },
    "settings.algorithm.paycheck": { en: "Paycheck Frequency", es: "Frecuencia de Pago" },
    "settings.algorithm.save": { en: "Update Algorithm", es: "Actualizar Algoritmo" },

    // Notifications section
    "settings.notifications.title": { en: "Notification Preferences", es: "Preferencias de Notificaciones" },
    "settings.notifications.subtitle": { en: "Choose what alerts and updates you want to receive.", es: "Elige qué alertas y actualizaciones deseas recibir." },
    "settings.notifications.paymentDue": { en: "Payment Due Alerts", es: "Alertas de Pagos Próximos" },
    "settings.notifications.paymentDueDesc": { en: "Receive alerts 3 days before any due date.", es: "Recibe alertas 3 días antes de cualquier fecha de pago." },
    "settings.notifications.dailySummary": { en: "Daily Strategy Summary", es: "Resumen Estratégico Diario" },
    "settings.notifications.dailySummaryDesc": { en: "Morning briefing of your financial velocity.", es: "Briefing matutino de tu velocidad financiera." },
    "settings.notifications.bankDisconnect": { en: "Bank Disconnect Alerts", es: "Alertas de Desconexión Bancaria" },
    "settings.notifications.bankDisconnectDesc": { en: "Critical alert if Plaid loses connection.", es: "Alerta crítica si Plaid pierde la conexión." },
    "settings.notifications.milestones": { en: "Goal Milestone Celebrations", es: "Celebraciones de Metas Alcanzadas" },
    "settings.notifications.milestonesDesc": { en: "Get notified when you hit freedom milestones.", es: "Recibe notificaciones al alcanzar hitos de libertad." },
    "settings.notifications.weeklyReport": { en: "Weekly Performance Report", es: "Reporte Semanal de Rendimiento" },
    "settings.notifications.weeklyReportDesc": { en: "Sunday summary of your week's financial progress.", es: "Resumen dominical del progreso financiero semanal." },
    "settings.notifications.save": { en: "Save Preferences", es: "Guardar Preferencias" },
    "settings.notifications.enable": { en: "Enable Browser Notifications", es: "Activar Notificaciones del Navegador" },
    "settings.notifications.enableDesc": { en: "Allow CoreX to send you browser notifications for important alerts.", es: "Permite que CoreX te envíe notificaciones del navegador para alertas importantes." },
    "settings.notifications.granted": { en: "Notifications Enabled ✓", es: "Notificaciones Activadas ✓" },
    "settings.notifications.denied": { en: "Notifications Blocked — Check browser settings", es: "Notificaciones Bloqueadas — Revisa la configuración del navegador" },

    // Data Management section
    "settings.data.title": { en: "Data Management", es: "Gestión de Datos" },
    "settings.data.subtitle": { en: "Export, import, and manage your financial data.", es: "Exporta, importa y administra tus datos financieros." },
    "settings.data.exportExcel": { en: "Export to Excel", es: "Exportar a Excel" },
    "settings.data.exportExcelDesc": { en: "Download all your financial data as a multi-sheet Excel workbook.", es: "Descarga todos tus datos financieros como un libro Excel multi-hoja." },
    "settings.data.exportJson": { en: "Export as JSON", es: "Exportar como JSON" },
    "settings.data.exportJsonDesc": { en: "Raw data export for developers or backups.", es: "Exportación de datos crudos para desarrolladores o respaldos." },
    "settings.data.downloadTemplate": { en: "Download Template", es: "Descargar Plantilla" },
    "settings.data.downloadTemplateDesc": { en: "Get a pre-formatted Excel template to fill in your data.", es: "Obtén una plantilla Excel preformateada para llenar tus datos." },
    "settings.data.importExcel": { en: "Import from Excel", es: "Importar desde Excel" },
    "settings.data.importExcelDesc": { en: "Upload a filled template to bulk-import debts and transactions.", es: "Sube una plantilla llena para importar deudas y transacciones masivamente." },
    "settings.data.generatePDF": { en: "Generate PDF Report", es: "Generar Reporte PDF" },
    "settings.data.generatePDFDesc": { en: "Download a monthly summary report as a styled PDF.", es: "Descarga un reporte mensual resumido como PDF estilizado." },
    "settings.data.resetDemo": { en: "Reset Demo Data", es: "Resetear Datos Demo" },
    "settings.data.resetDemoDesc": { en: "Re-seed the database with fresh stress test data.", es: "Re-crear la base de datos con datos de prueba nuevos." },
    "settings.data.clearCache": { en: "Clear Local Cache", es: "Limpiar Caché Local" },
    "settings.data.clearCacheDesc": { en: "Remove all locally stored preferences and cached data.", es: "Elimina todas las preferencias y datos almacenados localmente." },
    "settings.data.dangerZone": { en: "Danger Zone", es: "Zona de Peligro" },

    // About section
    "settings.about.title": { en: "About CoreX", es: "Acerca de CoreX" },
    "settings.about.subtitle": { en: "System information and credits.", es: "Información del sistema y créditos." },
    "settings.about.version": { en: "Version", es: "Versión" },
    "settings.about.build": { en: "Build", es: "Compilación" },
    "settings.about.engine": { en: "Engine", es: "Motor" },
    "settings.about.techStack": { en: "Technology Stack", es: "Stack Tecnológico" },
    "settings.about.madeWith": { en: "Made with ⚡ by CoreX Team", es: "Hecho con ⚡ por el Equipo CoreX" },

    // ═══════════════════════════════════════════════════════════════════
    //  COMMON / SHARED
    // ═══════════════════════════════════════════════════════════════════
    "common.save": { en: "Save", es: "Guardar" },
    "common.cancel": { en: "Cancel", es: "Cancelar" },
    "common.delete": { en: "Delete", es: "Eliminar" },
    "common.edit": { en: "Edit", es: "Editar" },
    "common.confirm": { en: "Confirm", es: "Confirmar" },
    "common.loading": { en: "Loading...", es: "Cargando..." },
    "common.noData": { en: "No data available", es: "Sin datos disponibles" },
    "common.success": { en: "Success!", es: "¡Éxito!" },
    "common.error": { en: "Something went wrong", es: "Algo salió mal" },
    "common.close": { en: "Close", es: "Cerrar" },
};

// ─── Context ────────────────────────────────────────────────────────
interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

// ─── Provider ───────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>(() => {
        const stored = localStorage.getItem("corex-language");
        return (stored === "es" ? "es" : "en") as Language;
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem("corex-language", lang);
    };

    const t = (key: string): string => {
        return translations[key]?.[language] ?? key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

// ─── Hook ───────────────────────────────────────────────────────────
export function useLanguage(): LanguageContextType {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
    return ctx;
}
