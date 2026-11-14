/**
 * WidgetHelp — A subtle "ⓘ" icon that appears on widget hover.
 * Opens a fullscreen modal with blurred backdrop explaining what
 * the widget does, how to use it, and where the data comes from.
 * Uses the LanguageContext for proper ES/EN translation.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface HelpContent {
    title: string;
    titleEs: string;
    icon: string;
    description: string;
    descriptionEs: string;
    bullets: { icon: string; text: string; textEs: string }[];
    location: string;
    locationEs: string;
}

const HELP_CONTENT: Record<string, HelpContent> = {
    velocityClock: {
        title: 'Velocity Engine & Freedom Clock',
        titleEs: 'Motor de Velocidad y Reloj de Libertad',
        icon: '⚡',
        description: 'This is the heart of KoreX — it shows how fast you\'re eliminating debt compared to making only minimum payments.',
        descriptionEs: 'Este es el corazón de KoreX — muestra qué tan rápido estás eliminando deuda comparado con solo hacer pagos mínimos.',
        bullets: [
            { icon: '🏎️', text: 'Speed Multiplier: How many times faster you\'re paying off vs. the bank', textEs: 'Multiplicador de Velocidad: Cuántas veces más rápido pagas vs. el banco' },
            { icon: '📅', text: 'Freedom Date: Projected date when all tracked debt is eliminated', textEs: 'Fecha de Libertad: Fecha proyectada cuando toda la deuda monitoreada se elimina' },
            { icon: '⏳', text: 'Countdown: Years, months, and days until debt freedom', textEs: 'Cuenta Regresiva: Años, meses y días hasta la libertad de deudas' },
            { icon: '📊', text: 'Acceleration Simulator: Slide to see how extra payments shorten your timeline', textEs: 'Simulador de Aceleración: Desliza para ver cómo pagos extra acortan tu línea de tiempo' },
        ],
        location: '📍 Data Source: Calculated from your liabilities in Accounts → Debts',
        locationEs: '📍 Fuente de Datos: Calculado desde tus pasivos en Cuentas → Deudas',
    },
    peaceShield: {
        title: 'Peace Shield',
        titleEs: 'Escudo de Paz',
        icon: '🛡️',
        description: 'Your emergency fund protection meter. Before attacking any debt, KoreX ensures you have a financial safety net.',
        descriptionEs: 'Tu medidor de protección del fondo de emergencia. Antes de atacar cualquier deuda, KoreX se asegura de que tengas un colchón financiero.',
        bullets: [
            { icon: '💰', text: 'Shield Balance: How much cash you have reserved for emergencies', textEs: 'Saldo del Escudo: Cuánto efectivo tienes reservado para emergencias' },
            { icon: '🎯', text: 'Target: Your configured shield goal (default: $2,000)', textEs: 'Objetivo: Tu meta configurada del escudo (default: $2,000)' },
            { icon: '✅', text: 'When fully charged, the "ATTACK Authorized" badge appears', textEs: 'Cuando está completo, aparece la insignia "ATAQUE Autorizado"' },
            { icon: '⚠️', text: 'If shield is low, no debt attacks are recommended until it\'s funded', textEs: 'Si el escudo está bajo, no se recomiendan ataques de deuda hasta que se financie' },
        ],
        location: '📍 Manage: Settings → Profile → Shield Target',
        locationEs: '📍 Gestionar: Configuración → Perfil → Meta del Escudo',
    },
    attackEquity: {
        title: 'Attack Equity',
        titleEs: 'Capital de Ataque',
        icon: '⚔️',
        description: 'Shows your available surplus for debt attacks — the amount you can throw at your highest-APR debt right now.',
        descriptionEs: 'Muestra tu excedente disponible para ataques de deuda — la cantidad que puedes lanzar a tu deuda con mayor APR ahora mismo.',
        bullets: [
            { icon: '💵', text: 'Attack Amount: Chase balance minus shield reserve minus upcoming bills', textEs: 'Monto de Ataque: Saldo de Chase menos reserva del escudo menos facturas próximas' },
            { icon: '🎯', text: 'Target: Shows which debt is recommended to attack and why', textEs: 'Objetivo: Muestra qué deuda se recomienda atacar y por qué' },
            { icon: '📅', text: 'Next Action: When to execute the next lump-sum payment', textEs: 'Próxima Acción: Cuándo ejecutar el próximo pago de suma global' },
            { icon: '🔄', text: 'Updates daily based on your cashflow and upcoming bills', textEs: 'Se actualiza diariamente basado en tu flujo de caja y facturas próximas' },
        ],
        location: '📍 Data Source: Accounts → Chase checking + scheduled transactions',
        locationEs: '📍 Fuente de Datos: Cuentas → Chase checking + transacciones programadas',
    },
    kpiCards: {
        title: 'Financial KPIs',
        titleEs: 'KPIs Financieros',
        icon: '📊',
        description: 'Quick-glance financial health metrics showing your total debt, liquid cash, and projected interest savings.',
        descriptionEs: 'Métricas de salud financiera en un vistazo que muestran tu deuda total, efectivo líquido y ahorro proyectado de intereses.',
        bullets: [
            { icon: '🔴', text: 'Total Debt: Sum of all tracked liability balances', textEs: 'Deuda Total: Suma de todos los saldos de pasivos monitoreados' },
            { icon: '🟢', text: 'Liquid Cash: All asset account balances available now', textEs: 'Efectivo Líquido: Todos los saldos de cuentas de activos disponibles ahora' },
            { icon: '🟡', text: 'Projected Savings: Total interest you won\'t pay thanks to velocity strategy', textEs: 'Ahorro Proyectado: Interés total que no pagarás gracias a la estrategia de velocidad' },
            { icon: '🔒', text: 'Unmonitored Debt: Debts locked by plan limits (upgrade to track)', textEs: 'Deuda No Monitoreada: Deudas bloqueadas por límites del plan (actualiza para monitorear)' },
        ],
        location: '📍 Data Source: Accounts page → All assets & liabilities',
        locationEs: '📍 Fuente de Datos: Página de Cuentas → Todos los activos y pasivos',
    },
    morningBriefing: {
        title: 'Opportunity Detected',
        titleEs: 'Oportunidad Detectada',
        icon: '🎯',
        description: 'KoreX scans your accounts in real time and detects when you have surplus cash available to attack debt. When your liquid cash exceeds your Peace Shield reserve + upcoming bills, this card appears with a recommended transfer — ready to execute.',
        descriptionEs: 'KoreX escanea tus cuentas en tiempo real y detecta cuándo tienes efectivo excedente disponible para atacar deuda. Cuando tu efectivo líquido supera tu reserva del Escudo de Paz + facturas próximas, aparece esta tarjeta con una transferencia recomendada — lista para ejecutar.',
        bullets: [
            { icon: '🔍', text: 'How it detects: Compares your liquid cash vs. Shield reserve + scheduled expenses', textEs: 'Cómo detecta: Compara tu efectivo líquido vs. la Reserva del Escudo + gastos programados' },
            { icon: '🎯', text: 'Target selection: Always picks your highest APR debt first (Avalanche method)', textEs: 'Selección de objetivo: Siempre elige tu deuda con mayor APR primero (método Avalancha)' },
            { icon: '💰', text: 'Amount suggested: The exact surplus available after protecting your Shield and bills', textEs: 'Monto sugerido: El excedente exacto disponible después de proteger tu Escudo y facturas' },
            { icon: '📈', text: 'Impact preview: Shows days of debt eliminated, monthly interest saved, and freedom hours gained', textEs: 'Vista previa de impacto: Muestra días de deuda eliminados, interés mensual ahorrado y horas de libertad ganadas' },
            { icon: '⚡', text: 'Execute: Click the action button to go to the Strategy page and follow the step-by-step transfer instructions', textEs: 'Ejecutar: Haz clic en el botón de acción para ir a la página de Estrategia y seguir las instrucciones paso a paso' },
        ],
        location: '📍 Appears automatically when surplus cash is detected. Execute from Strategy → Action Plan',
        locationEs: '📍 Aparece automáticamente cuando se detecta efectivo excedente. Ejecuta desde Estrategia → Plan de Acción',
    },
    heatCalendar: {
        title: 'Cashflow Heat Map',
        titleEs: 'Mapa de Calor de Flujo de Caja',
        icon: '🗓️',
        description: 'A 6-month projection calendar showing your daily cash balance. Colors indicate your financial health each day. Click any day to see a detailed breakdown.',
        descriptionEs: 'Un calendario de proyección de 6 meses mostrando tu saldo de efectivo diario. Los colores indican tu salud financiera cada día. Haz clic en cualquier día para ver un desglose detallado.',
        bullets: [
            { icon: '🔴', text: 'Red/Orange: Low balance days — tight cashflow periods', textEs: 'Rojo/Naranja: Días de saldo bajo — períodos de flujo apretado' },
            { icon: '🟡', text: 'Yellow: Moderate balance — enough but not flexible', textEs: 'Amarillo: Saldo moderado — suficiente pero sin flexibilidad' },
            { icon: '🟢', text: 'Green: Healthy surplus — good days for debt attacks', textEs: 'Verde: Excedente saludable — buenos días para ataques de deuda' },
            { icon: '👆', text: 'Click any day to see the detailed breakdown of income and expenses', textEs: 'Haz clic en cualquier día para ver el desglose detallado de ingresos y gastos' },
            { icon: '📊', text: 'Min / Today / Max: Your lowest projected balance, current balance, and highest projected balance across 6 months', textEs: 'Min / Hoy / Máx: Tu saldo proyectado más bajo, saldo actual, y saldo proyectado más alto en 6 meses' },
        ],
        location: '📍 Data Source: Income & Expense schedules → Settings → Transactions',
        locationEs: '📍 Fuente de Datos: Calendarios de Ingresos y Gastos → Configuración → Transacciones',
    },
    burndownChart: {
        title: 'Debt Burndown Projection',
        titleEs: 'Proyección de Liquidación de Deuda',
        icon: '📉',
        description: 'Compares two timelines — how long the bank expects you to pay vs. how fast KoreX will eliminate your debt.',
        descriptionEs: 'Compara dos líneas de tiempo — cuánto espera el banco que pagues vs. qué tan rápido KoreX eliminará tu deuda.',
        bullets: [
            { icon: '🏦', text: 'Bank Timeline (red): Standard minimum payment schedule', textEs: 'Línea del Banco (rojo): Calendario estándar de pagos mínimos' },
            { icon: '⚡', text: 'KoreX Timeline (green): Accelerated payoff with velocity strategy', textEs: 'Línea de KoreX (verde): Liquidación acelerada con estrategia de velocidad' },
            { icon: '📅', text: 'The gap between lines = months of payments you\'re cutting', textEs: 'La brecha entre líneas = meses de pagos que estás cortando' },
            { icon: '🎯', text: 'Goal: Make the green line hit $0 as fast as possible', textEs: 'Objetivo: Hacer que la línea verde llegue a $0 lo más rápido posible' },
        ],
        location: '📍 Data Source: Accounts page → Liabilities (APR, balance, minimum payments)',
        locationEs: '📍 Fuente de Datos: Página de Cuentas → Pasivos (APR, saldo, pagos mínimos)',
    },
    purchaseSimulator: {
        title: 'Purchase Simulator',
        titleEs: 'Simulador de Compras',
        icon: '🛒',
        description: 'Enter any purchase amount to see its TRUE cost — how many extra days of debt and additional interest it would add.',
        descriptionEs: 'Ingresa cualquier monto de compra para ver su costo REAL — cuántos días extra de deuda e interés adicional agregaría.',
        bullets: [
            { icon: '💳', text: 'Type any amount or use quick presets (coffee, dinner, trip, etc.)', textEs: 'Escribe cualquier monto o usa los presets rápidos (café, cena, viaje, etc.)' },
            { icon: '⏰', text: 'Days Added: Extra days that purchase adds to your debt freedom date', textEs: 'Días Agregados: Días extra que esa compra agrega a tu fecha de libertad de deudas' },
            { icon: '💸', text: 'Interest Cost: Extra interest you\'d pay on that purchase over time', textEs: 'Costo de Interés: Interés extra que pagarías por esa compra a lo largo del tiempo' },
            { icon: '🤔', text: 'Think twice before buying — is it worth X extra days of debt?', textEs: 'Piénsalo dos veces antes de comprar — ¿vale la pena X días extra de deuda?' },
        ],
        location: '📍 How to Use: Enter an amount → Click "Analyze" → See the impact',
        locationEs: '📍 Cómo Usar: Ingresa un monto → Haz clic en "Analizar" → Ve el impacto',
    },
    recentTransactions: {
        title: 'Recent Transactions',
        titleEs: 'Transacciones Recientes',
        icon: '📋',
        description: 'Your latest income and expense entries — the raw data that powers all KoreX calculations and projections.',
        descriptionEs: 'Tus últimas entradas de ingresos y gastos — los datos crudos que alimentan todos los cálculos y proyecciones de KoreX.',
        bullets: [
            { icon: '🟢', text: 'Green amounts: Income — cash flowing into your accounts', textEs: 'Montos verdes: Ingresos — efectivo fluyendo a tus cuentas' },
            { icon: '🔴', text: 'Red amounts: Expenses — cash leaving your accounts', textEs: 'Montos rojos: Gastos — efectivo saliendo de tus cuentas' },
            { icon: '🏷️', text: 'Categories help KoreX understand your spending patterns', textEs: 'Las categorías ayudan a KoreX a entender tus patrones de gasto' },
            { icon: '➕', text: 'Add transactions via the + Income / - Expense buttons at the top', textEs: 'Agrega transacciones con los botones + Ingreso / - Gasto en la parte superior' },
        ],
        location: '📍 Manage: Use + Income / - Expense buttons or Settings → Transactions',
        locationEs: '📍 Gestionar: Usa los botones + Ingreso / - Gasto o Configuración → Transacciones',
    },

    // ── Strategy Page Widgets ──────────────────────────────────

    confidenceMeter: {
        title: 'Confidence Meter',
        titleEs: 'Medidor de Confianza',
        icon: '🎯',
        description: 'A real-time score that measures how well your debt elimination strategy is performing based on multiple factors.',
        descriptionEs: 'Un puntaje en tiempo real que mide qué tan bien está funcionando tu estrategia de eliminación de deuda basándose en múltiples factores.',
        bullets: [
            { icon: '📊', text: 'Score 0-100: Combines shield health, attack frequency, and debt trajectory', textEs: 'Puntaje 0-100: Combina salud del escudo, frecuencia de ataque y trayectoria de deuda' },
            { icon: '🟢', text: 'Green zone (70+): Your strategy is strong — keep attacking', textEs: 'Zona verde (70+): Tu estrategia es fuerte — sigue atacando' },
            { icon: '🟡', text: 'Yellow zone (40-70): Room for improvement — review your cashflow', textEs: 'Zona amarilla (40-70): Hay espacio para mejorar — revisa tu flujo de caja' },
            { icon: '🔴', text: 'Red zone (<40): Urgent — shield may be low or no attacks have been made', textEs: 'Zona roja (<40): Urgente — el escudo puede estar bajo o no se han hecho ataques' },
        ],
        location: '📍 Improve: Fund your Peace Shield and execute recommended attacks consistently',
        locationEs: '📍 Mejorar: Fonde tu Escudo de Paz y ejecuta los ataques recomendados consistentemente',
    },
    freedomCounter: {
        title: 'Freedom Counter',
        titleEs: 'Contador de Libertad',
        icon: '🏆',
        description: 'Tracks your cumulative progress toward debt freedom — every attack you make gets recorded here.',
        descriptionEs: 'Rastrea tu progreso acumulado hacia la libertad de deudas — cada ataque que haces se registra aquí.',
        bullets: [
            { icon: '⚡', text: 'Total Attacks: Number of lump-sum debt payments you\'ve executed', textEs: 'Ataques Totales: Número de pagos de suma global que has ejecutado' },
            { icon: '💰', text: 'Amount Deployed: Total cash you\'ve moved against debt', textEs: 'Monto Desplegado: Total de efectivo que has movido contra la deuda' },
            { icon: '🔥', text: 'Streak: Consecutive days/weeks with at least one attack', textEs: 'Racha: Días/semanas consecutivas con al menos un ataque' },
            { icon: '📅', text: 'Days accelerated: How many payment days you\'ve eliminated', textEs: 'Días acelerados: Cuántos días de pagos has eliminado' },
        ],
        location: '📍 Boost: Execute attacks from the Action Plan to increase your streak',
        locationEs: '📍 Impulsar: Ejecuta ataques desde el Plan de Acción para aumentar tu racha',
    },
    attackDecision: {
        title: 'Attack Decision Helper',
        titleEs: 'Asistente de Decisión de Ataque',
        icon: '🧠',
        description: 'When multiple options exist, this widget shows you the pros and cons of each attack strategy so you can choose wisely.',
        descriptionEs: 'Cuando existen múltiples opciones, este widget te muestra los pros y contras de cada estrategia de ataque para que elijas sabiamente.',
        bullets: [
            { icon: '🎯', text: 'Full attack: everything to your highest-APR debt (the avalanche) — eliminates the most interest', textEs: 'Ataque completo: todo a tu deuda de mayor APR (la avalancha) — elimina el mayor interés' },
            { icon: '🛡️', text: 'Boost shield or balanced split: same target, less money now, more safety', textEs: 'Reforzar escudo o mitad y mitad: el mismo objetivo, menos dinero ahora, más seguridad' },
            { icon: '📊', text: 'Impact comparison: See days saved and interest prevented for each option', textEs: 'Comparación de impacto: Ve días ahorrados e interés prevenido por cada opción' },
            { icon: '✅', text: 'Select your preferred strategy and KoreX executes it', textEs: 'Selecciona tu estrategia preferida y KoreX la ejecuta' },
        ],
        location: '📍 Execute: Choose an option → KoreX prepares the transfer instructions',
        locationEs: '📍 Ejecutar: Elige una opción → KoreX prepara las instrucciones de transferencia',
    },
    tacticalMap: {
        title: 'Tactical Cashflow Map',
        titleEs: 'Mapa Táctico de Flujo de Caja',
        icon: '🗺️',
        description: 'An interactive timeline showing every scheduled income and expense, helping you visualize future cash positions for attack planning.',
        descriptionEs: 'Una línea de tiempo interactiva mostrando cada ingreso y gasto programado, ayudándote a visualizar posiciones de efectivo futuras para planificar ataques.',
        bullets: [
            { icon: '🟢', text: 'Green bars: Incoming cash (salary, deposits, etc.)', textEs: 'Barras verdes: Efectivo entrante (salario, depósitos, etc.)' },
            { icon: '🔴', text: 'Red bars: Outgoing cash (bills, expenses)', textEs: 'Barras rojas: Efectivo saliente (facturas, gastos)' },
            { icon: '📈', text: 'Balance line: Your projected rolling cash balance', textEs: 'Línea de saldo: Tu saldo de efectivo proyectado' },
            { icon: '🎯', text: 'Find the best days to attack — when your balance peaks', textEs: 'Encuentra los mejores días para atacar — cuando tu saldo alcanza su máximo' },
        ],
        location: '📍 Data Source: Income & Expense schedules from Settings → Transactions',
        locationEs: '📍 Fuente de Datos: Calendarios de Ingresos y Gastos desde Configuración → Transacciones',
    },

    // ── Accounts Page Sections ─────────────────────────────────

    liabilitiesSection: {
        title: 'Liabilities (Debts)',
        titleEs: 'Pasivos (Deudas)',
        icon: '💳',
        description: 'All your tracked debts ordered by APR (highest first). These are the targets KoreX attacks to free you from interest payments.',
        descriptionEs: 'Todas tus deudas monitoreadas ordenadas por APR (mayor primero). Estos son los objetivos que KoreX ataca para liberarte de pagos de interés.',
        bullets: [
            { icon: '🎯', text: 'Priority order: Highest APR always on top — that\'s the kill target', textEs: 'Orden de prioridad: Mayor APR siempre arriba — ese es el objetivo a eliminar' },
            { icon: '📊', text: 'Daily drain: Shows how much interest each debt costs you per day', textEs: 'Drenaje diario: Muestra cuánto interés te cuesta cada deuda por día' },
            { icon: '🔒', text: 'Locked accounts: Beyond your plan limit — upgrade to monitor them', textEs: 'Cuentas bloqueadas: Más allá del límite de tu plan — actualiza para monitorearlas' },
            { icon: '➕', text: 'Add debts with the "+ Add Account" button at the top', textEs: 'Agrega deudas con el botón "+ Agregar Cuenta" en la parte superior' },
        ],
        location: '📍 Action: Make manual payments or record balance changes from each card',
        locationEs: '📍 Acción: Realiza pagos manuales o registra cambios de saldo desde cada tarjeta',
    },
    assetsSection: {
        title: 'Assets (Liquid Cash)',
        titleEs: 'Activos (Efectivo Líquido)',
        icon: '🏦',
        description: 'Your checking and savings accounts — the cash reserves KoreX uses for Peace Shield calculations and attack planning.',
        descriptionEs: 'Tus cuentas de cheques y ahorro — las reservas de efectivo que KoreX usa para cálculos del Escudo de Paz y planificación de ataques.',
        bullets: [
            { icon: '🛡️', text: 'Peace Shield draws from these balances to ensure your emergency fund', textEs: 'El Escudo de Paz se alimenta de estos saldos para asegurar tu fondo de emergencia' },
            { icon: '⚔️', text: 'Attack Equity = Asset balance − Shield reserve − Upcoming bills', textEs: 'Capital de Ataque = Saldo de activos − Reserva del escudo − Facturas próximas' },
            { icon: '💰', text: 'Deposit and spend buttons keep balances up to date manually', textEs: 'Los botones de depósito y gasto mantienen los saldos actualizados manualmente' },
            { icon: '📋', text: 'Transaction history available for each account via the list icon', textEs: 'Historial de transacciones disponible para cada cuenta vía el ícono de lista' },
        ],
        location: '📍 Tip: Keep balances current for accurate attack recommendations',
        locationEs: '📍 Consejo: Mantén los saldos actualizados para recomendaciones de ataque precisas',
    },

    // ── Quick Transactions (Dashboard) ──────────────────────────
    quickTransactions: {
        title: 'Quick Transactions',
        titleEs: 'Transacciones Rápidas',
        icon: '💸',
        description: 'Record unplanned income or expenses that aren\'t part of your recurring schedules. These one-time entries keep your projections accurate.',
        descriptionEs: 'Registra ingresos o gastos no planificados que no forman parte de tus recurrentes. Estas entradas únicas mantienen tus proyecciones precisas.',
        bullets: [
            { icon: '➕', text: '+ Income: Record unexpected cash (refunds, gifts, freelance, etc.)', textEs: '+ Ingreso: Registra efectivo inesperado (reembolsos, regalos, freelance, etc.)' },
            { icon: '➖', text: '- Expense: Record unplanned spending (repairs, medical, impulse buys)', textEs: '- Gasto: Registra gastos no planificados (reparaciones, médicos, compras impulsivas)' },
            { icon: '📊', text: 'These update your Heat Map, Attack Equity, and projections in real time', textEs: 'Actualizan tu Mapa de Calor, Capital de Ataque y proyecciones en tiempo real' },
            { icon: '🔄', text: 'For recurring items (salary, rent), use Settings → Transactions instead', textEs: 'Para items recurrentes (salario, renta), usa Configuración → Transacciones' },
        ],
        location: '📍 Tip: Log every unplanned transaction to keep the engine calibrated',
        locationEs: '📍 Consejo: Registra cada transacción no planificada para mantener el motor calibrado',
    },

    // ── Action Plan Table Guide ──────────────────────────────────
    actionPlanTable: {
        title: 'Action Queue Guide',
        titleEs: 'Guía de Cola de Acciones',
        icon: '📋',
        description: 'Your monthly step-by-step execution plan. Each row is a financial move KoreX has scheduled for you based on your cashflow and debt strategy.',
        descriptionEs: 'Tu plan de ejecución paso a paso mensual. Cada fila es un movimiento financiero que KoreX programó según tu flujo de caja y estrategia de deuda.',
        bullets: [
            { icon: '📅', text: 'Date: When to execute this move (today\'s row is highlighted)', textEs: 'Fecha: Cuándo ejecutar este movimiento (la fila de hoy está resaltada)' },
            { icon: '📝', text: 'Action: What to do — pay a bill, attack debt, or fund your shield', textEs: 'Acción: Qué hacer — pagar una factura, atacar deuda, o fondear tu escudo' },
            { icon: '🏦', text: 'From → To: Which account to move money from, and where it goes', textEs: 'Desde → Hacia: De cuál cuenta mover dinero, y a dónde va' },
            { icon: '💰', text: 'Amount: How much to transfer in this move', textEs: 'Monto: Cuánto transferir en este movimiento' },
            { icon: '🏷️', text: 'Type: ⚔️ Attack (debt), 🛡️ Shield, 📄 Bill, or 💰 Income', textEs: 'Tipo: ⚔️ Ataque (deuda), 🛡️ Escudo, 📄 Factura, o 💰 Ingreso' },
            { icon: '✅', text: 'Execute: Click the checkmark ✓ when you\'ve completed the move in your bank', textEs: 'Ejecutar: Haz clic en ✓ cuando hayas completado el movimiento en tu banco' },
        ],
        location: '📍 Execute: Work top-to-bottom — follow each step in your bank app',
        locationEs: '📍 Ejecutar: Trabaja de arriba hacia abajo — sigue cada paso en tu app bancaria',
    },

    // ── Accounts Page: Cashflow Overview ────────────────────────
    cashflowOverview: {
        title: 'Financial Overview',
        titleEs: 'Resumen Financiero',
        icon: '📈',
        description: 'A bird\'s-eye view of your financial health — total debt, liquid cash, net worth, and monthly cashflow analysis.',
        descriptionEs: 'Una vista panorámica de tu salud financiera — deuda total, efectivo líquido, patrimonio neto y análisis mensual de flujo de caja.',
        bullets: [
            { icon: '📊', text: 'Net Worth: Assets minus Liabilities — your true financial position', textEs: 'Patrimonio Neto: Activos menos Pasivos — tu posición financiera real' },
            { icon: '💰', text: 'Liquid Cash: Total cash available across all asset accounts', textEs: 'Efectivo Líquido: Total de efectivo disponible en todas tus cuentas de activos' },
            { icon: '💳', text: 'Total Debt: Combined balance of all tracked liabilities', textEs: 'Deuda Total: Saldo combinado de todos los pasivos monitoreados' },
            { icon: '📈', text: 'Cashflow: Monthly income vs expenses breakdown + surplus/deficit', textEs: 'Flujo de Caja: Desglose mensual de ingresos vs gastos + excedente/déficit' },
        ],
        location: '📍 Manage: Add or edit accounts below to keep your overview accurate',
        locationEs: '📍 Gestionar: Agrega o edita cuentas abajo para mantener tu resumen preciso',
    },

    // ── Phase 2-3 Dashboard Widgets ─────────────────────────────

    commanderBadge: {
        title: 'Commander Rank Badge',
        titleEs: 'Insignia de Rango de Comandante',
        icon: '🎖️',
        description: 'Your military rank in the KoreX army — earned by registering transactions consistently day after day.',
        descriptionEs: 'Tu rango militar en el ejército KoreX — ganado registrando transacciones consistentemente día tras día.',
        bullets: [
            { icon: '⭐', text: '90 total ranks: 9 military ranks × 10 material tiers (Wood → Legendary)', textEs: '90 rangos totales: 9 rangos militares × 10 materiales (Madera → Legendario)' },
            { icon: '🔥', text: 'Register a transaction daily to increase your streak score', textEs: 'Registra una transacción diaria para aumentar tu puntaje de racha' },
            { icon: '⚠️', text: 'Missing a day deducts 2 points — stay consistent!', textEs: 'Perder un día resta 2 puntos — ¡mantén la constancia!' },
            { icon: '👑', text: 'VIP members earn 2x XP and reach max rank twice as fast', textEs: 'Miembros VIP ganan 2x XP y alcanzan el rango máximo el doble de rápido' },
        ],
        location: '📍 Progress: Register transactions daily → Rankings page for full details',
        locationEs: '📍 Progreso: Registra transacciones diariamente → Página de Rankings para más detalles',
    },
    debtFreeCountdown: {
        title: 'Debt-Free Countdown',
        titleEs: 'Cuenta Regresiva Libre de Deudas',
        icon: '⏳',
        description: 'Shows your estimated date of total debt freedom based on your current velocity strategy and payment pace.',
        descriptionEs: 'Muestra tu fecha estimada de libertad total de deudas basada en tu estrategia de velocidad y ritmo de pagos.',
        bullets: [
            { icon: '📅', text: 'Target date: When KoreX projects you\'ll be 100% debt-free', textEs: 'Fecha objetivo: Cuándo KoreX proyecta que estarás 100% libre de deudas' },
            { icon: '⚡', text: 'Based on your velocity strategy — faster than minimum payments', textEs: 'Basado en tu estrategia de velocidad — más rápido que pagos mínimos' },
            { icon: '💡', text: 'Fund your Peace Shield and execute attacks to accelerate this date', textEs: 'Fondea tu Escudo de Paz y ejecuta ataques para acelerar esta fecha' },
            { icon: '📊', text: 'Updates dynamically as you make payments and record transactions', textEs: 'Se actualiza dinámicamente conforme haces pagos y registras transacciones' },
        ],
        location: '📍 Data Source: Velocity Engine projections → Accounts → Liabilities',
        locationEs: '📍 Fuente de Datos: Proyecciones del Motor de Velocidad → Cuentas → Pasivos',
    },
    healthScore: {
        title: 'Financial Health Score',
        titleEs: 'Puntaje de Salud Financiera',
        icon: '💚',
        description: 'A composite 0-100 score measuring your overall financial wellness based on five key factors.',
        descriptionEs: 'Un puntaje compuesto 0-100 que mide tu bienestar financiero general basado en cinco factores clave.',
        bullets: [
            { icon: '🛡️', text: 'Shield Fill: How well-funded your emergency reserve is', textEs: 'Escudo Lleno: Qué tan fondeada está tu reserva de emergencia' },
            { icon: '📉', text: 'Debt Reduction: Progress reducing your total debt balance', textEs: 'Reducción de Deuda: Progreso reduciendo tu saldo total de deuda' },
            { icon: '🔥', text: 'Consistency: Your daily streak score rewards discipline', textEs: 'Constancia: Tu puntaje de racha diaria premia la disciplina' },
            { icon: '💰', text: 'Cash Ratio: Liquid cash relative to total debt — higher is better', textEs: 'Ratio de Efectivo: Efectivo líquido relativo a deuda total — mayor es mejor' },
        ],
        location: '📍 Improve: Fund shield + attack debts + register transactions daily',
        locationEs: '📍 Mejorar: Fondea escudo + ataca deudas + registra transacciones diariamente',
    },
    achievementWall: {
        title: 'Achievement Wall',
        titleEs: 'Muro de Logros',
        icon: '🏅',
        description: 'Your collection of unlockable badges earned through financial milestones — consistency, rank progression, and debt elimination.',
        descriptionEs: 'Tu colección de insignias desbloqueables ganadas a través de hitos financieros — constancia, progresión de rango y eliminación de deuda.',
        bullets: [
            { icon: '🔓', text: 'Colored badges = earned! Grayscale = locked — keep working toward them', textEs: 'Insignias a color = ganadas! Escala de grises = bloqueadas — sigue trabajando' },
            { icon: '🔥', text: 'Streak badges: 7, 14, 30, 90, 365 consecutive days with transactions', textEs: 'Insignias de racha: 7, 14, 30, 90, 365 días consecutivos con transacciones' },
            { icon: '🎖️', text: 'Rank badges: Reach Iron, Gold, Diamond, and Legendary materials', textEs: 'Insignias de rango: Alcanza Hierro, Oro, Diamante y Legendario' },
            { icon: '💰', text: 'Financial badges: Shield at 100%, debts eliminated, and more', textEs: 'Insignias financieras: Escudo al 100%, deudas eliminadas, y más' },
        ],
        location: '📍 Progress: Rankings page shows detailed path to each badge',
        locationEs: '📍 Progreso: La página de Rankings muestra el camino detallado a cada insignia',
    },
    beforeAfter: {
        title: 'Before vs After',
        titleEs: 'Antes vs Después',
        icon: '📊',
        description: 'Visual comparison of your starting debt vs. current debt — proof that your strategy is working and your discipline is paying off.',
        descriptionEs: 'Comparación visual de tu deuda inicial vs. actual — prueba de que tu estrategia está funcionando y tu disciplina está rindiendo frutos.',
        bullets: [
            { icon: '🔴', text: 'BEFORE: Your total debt when you first joined KoreX', textEs: 'ANTES: Tu deuda total cuando te uniste a KoreX por primera vez' },
            { icon: '🟢', text: 'NOW: Your current total debt — watch it shrink over time', textEs: 'AHORA: Tu deuda total actual — mírala reducirse con el tiempo' },
            { icon: '📉', text: 'Reduction %: The percentage of debt you\'ve eliminated so far', textEs: 'Reducción %: El porcentaje de deuda que has eliminado hasta ahora' },
            { icon: '🎯', text: 'Goal: Make the "Now" number reach $0 — financial freedom!', textEs: 'Objetivo: Haz que el número "Ahora" llegue a $0 — ¡libertad financiera!' },
        ],
        location: '📍 Data Source: Starting debt snapshot (first visit) vs. current Accounts balance',
        locationEs: '📍 Fuente de Datos: Foto de deuda inicial (primera visita) vs. saldo actual de Cuentas',
    },

    // ── Rankings Page Widgets ────────────────────────────────────

    rankHero: {
        title: 'Your Commander Rank',
        titleEs: 'Tu Rango de Comandante',
        icon: '🎖️',
        description: 'Your rank is determined by streak points (XP) accumulated by logging transactions daily. The ranking system has 90 total levels across 10 material tiers and 9 military ranks.',
        descriptionEs: 'Tu rango se determina por los puntos de racha (XP) que acumulas al registrar transacciones diariamente. El sistema de rangos tiene 90 niveles totales en 10 materiales y 9 rangos militares.',
        bullets: [
            { icon: '🔥', text: 'Streak Points: Each daily transaction adds to your streak score', textEs: 'Puntos de Racha: Cada transacción diaria suma a tu puntaje de racha' },
            { icon: '⚡', text: 'Effective XP: Your streak score with VIP multiplier applied', textEs: 'XP Efectivo: Tu puntaje de racha con el multiplicador VIP aplicado' },
            { icon: '👑', text: 'VIP members earn 2x XP, reaching max rank twice as fast', textEs: 'Miembros VIP ganan 2x XP, alcanzando el rango máximo el doble de rápido' },
            { icon: '📊', text: 'Progress bar shows your advancement to the next rank', textEs: 'La barra de progreso muestra tu avance al siguiente rango' },
        ],
        location: '📍 Boost: Register at least 1 transaction daily to increase your streak',
        locationEs: '📍 Impulsar: Registra al menos 1 transacción diaria para aumentar tu racha',
    },
    howItWorks: {
        title: 'How Ranking Works',
        titleEs: 'Cómo Funciona el Sistema de Rangos',
        icon: '🛡️',
        description: 'Three core mechanics power the ranking system: daily transaction logging, inactivity penalties, and VIP bonus multipliers.',
        descriptionEs: 'Tres mecánicas principales impulsan el sistema de rangos: registro diario de transacciones, penalización por inactividad, y multiplicadores de bonus VIP.',
        bullets: [
            { icon: '✅', text: 'Rank Up: Register at least 1 transaction daily to earn streak points', textEs: 'Sube de Rango: Registra al menos 1 transacción diaria para ganar puntos de racha' },
            { icon: '⚠️', text: 'Penalty: Each missed day deducts 2 points from your streak', textEs: 'Penalización: Cada día sin registro resta 2 puntos de tu racha' },
            { icon: '👑', text: 'VIP Boost: Paid members earn 2x XP per transaction logged', textEs: 'Boost VIP: Miembros pagados ganan 2x XP por transacción registrada' },
            { icon: '🎯', text: 'Consistency is key — small daily habits build massive progress', textEs: 'La constancia es clave — pequeños hábitos diarios construyen progreso masivo' },
        ],
        location: '📍 Navigate: Rankings → Full Rank Table to see all 90 levels',
        locationEs: '📍 Navegar: Rankings → Tabla Completa de Rangos para ver los 90 niveles',
    },
    rankBenefits: {
        title: 'Rank Benefits',
        titleEs: 'Beneficios por Rango',
        icon: '⭐',
        description: 'As you rank up you unlock tangible benefits: achievement badges, better financial health score, disciplined habits, and visual prestige throughout the app.',
        descriptionEs: 'Conforme subes de rango desbloqueas beneficios tangibles: insignias de logro, mejor puntaje de salud financiera, hábitos disciplinados y prestigio visual en toda la app.',
        bullets: [
            { icon: '🏅', text: 'Achievement Badges: Unlock exclusive badges on your Achievement Wall', textEs: 'Insignias de Logro: Desbloquea insignias exclusivas en tu Muro de Logros' },
            { icon: '💚', text: 'Financial Health: Your rank directly contributes to your Health Score', textEs: 'Salud Financiera: Tu rango contribuye directamente a tu Puntaje de Salud' },
            { icon: '🎯', text: 'Discipline: Daily streaks build the most powerful financial habit', textEs: 'Disciplina: Las rachas diarias construyen el hábito financiero más poderoso' },
            { icon: '✨', text: 'Visual Prestige: Your rank glows on Dashboard and sidebar', textEs: 'Prestigio Visual: Tu rango brilla en el Dashboard y la barra lateral' },
        ],
        location: '📍 Progress: Keep ranking up to unlock all badges and visual upgrades',
        locationEs: '📍 Progreso: Sigue subiendo de rango para desbloquear todas las insignias y mejoras visuales',
    },

    // ── Add Transaction Dialog (Dashboard) ─────────────────────────
    addTransaction: {
        title: 'How to Register a Transaction',
        titleEs: 'Cómo Registrar una Transacción',
        icon: '📝',
        description: 'Registering income and expenses keeps your financial picture up to date. Every entry updates your projections, attack equity, and heat map in real time.',
        descriptionEs: 'Registrar ingresos y gastos mantiene tu panorama financiero actualizado. Cada entrada actualiza tus proyecciones, capital de ataque y mapa de calor en tiempo real.',
        bullets: [
            { icon: '🔄', text: 'Income vs Expense: Select the tab matching your transaction type', textEs: 'Ingreso vs Gasto: Selecciona la pestaña que corresponda al tipo de transacción' },
            { icon: '💵', text: 'Amount: Enter the exact amount received or spent', textEs: 'Monto: Ingresa la cantidad exacta recibida o gastada' },
            { icon: '🏦', text: 'Account: Select the account where money enters (income) or exits (expense)', textEs: 'Cuenta: Selecciona la cuenta donde entra (ingreso) o sale (gasto) el dinero' },
            { icon: '🏷️', text: 'Category: Optional label to track spending patterns (Food, Rent, Gas, etc.)', textEs: 'Categoría: Etiqueta opcional para rastrear patrones de gasto (Comida, Renta, Gas, etc.)' },
            { icon: '🔥', text: 'Streak Bonus: Each daily transaction adds to your Commander streak!', textEs: '¡Bono de Racha: Cada transacción diaria suma a tu racha de Comandante!' },
        ],
        location: '📍 Tip: Log at least one transaction per day to maintain your streak and rank',
        locationEs: '📍 Consejo: Registra al menos una transacción al día para mantener tu racha y rango',
    },
};

interface WidgetHelpProps {
    helpKey: string;
}

export function WidgetHelp({ helpKey }: WidgetHelpProps) {
    const [open, setOpen] = useState(false);
    const { language } = useLanguage();
    const content = HELP_CONTENT[helpKey];

    if (!content) return null;

    const isEs = language === 'es';
    const title = isEs ? content.titleEs : content.title;
    const desc = isEs ? content.descriptionEs : content.description;
    const location = isEs ? content.locationEs : content.location;

    return (
        <>
            {/* Subtle info icon — only visible on parent hover, positioned top-right */}
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                className="absolute top-2.5 left-2.5 z-[1] p-1 rounded-full
                    text-kx-ink group-hover:text-kx-ink3 hover:!text-kx-amber
                    hover:!bg-[color-mix(in_srgb,var(--kx-amber)_10%,transparent)] transition-all duration-300 opacity-0
                    group-hover:opacity-100"
                aria-label="Widget help"
                title={isEs ? 'Ayuda del widget' : 'Widget help'}
            >
                <Info size={13} strokeWidth={1.5} />
            </button>

            {/* Fullscreen Modal — rendered via Portal to avoid parent transform clipping */}
            {createPortal(
                <AnimatePresence>
                    {open && (
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                onClick={() => setOpen(false)}
                            />

                            {/* Modal Card */}
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                                transition={{ duration: 0.25, ease: 'easeOut' }}
                                className="relative z-10 w-full max-w-lg"
                            >
                                <div className="bg-[#0f0f0f]/95 backdrop-blur-xl border border-kx-line rounded-2xl shadow-2xl overflow-hidden">
                                    {/* Accent bar */}
                                    <div className="h-1 bg-kx-amber " />

                                    <div className="p-6">
                                        {/* Close button */}
                                        <button
                                            onClick={() => setOpen(false)}
                                            className="absolute top-4 right-4 text-kx-ink3 hover:text-kx-ink transition-colors p-1 rounded-full hover:bg-kx-raised"
                                        >
                                            <X size={18} />
                                        </button>

                                        {/* Icon + Title */}
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--kx-amber)_10%,transparent)] border border-[color-mix(in_srgb,var(--kx-amber)_20%,transparent)] text-xl">
                                                {content.icon}
                                            </div>
                                            <h2 className="text-lg font-bold text-kx-ink pr-8">{title}</h2>
                                        </div>

                                        {/* Description */}
                                        <p className="text-sm text-kx-ink2 leading-relaxed mb-5">
                                            {desc}
                                        </p>

                                        {/* Bullet points */}
                                        <div className="space-y-2.5 mb-5">
                                            {content.bullets.map((bullet, i) => (
                                                <div key={i} className="flex items-start gap-2.5 text-sm text-kx-ink2">
                                                    <span className="text-base mt-0.5 shrink-0">{bullet.icon}</span>
                                                    <span className="leading-relaxed">{isEs ? bullet.textEs : bullet.text}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Location hint */}
                                        <div className="rounded-lg bg-kx-raised border border-[color-mix(in_srgb,var(--kx-amber)_10%,transparent)] px-3 py-2.5 mb-5">
                                            <p className="text-xs text-kx-amber leading-relaxed">
                                                {location}
                                            </p>
                                        </div>

                                        {/* CTA Button */}
                                        <button
                                            onClick={() => setOpen(false)}
                                            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300
                                                bg-gradient-to-r   text-kx-ink
                                                  hover:shadow-lg 
                                                active:scale-[0.98]"
                                        >
                                            {isEs ? '¡Entendido!' : 'Got it!'}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
