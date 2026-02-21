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
    "nav.rankings": { en: "Rankings", es: "Rangos" },

    "nav.settings": { en: "Settings", es: "Configuración" },
    "nav.analytics": { en: "Analytics", es: "Analíticas" },
    "nav.signOut": { en: "Sign Out", es: "Cerrar Sesión" },
    "nav.coreX": { en: "KoreX", es: "KoreX" },

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
    "accounts.addDebt": { en: "Add Debt", es: "Agregar Deuda" },
    "accounts.addCash": { en: "Add Cash Account", es: "Agregar Cuenta de Efectivo" },
    "accounts.balance": { en: "Balance", es: "Saldo" },
    "accounts.creditLimit": { en: "Credit Limit", es: "Límite de Crédito" },
    "accounts.delete": { en: "Delete", es: "Eliminar" },
    "accounts.confirmDelete": { en: "Are you sure you want to delete this account?", es: "¿Estás seguro de que deseas eliminar esta cuenta?" },
    "accounts.name": { en: "Account Name", es: "Nombre de Cuenta" },
    "accounts.save": { en: "Save", es: "Guardar" },
    "accounts.edit": { en: "Edit", es: "Editar" },
    "accounts.adjust": { en: "Adjust Balance", es: "Ajustar Saldo" },
    "accounts.addTransaction": { en: "Add Transaction", es: "Agregar Transacción" },
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
    "strategy.morningBriefing.opportunity": { en: "Opportunity Detected", es: "Oportunidad Detectada" },
    "strategy.morningBriefing.recommended": { en: "RECOMMENDED ACTION", es: "ACCIÓN RECOMENDADA" },
    "strategy.morningBriefing.moveTo": { en: "Move to", es: "Mover a" },
    "strategy.morningBriefing.daysAccelerated": { en: "Days Accelerated", es: "Días Acelerados" },
    "strategy.morningBriefing.savedMonth": { en: "Saved / Month", es: "Ahorro / Mes" },
    "strategy.morningBriefing.freedomHours": { en: "Freedom Hours", es: "Horas de Libertad" },
    "strategy.morningBriefing.executeFrom": { en: "Execute transfers from the", es: "Ejecuta transferencias desde el" },
    "strategy.morningBriefing.actionPlan": { en: "Action Plan", es: "Plan de Acción" },
    "strategy.morningBriefing.page": { en: "page", es: "" },

    // — Risky Opportunity (Shield Sacrifice) —
    "strategy.riskyOpp.title": { en: "Risk Opportunity", es: "Oportunidad de Riesgo" },
    "strategy.riskyOpp.subtitle": { en: "Accelerate by sacrificing shield", es: "Acelera sacrificando tu escudo" },
    "strategy.riskyOpp.riskModerate": { en: "Moderate Risk", es: "Riesgo Moderado" },
    "strategy.riskyOpp.riskHigh": { en: "High Risk", es: "Riesgo Alto" },
    "strategy.riskyOpp.riskCritical": { en: "Critical Risk", es: "Riesgo Crítico" },
    "strategy.riskyOpp.shieldSacrifice": { en: "SHIELD SACRIFICE", es: "SACRIFICIO DE ESCUDO" },
    "strategy.riskyOpp.shieldDrops": { en: "Shield drops to", es: "Escudo baja a" },
    "strategy.riskyOpp.interestSaved": { en: "Saved / Month", es: "Ahorro / Mes" },
    "strategy.riskyOpp.daysAccelerated": { en: "Days Accelerated", es: "Días Acelerados" },
    "strategy.riskyOpp.dailyCost": { en: "Daily Cost Cut", es: "Costo Diario Eliminado" },
    "strategy.riskyOpp.takeRisk": { en: "⚡ Take the Risk", es: "⚡ Tomar el Riesgo" },
    "strategy.riskyOpp.confirmTitle": { en: "Are you sure?", es: "¿Estás seguro?" },
    "strategy.riskyOpp.confirmWarning": { en: "Your Peace Shield will be reduced. This decreases your emergency fund protection.", es: "Tu Escudo de Paz será reducido. Esto disminuye tu protección de fondo de emergencia." },
    "strategy.riskyOpp.amount": { en: "Amount", es: "Monto" },
    "strategy.riskyOpp.destination": { en: "Destination", es: "Destino" },
    "strategy.riskyOpp.disclaimer": { en: "⚠️ This action reduces your emergency fund. You proceed at your own risk. KoreX is not responsible for financial decisions made by the user.", es: "⚠️ Esta acción reduce tu fondo de emergencia. Procedes bajo tu propio riesgo. KoreX no se hace responsable de las decisiones financieras del usuario." },
    "strategy.riskyOpp.checkboxLabel": { en: "I understand that I am reducing my emergency protection and proceed at my own risk.", es: "Entiendo que estoy reduciendo mi protección de emergencia y procedo bajo mi propio riesgo." },
    "strategy.riskyOpp.execute": { en: "Confirm & Execute", es: "Confirmar y Ejecutar" },
    "strategy.riskyOpp.cancel": { en: "Cancel", es: "Cancelar" },
    "strategy.riskyOpp.success": { en: "✅ Risk Executed Successfully", es: "✅ Riesgo Ejecutado Exitosamente" },

    "strategy.confidence.title": { en: "Confidence Meter", es: "Medidor de Confianza" },
    "strategy.confidence.level": { en: "Confidence Level", es: "Nivel de Confianza" },
    "strategy.confidence.balance": { en: "Balance", es: "Saldo" },
    "strategy.confidence.whyTarget": { en: "Why This Target?", es: "¿Por Qué Este Objetivo?" },
    "strategy.confidence.noDebts": { en: "No active debts to analyze", es: "No hay deudas activas para analizar" },
    "strategy.confidence.showAll": { en: "Show All", es: "Mostrar Todo" },
    "strategy.confidence.showLess": { en: "Show Less", es: "Mostrar Menos" },
    "strategy.confidence.strategy": { en: "Strategy", es: "Estrategia" },
    "strategy.confidence.method": { en: "Method", es: "Método" },
    "strategy.confidence.target": { en: "TARGET", es: "OBJETIVO" },
    "strategy.confidence.costsDay": { en: "Costs", es: "Cuesta" },
    "strategy.confidence.perDay": { en: "/day", es: "/día" },

    "strategy.freedom.title": { en: "Freedom Counter", es: "Contador de Libertad" },
    "strategy.freedom.debtFreeDate": { en: "Debt-Free Date", es: "Fecha Libre de Deudas" },
    "strategy.freedom.daysRecovered": { en: "Days of Freedom Recovered", es: "Días de Libertad Recuperados" },
    "strategy.freedom.velocityPower": { en: "Velocity Power", es: "Poder de Velocidad" },
    "strategy.freedom.corexTarget": { en: "KoreX Target", es: "Objetivo KoreX" },
    "strategy.freedom.standard": { en: "Standard", es: "Estándar" },
    "strategy.freedom.monthsAccelerated": { en: "Months Accelerated", es: "Meses Acelerados" },
    "strategy.freedom.attackStreak": { en: "Attack Streak", es: "Racha de Ataque" },
    "strategy.freedom.calculating": { en: "Calculating...", es: "Calculando..." },

    "strategy.decision.title": { en: "Decision Helper", es: "Asistente de Decisión" },
    "strategy.decision.recommended": { en: "Recommended", es: "Recomendado" },

    "strategy.cashflowMap.title": { en: "Tactical Cashflow Map", es: "Mapa Táctico de Flujo" },
    "strategy.cashflowMap.startBalance": { en: "Start Balance", es: "Saldo Inicial" },
    "strategy.cashflowMap.minProjected": { en: "Min Projected", es: "Mínimo Proyectado" },

    // Action Plan — additional keys
    "actionPlan.confirmExecution": { en: "Confirm Execution", es: "Confirmar Ejecución" },
    "actionPlan.confirmQuestion": { en: "Did you already make this transfer?", es: "¿Ya realizaste esta transferencia?" },
    "actionPlan.yesExecuted": { en: "Yes, I executed this", es: "Sí, lo ejecuté" },
    "actionPlan.current": { en: "Current", es: "Actual" },
    "actionPlan.today": { en: "today", es: "hoy" },
    "actionPlan.movementsThisMonth": { en: "movements this month", es: "movimientos este mes" },
    "actionPlan.movement": { en: "movement", es: "movimiento" },
    "actionPlan.loading": { en: "Loading Action Plan...", es: "Cargando Plan de Acción..." },
    "actionPlan.noMovements": { en: "No movements scheduled for", es: "No hay movimientos programados para" },
    "actionPlan.addAccountsHint": { en: "Add income and debt accounts to generate your action plan", es: "Agrega cuentas de ingreso y deuda para generar tu plan" },
    "actionPlan.battlePlan": { en: "Your 2-month optimized battle plan. Confirm each movement after you execute it.", es: "Tu plan de batalla optimizado de 2 meses. Confirma cada movimiento después de ejecutarlo." },
    "actionPlan.executed": { en: "executed", es: "ejecutados" },
    "actionPlan.noExecuted": { en: "No movements executed yet", es: "Aún no hay movimientos ejecutados" },
    "actionPlan.usePlayButton": { en: "Use the play button above to start executing your plan", es: "Usa el botón de play arriba para empezar a ejecutar tu plan" },
    "actionPlan.movementExecuted": { en: "Movement Executed", es: "Movimiento Ejecutado" },
    "actionPlan.executionFailed": { en: "Execution Failed", es: "Ejecución Fallida" },
    "actionPlan.executionFailedDesc": { en: "Could not complete the transfer. Please try again.", es: "No se pudo completar la transferencia. Intenta de nuevo." },
    "actionPlan.saves": { en: "saves", es: "ahorra" },
    "actionPlan.sooner": { en: "sooner", es: "antes" },
    "actionPlan.tableDate": { en: "Date", es: "Fecha" },
    "actionPlan.tableAction": { en: "Action", es: "Acción" },
    "actionPlan.tableFrom": { en: "From", es: "Desde" },
    "actionPlan.tableTo": { en: "To", es: "Hacia" },
    "actionPlan.tableAmount": { en: "Amount", es: "Monto" },
    "actionPlan.tableType": { en: "Type", es: "Tipo" },
    "actionPlan.tableExec": { en: "Exec", es: "Ejec" },
    "actionPlan.cancel": { en: "Cancel", es: "Cancelar" },
    "actionPlan.savesDay": { en: "Saves", es: "Ahorra" },
    "actionPlan.daysSooner": { en: "days sooner to freedom", es: "días antes a la libertad" },
    "actionPlan.moved": { en: "moved", es: "movido" },
    "actionPlan.summaryIncome": { en: "income", es: "ingresos" },
    "actionPlan.summaryAttacks": { en: "attacks", es: "ataques" },
    "actionPlan.summaryMinPayments": { en: "min payments", es: "pagos mín" },
    "actionPlan.summaryShields": { en: "shields", es: "escudos" },
    "actionPlan.perMonth": { en: "/mo", es: "/mes" },
    "actionPlan.daysAbbr": { en: "d", es: "d" },
    "actionPlan.badgeAttack": { en: "Atk", es: "Atq" },
    "actionPlan.badgeShield": { en: "Shd", es: "Esc" },
    "actionPlan.badgeMinPayment": { en: "Min", es: "Mín" },
    "actionPlan.badgeIncome": { en: "Inc", es: "Ing" },
    "actionPlan.badgeExpense": { en: "Tfr", es: "Trf" },
    "actionPlan.badgeFloatKill": { en: "Float", es: "Float" },
    "actionPlan.badgeHybridKill": { en: "Kill", es: "Kill" },
    "actionPlan.inInterest": { en: "in interest", es: "en intereses" },
    "actionPlan.lockedAccounts": { en: "locked accounts", es: "cuentas bloqueadas" },
    "actionPlan.upgradeToUnlock": { en: "Upgrade to unlock", es: "Mejora para desbloquear" },
    "actionPlan.locked": { en: "Locked", es: "Bloqueada" },
    "actionPlan.upgrade": { en: "Upgrade", es: "Mejorar" },
    "actionPlan.withKorex": { en: "With KoreX", es: "Con KoreX" },
    "actionPlan.withoutKorex": { en: "Without KoreX", es: "Sin KoreX" },
    "actionPlan.monthsCut": { en: "months cut", es: "meses recortados" },

    // Accounts — additional keys
    "accounts.financialNetwork": { en: "Financial Network", es: "Red Financiera" },
    "accounts.manageConnected": { en: "Manage your connected assets and liabilities", es: "Administra tus activos y pasivos conectados" },
    "accounts.addManual": { en: "Add Manual Account", es: "Agregar Cuenta Manual" },
    "accounts.addManualDesc": { en: "Enter account details manually to track in the Velocity engine.", es: "Ingresa los detalles de la cuenta manualmente para el motor Velocity." },
    "accounts.nuclearReset": { en: "Nuclear Option: Hard Reset", es: "Opción Nuclear: Reinicio Total" },
    "accounts.resetWarning": { en: "This will delete ALL accounts, transactions, and movement logs.", es: "Esto eliminará TODAS las cuentas, transacciones y registros de movimientos." },
    "accounts.resetCannotUndo": { en: "This action cannot be undone. Are you absolutely sure?", es: "Esta acción no se puede deshacer. ¿Estás completamente seguro?" },
    "accounts.resetSystem": { en: "Reset System", es: "Reiniciar Sistema" },
    "accounts.yesWipe": { en: "Yes, Wipe Everything", es: "Sí, Borrar Todo" },
    "accounts.addAccount": { en: "Add Account", es: "Agregar Cuenta" },
    "accounts.accountCreated": { en: "Account Created", es: "Cuenta Creada" },
    "accounts.accountCreatedDesc": { en: "Successfully added to your financial network.", es: "Agregada exitosamente a tu red financiera." },
    "accounts.refreshData": { en: "Refresh Data", es: "Actualizar Datos" },
    "accounts.errorConnecting": { en: "Error connecting to the backend engine.", es: "Error al conectar con el motor backend." },
    "accounts.failedCreate": { en: "Failed to create account.", es: "Error al crear la cuenta." },
    "accounts.accountDeleted": { en: "Account Deleted", es: "Cuenta Eliminada" },
    "accounts.systemReset": { en: "System Reset", es: "Sistema Reiniciado" },
    "accounts.systemResetDesc": { en: "All accounts and transactions wiped.", es: "Todas las cuentas y transacciones eliminadas." },
    "accounts.debt": { en: "Debt (Credit/Loan)", es: "Deuda (Crédito/Préstamo)" },
    "accounts.checking": { en: "Checking (Cash)", es: "Cuenta de Cheques" },
    "accounts.savings": { en: "Savings (Reserve)", es: "Ahorros (Reserva)" },

    // Accounts — form labels
    "accounts.accountName": { en: "Account Name", es: "Nombre de Cuenta" },
    "accounts.accountNamePlaceholder": { en: "e.g. Chase Sapphire, Wells Fargo", es: "ej. Chase Sapphire, Wells Fargo" },
    "accounts.type": { en: "Type", es: "Tipo" },
    "accounts.selectType": { en: "Select type", es: "Seleccionar tipo" },
    "accounts.currentBalance": { en: "Current Balance", es: "Saldo Actual" },
    "accounts.apr": { en: "APR (%)", es: "TAE (%)" },
    "accounts.minPayment": { en: "Min. Payment", es: "Pago Mínimo" },
    "accounts.optional": { en: "Optional", es: "Opcional" },
    "accounts.closingDay": { en: "Closing Day (Corte)", es: "Día de Corte" },
    "accounts.dueDay": { en: "Due Day (Pago)", es: "Día de Pago" },
    "accounts.debtType": { en: "Debt Type", es: "Tipo de Deuda" },
    "accounts.whatKindDebt": { en: "What kind of debt?", es: "¿Qué tipo de deuda?" },
    "accounts.verifyConnect": { en: "Verify & Connect", es: "Verificar y Conectar" },

    // Accounts — debt subtypes
    "accounts.creditCard": { en: "💳 Credit Card", es: "💳 Tarjeta de Crédito" },
    "accounts.autoLoan": { en: "🚗 Auto Loan", es: "🚗 Préstamo de Auto" },
    "accounts.mortgage": { en: "🏠 Mortgage", es: "🏠 Hipoteca" },
    "accounts.personalLoan": { en: "💰 Personal Loan", es: "💰 Préstamo Personal" },
    "accounts.studentLoan": { en: "🎓 Student Loan", es: "🎓 Préstamo Estudiantil" },
    "accounts.heloc": { en: "🏦 HELOC", es: "🏦 HELOC" },
    "accounts.showAPRSuggestions": { en: "Don't know your APR? See bank suggestions", es: "¿No sabes tu APR? Ver sugerencias por banco" },
    "accounts.hideAPRSuggestions": { en: "Hide APR suggestions", es: "Ocultar sugerencias APR" },

    // Accounts — section headers
    "accounts.liabilities": { en: "Liabilities (Debt)", es: "Pasivos (Deuda)" },
    "accounts.liabilitiesDesc": { en: "Credit cards and loans attacking your wealth", es: "Tarjetas y préstamos atacando tu patrimonio" },
    "accounts.noDebts": { en: "No debts added yet.", es: "Aún no hay deudas agregadas." },
    "accounts.noDebtsHint": { en: "You are either free or haven't connected your burdens.", es: "Eres libre o aún no has conectado tus cargas." },
    "accounts.outstandingBalance": { en: "Outstanding Balance", es: "Saldo Pendiente" },
    "accounts.dueDate": { en: "Due Date", es: "Fecha de Pago" },
    "accounts.payOff": { en: "Pay Off", es: "Liquidar" },
    "accounts.assets": { en: "Assets (Cash)", es: "Activos (Efectivo)" },
    "accounts.assetsDesc": { en: "Checking and savings fueling your velocity", es: "Cuentas corrientes y ahorros impulsando tu velocidad" },
    "accounts.noAssets": { en: "No assets connected.", es: "Sin activos conectados." },
    "accounts.availableCash": { en: "Available Cash", es: "Efectivo Disponible" },
    "accounts.history": { en: "History", es: "Historial" },
    "accounts.deposit": { en: "Deposit", es: "Depósitar" },
    "accounts.spend": { en: "Spend", es: "Gastar" },

    // Accounts — action dialogs
    "accounts.transaction": { en: "Transaction", es: "Transacción" },
    "accounts.payOffDesc": { en: "Pay off debt for", es: "Liquidar deuda de" },
    "accounts.addFundsDesc": { en: "Add funds to", es: "Agregar fondos a" },
    "accounts.recordExpenseDesc": { en: "Record expense from", es: "Registrar gasto de" },
    "accounts.amount": { en: "Amount", es: "Monto" },
    "accounts.descriptionOptional": { en: "Description (Optional)", es: "Descripción (Opcional)" },
    "accounts.confirmTransaction": { en: "Confirm Transaction", es: "Confirmar Transacción" },
    "accounts.cancel": { en: "Cancel", es: "Cancelar" },

    // Accounts — manual adjustment dialog
    "accounts.manualAdjustment": { en: "Manual Adjustment", es: "Ajuste Manual" },
    "accounts.adjustBalanceFor": { en: "Adjust the balance for", es: "Ajustar el saldo de" },
    "accounts.createsRecord": { en: "This will create a transaction record.", es: "Esto creará un registro de transacción." },
    "accounts.addCharge": { en: "Add Charge (+)", es: "Agregar Cargo (+)" },
    "accounts.addDeposit": { en: "Add Deposit (+)", es: "Agregar Depósito (+)" },
    "accounts.subtractPayment": { en: "Subtract Payment (-)", es: "Restar Pago (-)" },
    "accounts.subtractExpense": { en: "Subtract Expense (-)", es: "Restar Gasto (-)" },
    "accounts.adjustmentAmount": { en: "Adjustment Amount", es: "Monto del Ajuste" },
    "accounts.currentBalanceLabel": { en: "Current Balance:", es: "Saldo Actual:" },
    "accounts.adjustment": { en: "Adjustment:", es: "Ajuste:" },
    "accounts.newBalance": { en: "New Balance:", es: "Nuevo Saldo:" },
    "accounts.applyTransaction": { en: "Apply Transaction", es: "Aplicar Transacción" },

    // Accounts — transaction drawer
    "accounts.transactions": { en: "Transactions:", es: "Transacciones:" },
    "accounts.historyContext": { en: "History of payments and expenses. Context:", es: "Historial de pagos y gastos. Contexto:" },
    "accounts.newTransaction": { en: "New Transaction", es: "Nueva Transacción" },
    "accounts.description": { en: "Description", es: "Descripción" },
    "accounts.expense": { en: "Expense", es: "Gasto" },
    "accounts.income": { en: "Income", es: "Ingreso" },
    "accounts.payment": { en: "Payment", es: "Pago" },
    "accounts.add": { en: "Add", es: "Agregar" },
    "accounts.noTransactions": { en: "No transactions recorded.", es: "Sin transacciones registradas." },
    "accounts.loading": { en: "Loading...", es: "Cargando..." },
    "accounts.day": { en: "Day", es: "Día" },
    "accounts.deleteConfirm": { en: "Are you sure? This will verify related transactions and delete history.", es: "¿Estás seguro? Se verificarán las transacciones relacionadas y se eliminará el historial." },

    // ═══════════════════════════════════════════════════════════════════
    //  SETTINGS PAGE
    // ═══════════════════════════════════════════════════════════════════
    // Settings page header
    "settings.title": { en: "Settings", es: "Configuración" },
    "settings.subtitle": { en: "Manage your profile, preferences, and system configuration.", es: "Administra tu perfil, preferencias y configuración del sistema." },

    // Sidebar nav (unique keys only — rest defined in SETTINGS — NAVIGATION + PROFILE section)
    "settings.nav.algorithm": { en: "Algorithm", es: "Algoritmo" },

    // Profile save (unique key)
    "settings.profile.save": { en: "Save Profile", es: "Guardar Perfil" },

    // Appearance section
    "settings.appearance.title": { en: "Appearance & Language", es: "Apariencia e Idioma" },
    "settings.appearance.subtitle": { en: "Customize how KoreX looks and communicates.", es: "Personaliza cómo se ve y comunica KoreX." },
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
    "settings.notifications.enableDesc": { en: "Allow KoreX to send you browser notifications for important alerts.", es: "Permite que KoreX te envíe notificaciones del navegador para alertas importantes." },
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
    "settings.data.exportPdf": { en: "PDF Report", es: "Reporte PDF" },
    "settings.data.exportPdfDesc": { en: "Professional monthly financial report.", es: "Reporte financiero mensual profesional." },
    "settings.data.pdfError": { en: "PDF generation failed. Please try again.", es: "Error al generar el PDF. Intenta de nuevo." },
    "settings.data.resetDemo": { en: "Reset Demo Data", es: "Resetear Datos Demo" },
    "settings.data.resetDemoDesc": { en: "Re-seed the database with fresh stress test data.", es: "Re-crear la base de datos con datos de prueba nuevos." },
    "settings.data.clearCache": { en: "Clear Local Cache", es: "Limpiar Caché Local" },
    "settings.data.clearCacheDesc": { en: "Remove all locally stored preferences and cached data.", es: "Elimina todas las preferencias y datos almacenados localmente." },
    "settings.data.dangerZone": { en: "Danger Zone", es: "Zona de Peligro" },

    // About section
    "settings.about.title": { en: "About KoreX", es: "Acerca de KoreX" },
    "settings.about.subtitle": { en: "System information and credits.", es: "Información del sistema y créditos." },
    "settings.about.version": { en: "Version", es: "Versión" },
    "settings.about.build": { en: "Build", es: "Compilación" },
    "settings.about.engine": { en: "Engine", es: "Motor" },
    "settings.about.techStack": { en: "Technology Stack", es: "Stack Tecnológico" },
    "settings.about.madeWith": { en: "Made with ⚡ by KoreX Team", es: "Hecho con ⚡ por el Equipo KoreX" },
    "settings.about.financialSystem": { en: "Financial System", es: "Sistema Financiero" },
    "settings.about.tagline": { en: "Next-generation Velocity Banking engine for financial freedom.", es: "Motor de Velocity Banking de próxima generación para la libertad financiera." },


    // Algorithm — paycheck frequency
    "settings.algorithm.weekly": { en: "Weekly", es: "Semanal" },
    "settings.algorithm.biweekly": { en: "Bi-Weekly", es: "Quincenal" },
    "settings.algorithm.monthly": { en: "Monthly", es: "Mensual" },

    // Data — inline buttons & labels
    "settings.data.exportData": { en: "Export Data", es: "Exportar Datos" },
    "settings.data.process": { en: "Process", es: "Procesar" },
    "settings.data.cancelImport": { en: "Cancel", es: "Cancelar" },
    "settings.data.dragFile": { en: "Drag a file here or", es: "Arrastra un archivo aquí o" },
    "settings.data.clickBrowse": { en: "click to browse", es: "haz clic para seleccionar" },
    "settings.data.reset": { en: "Reset", es: "Resetear" },
    "settings.data.clear": { en: "Clear", es: "Limpiar" },
    "settings.data.importSuccess": { en: "File read: {count} sheets found. Check console for details.", es: "Archivo leído: {count} hojas encontradas. Revisa la consola para detalles." },
    "settings.data.resetConfirm": { en: "⚠️ This will reset ALL demo data. Continue?", es: "⚠️ Esto reseteará TODOS los datos demo. ¿Continuar?" },
    "settings.data.clearConfirm": { en: "Clear all local cache? Your preferences will be reset.", es: "¿Limpiar toda la caché local? Tus preferencias se resetearán." },

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

    // ═══════════════════════════════════════════════════════════════════
    //  UPGRADE / SUBSCRIPTION
    // ═══════════════════════════════════════════════════════════════════
    "upgrade.title": { en: "Upgrade Your Plan", es: "Mejora Tu Plan" },
    "upgrade.defaultReason": { en: "Unlock more accounts and accelerate your debt freedom.", es: "Desbloquea más cuentas y acelera tu libertad de deuda." },
    "upgrade.rankBoostReason": { en: "👑 Go VIP and rank up faster!", es: "👑 ¡Hazte VIP y avanza más rápido en tu rango!" },
    "upgrade.unlockAll": { en: "Unlock All — Upgrade Now", es: "Desbloquear Todo — Mejora Ahora" },
    "upgrade.toAddMore": { en: "Upgrade to Add More", es: "Mejora para Agregar Más" },
    "upgrade.toManage": { en: "Upgrade to manage this account", es: "Mejora para administrar esta cuenta" },
    "upgrade.viewPlans": { en: "View Plans", es: "Ver Planes" },
    "upgrade.viewUpgradePlans": { en: "View Upgrade Plans", es: "Ver Planes de Mejora" },
    "upgrade.runningOutSlots": { en: "You're running out of slots! Upgrade for more debt accounts.", es: "¡Te estás quedando sin espacios! Mejora para más cuentas de deuda." },
    "upgrade.button": { en: "Upgrade", es: "Mejorar" },
    "upgrade.getStarted": { en: "Get Started", es: "Comenzar" },
    "upgrade.downgrade": { en: "Downgrade", es: "Bajar Plan" },
    "upgrade.active": { en: "✓ Active", es: "✓ Activo" },
    "upgrade.processing": { en: "Processing...", es: "Procesando..." },
    "upgrade.unlockPower": { en: "🚀 Unlock Full Power", es: "🚀 Desbloquear Todo el Poder" },
    "upgrade.debtsUnmonitored": { en: "⚠️ Debts Going Unmonitored", es: "⚠️ Deudas Sin Monitorear" },
    "upgrade.premiumDesc": { en: "Upgrade to unlock premium debt acceleration features and eliminate interest faster.", es: "Mejora para desbloquear funciones premium de aceleración de deuda y eliminar intereses más rápido." },
    "upgrade.moreAccountsDesc": { en: "Upgrade your plan to unlock more accounts and accelerate your debt freedom.", es: "Mejora tu plan para desbloquear más cuentas y acelerar tu libertad de deuda." },
    "upgrade.starterNudge": { en: "You're on Starter — upgrade to track more debts and save thousands in interest.", es: "Estás en Starter — mejora para rastrear más deudas y ahorrar miles en intereses." },
    "upgrade.lockedNudge": { en: "Some of your debts are locked and bleeding interest. Upgrade to cover them all.", es: "Algunas de tus deudas están bloqueadas y pierden intereses. Mejora para cubrirlas todas." },
    "upgrade.unlockAllReason": { en: "Unlock all your debt accounts so CoreX can monitor and optimize every dollar.", es: "Desbloquea todas tus cuentas de deuda para que CoreX monitoree y optimice cada dólar." },
    "upgrade.unlockAllReasonAction": { en: "Unlock all your debt accounts so KoreX can optimize every dollar of interest.", es: "Desbloquea todas tus cuentas de deuda para que KoreX optimice cada dólar de interés." },
    "upgrade.monthly": { en: "Monthly", es: "Mensual" },
    "upgrade.annual": { en: "Annual", es: "Anual" },
    "upgrade.save": { en: "Save", es: "Ahorra" },
    "upgrade.mostPopular": { en: "Most Popular", es: "Más Popular" },
    "upgrade.current": { en: "Current", es: "Actual" },
    "upgrade.free": { en: "Free", es: "Gratis" },
    "upgrade.year": { en: "year", es: "año" },
    "upgrade.accounts": { en: "accounts", es: "cuentas" },
    "upgrade.unlimited": { en: "∞ Unlimited", es: "∞ Ilimitado" },
    "upgrade.allDebtsOptimized": { en: "All debts optimized", es: "Todas las deudas optimizadas" },
    "upgrade.topDebtsOptimized": { en: "Top {n} debts optimized", es: "Top {n} deudas optimizadas" },
    "upgrade.noLimits": { en: "no limits", es: "sin límites" },
    "upgrade.futureDebtsCovered": { en: "every future debt automatically covered", es: "cada deuda futura cubierta automáticamente" },
    "upgrade.inInterest": { en: "in interest", es: "en intereses" },
    "upgrade.savedEachMonth": { en: "saved each month using CoreX", es: "ahorrado cada mes usando CoreX" },
    "upgrade.savedEachYear": { en: "saved each year using CoreX", es: "ahorrado cada año usando CoreX" },
    "upgrade.netGain": { en: "💰 Net gain:", es: "💰 Ganancia neta:" },
    "upgrade.afterPlanCost": { en: "after plan cost", es: "después del costo del plan" },
    "upgrade.paysForItself": { en: "Pays for itself in", es: "Se paga solo en" },
    "upgrade.days": { en: "days", es: "días" },
    "upgrade.checkoutOpened": { en: "🍋 Checkout opened!", es: "🍋 ¡Checkout abierto!" },
    "upgrade.checkoutOpenedDesc": { en: "Complete your payment in the new tab. Your plan will update automatically.", es: "Completa tu pago en la nueva pestaña. Tu plan se actualizará automáticamente." },
    "upgrade.checkoutFailed": { en: "Checkout failed", es: "Fallo en el checkout" },
    "upgrade.checkoutFailedDesc": { en: "Could not open checkout. Please try again or contact support.", es: "No se pudo abrir el checkout. Inténtalo de nuevo o contacta soporte." },
    "upgrade.dismissShame": { en: "I'll keep losing money", es: "Seguiré perdiendo dinero" },

    // ═══════════════════════════════════════════════════════════════════
    //  UPGRADE — PLAN FEATURES
    // ═══════════════════════════════════════════════════════════════════
    "upgrade.feature.debtAccounts2": { en: "2 debt accounts", es: "2 cuentas de deuda" },
    "upgrade.feature.basicVelocity": { en: "Basic velocity engine", es: "Motor velocity básico" },
    "upgrade.feature.monthlyProjections": { en: "Monthly projections", es: "Proyecciones mensuales" },
    "upgrade.feature.debtAccounts6": { en: "6 debt accounts", es: "6 cuentas de deuda" },
    "upgrade.feature.fullVelocity": { en: "Full velocity engine", es: "Motor velocity completo" },
    "upgrade.feature.actionPlanGPS": { en: "Action Plan GPS", es: "GPS de Plan de Acción" },
    "upgrade.feature.prioritySupport": { en: "Priority support", es: "Soporte prioritario" },
    "upgrade.feature.debtAccounts12": { en: "12 debt accounts", es: "12 cuentas de deuda" },
    "upgrade.feature.accelerationSim": { en: "Acceleration simulator", es: "Simulador de aceleración" },
    "upgrade.feature.advancedAnalytics": { en: "Advanced analytics", es: "Analíticas avanzadas" },
    "upgrade.feature.pdfReports": { en: "PDF reports", es: "Reportes PDF" },
    "upgrade.feature.unlimitedAccounts": { en: "Unlimited accounts", es: "Cuentas ilimitadas" },
    "upgrade.feature.allAccelerator": { en: "All Accelerator features", es: "Todas las funciones Accelerator" },
    "upgrade.feature.apiAccess": { en: "API access", es: "Acceso a API" },
    "upgrade.feature.whiteGlove": { en: "White-glove onboarding", es: "Onboarding personalizado" },

    // ═══════════════════════════════════════════════════════════════════
    //  ACCOUNTS — SUBSCRIPTION GATING
    // ═══════════════════════════════════════════════════════════════════
    "accounts.lifetime": { en: "LIFETIME", es: "DE POR VIDA" },
    "accounts.debtAccountsUsed": { en: "debt accounts used", es: "cuentas de deuda usadas" },
    "accounts.debtUnlimited": { en: "debt accounts • Unlimited", es: "cuentas de deuda • Ilimitado" },
    "accounts.accountsLocked": { en: "account(s) locked", es: "cuenta(s) bloqueada(s)" },
    "accounts.unmonitored": { en: "Unmonitored", es: "Sin Monitorear" },
    "accounts.inUnmonitoredDebt": { en: "in unmonitored debt", es: "en deuda sin monitorear" },
    "accounts.dayDraining": { en: "/day draining", es: "/día drenando" },
    "accounts.notMonitored": { en: "Not monitored — losing ~", es: "Sin monitoreo — perdiendo ~" },
    "accounts.perDayInterest": { en: "/day in interest", es: "/día en intereses" },
    "accounts.lockedBadge": { en: "LOCKED", es: "BLOQUEADO" },
    "accounts.limitReached": { en: "Account limit reached", es: "Límite de cuentas alcanzado" },
    "accounts.limitReachedDesc": { en: "Upgrade your plan in Settings → Subscription.", es: "Mejora tu plan en Configuración → Suscripción." },

    // Dashboard — subscription gating
    "dashboard.unmonitoredDebt": { en: "Unmonitored Debt", es: "Deuda Sin Monitorear" },
    "dashboard.extraMonths": { en: "extra months", es: "meses extra" },
    "dashboard.upgradeAccelerate": { en: "Upgrade to accelerate", es: "Mejora para acelerar" },
    "dashboard.upgradeTrackAll": { en: "Upgrade to track all debts", es: "Mejora para rastrear todas las deudas" },

    // Dashboard — Burndown, No Attack, Connection Error
    "dashboard.burndownTitle": { en: "Burndown Projection", es: "Proyección de Liquidación" },
    "dashboard.noAttackTitle": { en: "No Attack Available", es: "Sin Ataque Disponible" },
    "dashboard.noAttackDesc": { en: "Your Peace Shield needs reinforcement first, or no active debts were found.", es: "Tu Escudo de Paz necesita refuerzo primero, o no se encontraron deudas activas." },
    "dashboard.connectionError": { en: "Connection Error", es: "Error de Conexión" },
    "dashboard.connectionErrorDesc": { en: "Failed to load dashboard data. Retrying automatically...", es: "No se pudieron cargar los datos del panel. Reintentando automáticamente..." },

    // ═══════════════════════════════════════════════════════════════════
    //  PURCHASE SIMULATOR (full i18n)
    // ═══════════════════════════════════════════════════════════════════
    "purchaseSim.title": { en: "Purchase Simulator", es: "Simulador de Compra" },
    "purchaseSim.subtitle": { en: "\"What does this REALLY cost?\"", es: "\"¿Cuánto te REALMENTE cuesta?\"" },
    "purchaseSim.placeholder": { en: "Enter purchase amount...", es: "Ingresa el monto de la compra..." },
    "purchaseSim.analyze": { en: "Analyze", es: "Analizar" },
    "purchaseSim.error": { en: "Could not connect to the KoreX engine.", es: "No se pudo conectar al motor KoreX." },
    "purchaseSim.safe": { en: "Safe", es: "Seguro" },
    "purchaseSim.days": { en: "days", es: "días" },
    "purchaseSim.addedTimeline": { en: "added to your debt-free timeline", es: "añadidos a tu línea libre de deudas" },
    "purchaseSim.minimalImpact": { en: "Minimal impact on your freedom date", es: "Impacto mínimo en tu fecha de libertad" },
    "purchaseSim.timeDelay": { en: "Time Delay", es: "Retraso" },
    "purchaseSim.extraInterest": { en: "Extra Interest", es: "Interés Extra" },
    "purchaseSim.mo": { en: "mo", es: "meses" },

    // ═══════════════════════════════════════════════════════════════════
    //  CASHFLOW MANAGER (full i18n)
    // ═══════════════════════════════════════════════════════════════════
    "cashflow.daily": { en: "Daily", es: "Diario" },
    "cashflow.weekly": { en: "Weekly", es: "Semanal" },
    "cashflow.monthly": { en: "Monthly", es: "Mensual" },
    "cashflow.yearly": { en: "Yearly", es: "Anual" },
    "cashflow.income": { en: "Income", es: "Ingresos" },
    "cashflow.expenses": { en: "Expenses", es: "Gastos" },
    "cashflow.netSurplus": { en: "Net Surplus", es: "Excedente Neto" },
    "cashflow.available": { en: "Available", es: "Disponible" },
    "cashflow.fixed": { en: "Fixed", es: "Fijos" },
    "cashflow.debt": { en: "Debt", es: "Deuda" },
    "cashflow.debtDrain": { en: "Debt Drain", es: "Drenaje de Deuda" },
    "cashflow.attackPower": { en: "Attack Power", es: "Poder de Ataque" },
    "cashflow.recurringTransactions": { en: "Recurring Transactions", es: "Transacciones Recurrentes" },
    "cashflow.addRecurring": { en: "Add Recurring", es: "Agregar Recurrente" },
    "cashflow.addRecurringItem": { en: "Add Recurring Item", es: "Agregar Item Recurrente" },
    "cashflow.type": { en: "Type", es: "Tipo" },
    "cashflow.incomeOption": { en: "Income", es: "Ingreso" },
    "cashflow.expenseOption": { en: "Expense", es: "Gasto" },
    "cashflow.amount": { en: "Amount", es: "Monto" },
    "cashflow.nameDesc": { en: "Name / Description", es: "Nombre / Descripción" },
    "cashflow.frequency": { en: "Frequency", es: "Frecuencia" },
    "cashflow.freqWeekly": { en: "Weekly (Every 7 Days)", es: "Semanal (Cada 7 días)" },
    "cashflow.freqBiweekly": { en: "Bi-Weekly (Every 2 Weeks)", es: "Quincenal (Cada 2 semanas)" },
    "cashflow.freqSemiMonthly": { en: "Semi-Monthly (15th & 30th)", es: "Quincenal (15 y 30)" },
    "cashflow.freqMonthly": { en: "Monthly (Once a month)", es: "Mensual (Una vez al mes)" },
    "cashflow.freqAnnually": { en: "Annually (Once a year)", es: "Anual (Una vez al año)" },
    "cashflow.whichDay": { en: "On which day?", es: "¿Qué día?" },
    "cashflow.dayOfMonth": { en: "Day of Month (1-31)", es: "Día del Mes (1-31)" },
    "cashflow.firstPayDay": { en: "First Payment Day", es: "Primer Día de Pago" },
    "cashflow.secondPayDay": { en: "Second Payment Day", es: "Segundo Día de Pago" },
    "cashflow.month": { en: "Month", es: "Mes" },
    "cashflow.day": { en: "Day", es: "Día" },
    "cashflow.variable": { en: "Variable?", es: "¿Variable?" },
    "cashflow.fixedAmount": { en: "Fixed Amount", es: "Monto Fijo" },
    "cashflow.variableAvg": { en: "Variable (~Avg)", es: "Variable (~Prom)" },
    "cashflow.saveItem": { en: "Save Item", es: "Guardar Item" },
    "cashflow.incomeStreams": { en: "Income Streams", es: "Fuentes de Ingresos" },
    "cashflow.noIncome": { en: "No income streams added.", es: "No se han agregado ingresos." },
    "cashflow.recurringExpenses": { en: "Recurring Expenses", es: "Gastos Recurrentes" },
    "cashflow.noExpenses": { en: "No recurring expenses added.", es: "No se han agregado gastos recurrentes." },
    "cashflow.debtObligations": { en: "Debt Obligations", es: "Obligaciones de Deuda" },
    "cashflow.autoSynced": { en: "Auto-synced", es: "Auto-sincronizado" },
    "cashflow.remaining": { en: "remaining", es: "restante" },
    "cashflow.locked": { en: "Locked", es: "Bloqueado" },
    "cashflow.dayPrefix": { en: "Day", es: "Día" },
    "cashflow.dueDay": { en: "Due Day", es: "Día de Pago" },
    "cashflow.upgradeToUnlock": { en: "Upgrade plan to unlock", es: "Mejora tu plan para desbloquear" },
    "cashflow.autoManaged": { en: "Auto-managed — pay off debt to remove", es: "Auto-gestionado — paga la deuda para eliminar" },
    "cashflow.fillNameAmount": { en: "Please fill in Name and Amount", es: "Por favor ingresa Nombre y Monto" },

    // ═══════════════════════════════════════════════════════════════════
    //  SETTINGS — NAVIGATION + PROFILE
    // ═══════════════════════════════════════════════════════════════════
    "settings.nav.profile": { en: "Profile", es: "Perfil" },
    "settings.nav.appearance": { en: "Appearance", es: "Apariencia" },
    "settings.nav.notifications": { en: "Notifications", es: "Notificaciones" },
    "settings.nav.data": { en: "Data Management", es: "Gestión de Datos" },
    "settings.nav.subscription": { en: "Subscription", es: "Suscripción" },
    "settings.nav.about": { en: "About", es: "Acerca de" },
    "settings.profile.title": { en: "Profile Information", es: "Información del Perfil" },
    "settings.profile.subtitle": { en: "Manage your personal data and account identity.", es: "Administra tus datos personales e identidad de cuenta." },
    "settings.profile.demoAccount": { en: "Demo Account", es: "Cuenta Demo" },
    "settings.profile.demoCannotEdit": { en: "Demo accounts cannot edit profile data.", es: "Las cuentas demo no pueden editar datos de perfil." },
    "settings.profile.displayName": { en: "Display Name", es: "Nombre para Mostrar" },
    "settings.profile.email": { en: "Email", es: "Correo Electrónico" },
    "settings.profile.security": { en: "Security", es: "Seguridad" },
    "settings.profile.twoFactor": { en: "Two-Factor Authentication", es: "Autenticación de Dos Factores" },
    "settings.profile.twoFactorDesc": { en: "Secure your account with 2FA.", es: "Asegura tu cuenta con 2FA." },
    "settings.profile.saveChanges": { en: "Save Changes", es: "Guardar Cambios" },
    "settings.profile.saved": { en: "Profile saved", es: "Perfil guardado" },
    "settings.profile.savedDesc": { en: "Your display name has been updated.", es: "Tu nombre para mostrar ha sido actualizado." },

    // ═══════════════════════════════════════════════════════════════════
    //  SETTINGS — SUBSCRIPTION
    // ═══════════════════════════════════════════════════════════════════
    "sub.title": { en: "Subscription", es: "Suscripción" },
    "sub.subtitle": { en: "Choose the plan that fits your financial journey.", es: "Elige el plan que se adapte a tu camino financiero." },
    // Interest banner
    "sub.interestBurning": { en: "Interest burning right now", es: "Intereses quemándose ahora mismo" },
    "sub.sinceOpened": { en: "since you opened this page", es: "desde que abriste esta página" },
    "sub.perDay": { en: "Per Day", es: "Por Día" },
    "sub.perMonth": { en: "Per Month", es: "Por Mes" },
    "sub.perYear": { en: "Per Year", es: "Por Año" },
    // Comparison section
    "sub.withoutKorex": { en: "🏦 Without KoreX", es: "🏦 Sin KoreX" },
    "sub.withKorex": { en: "⚡ With KoreX Velocity", es: "⚡ Con KoreX Velocity" },
    "sub.years": { en: "years", es: "años" },
    "sub.toPayOff": { en: "to pay off your debt", es: "para pagar tu deuda" },
    "sub.toFreedom": { en: "to financial freedom", es: "hacia la libertad financiera" },
    "sub.totalInterest": { en: "total interest paid", es: "total de intereses pagados" },
    "sub.youKeep": { en: "You keep", es: "Te ahorras" },
    "sub.goneToBank": { en: "that would have gone to the bank", es: "que habrían ido al banco" },
    // Billing toggle
    "sub.monthly": { en: "Monthly", es: "Mensual" },
    "sub.annual": { en: "Annual", es: "Anual" },
    "sub.saveUpTo": { en: "SAVE UP TO 60%", es: "AHORRA HASTA 60%" },
    // Plan cards
    "sub.accounts": { en: "accounts", es: "cuentas" },
    "sub.unlimited": { en: "Unlimited", es: "Ilimitadas" },
    "sub.upTo": { en: "Up to", es: "Hasta" },
    "sub.free": { en: "Free", es: "Gratis" },
    "sub.mo": { en: "/mo", es: "/mes" },
    "sub.off": { en: "OFF", es: "DESC." },
    "sub.billed": { en: "Billed", es: "Facturado" },
    "sub.year": { en: "/year", es: "/año" },
    "sub.mostPopular": { en: "⭐ MOST POPULAR", es: "⭐ MÁS POPULAR" },
    "sub.yourPlan": { en: "YOUR CURRENT PLAN", es: "TU PLAN ACTUAL" },
    // Savings badges
    "sub.inInterest": { en: "in interest", es: "en intereses" },
    "sub.noLimits": { en: "+ no limits", es: "+ sin límites" },
    "sub.futureDebt": { en: "every future debt automatically covered", es: "toda deuda futura cubierta automáticamente" },
    "sub.savedEach": { en: "saved each", es: "ahorrados cada" },
    "sub.monthWord": { en: "month", es: "mes" },
    "sub.yearWord": { en: "year", es: "año" },
    "sub.usingKorex": { en: "using KoreX", es: "usando KoreX" },
    "sub.netGain": { en: "Net gain:", es: "Ganancia neta:" },
    "sub.afterPlanCost": { en: "after plan cost", es: "después del costo del plan" },
    "sub.paysItself": { en: "Pays for itself in", es: "Se paga solo en" },
    "sub.days": { en: "days", es: "días" },
    // Features list
    "sub.debtAccounts": { en: "debt accounts", es: "cuentas de deuda" },
    "sub.allFeatures": { en: "All features included", es: "Todas las funciones incluidas" },
    "sub.freedomClock": { en: "Freedom Clock & Action Plan", es: "Reloj de Libertad y Plan de Acción" },
    "sub.pdfReports": { en: "PDF Reports & Exports", es: "Reportes PDF y Exportaciones" },
    "sub.velocitySim": { en: "Velocity Simulations", es: "Simulaciones de Velocidad" },
    // Price anchors
    "sub.anchor.velocity": { en: "☕ Less than 2 lattes/month", es: "☕ Menos que 2 cafés al mes" },
    "sub.anchor.accelerator": { en: "🍕 Less than a pizza delivery", es: "🍕 Menos que una pizza a domicilio" },
    "sub.anchor.freedom": { en: "🚗 One Uber ride per month", es: "🚗 Un viaje en Uber al mes" },
    // CTA buttons
    "sub.active": { en: "✓ Active", es: "✓ Activo" },
    "sub.downgrade": { en: "Downgrade", es: "Reducir" },
    "sub.upgradeNow": { en: "Upgrade Now", es: "Subir de Plan" },
    "sub.getStarted": { en: "Get Started", es: "Comenzar" },
    "sub.processing": { en: "Processing...", es: "Procesando..." },
    // Social proof
    "sub.accountsMonitored": { en: "Accounts Monitored", es: "Cuentas Monitoreadas" },
    "sub.debtOptimized": { en: "Debt Being Optimized", es: "Deuda Optimizándose" },
    "sub.fasterThanBanks": { en: "Faster Than Banks", es: "Más Rápido que Bancos" },
    "sub.avgInterestSaved": { en: "Avg Interest Saved", es: "Ahorro Promedio en Intereses" },
    // Trust section (NO trial — user confirmed)
    "sub.cancelAnytime": { en: "Cancel Anytime", es: "Cancela Cuando Quieras" },
    "sub.cancelAnytimeDesc": { en: "No contracts, no hidden fees. Downgrade whenever you want.", es: "Sin contratos ni cargos ocultos. Baja de plan cuando quieras." },
    "sub.allFeaturesIncluded": { en: "All Features Included", es: "Todas las Funciones Incluidas" },
    "sub.allFeaturesDesc": { en: "Every plan gets full access. Only the account limit changes.", es: "Todos los planes tienen acceso completo. Solo cambia el límite de cuentas." },
    "sub.securePlatform": { en: "Secure Platform", es: "Plataforma Segura" },
    "sub.securePlatformDesc": { en: "Your data is encrypted and protected at all times.", es: "Tus datos están encriptados y protegidos en todo momento." },
    // Promo code
    "sub.promoCode": { en: "Promo Code", es: "Código Promocional" },
    "sub.promoCodeDesc": { en: "Have a discount or special access code?", es: "¿Tienes un código de descuento o acceso especial?" },
    "sub.promoPlaceholder": { en: "Enter code (e.g. LAUNCH50)", es: "Ingresa código (ej. LAUNCH50)" },
    "sub.apply": { en: "Apply", es: "Aplicar" },
    "sub.remove": { en: "Remove", es: "Quitar" },
    "sub.devLicense": { en: "👑 Developer License — Unlimited Forever", es: "👑 Licencia Developer — Ilimitada para Siempre" },
    "sub.activePlan": { en: "Active:", es: "Activo:" },
    "sub.connectionError": { en: "Connection error. Please try again.", es: "Error de conexión. Intenta de nuevo." },
    // Manage/Cancel
    "sub.manageSub": { en: "Manage Subscription", es: "Gestionar Suscripción" },
    "sub.devPermanent": { en: "Developer license is permanent and cannot be cancelled.", es: "La licencia developer es permanente y no se puede cancelar." },
    "sub.cancelOrChange": { en: "Cancel or change your current subscription plan.", es: "Cancela o cambia tu plan de suscripción actual." },
    "sub.cancelSub": { en: "Cancel Subscription", es: "Cancelar Suscripción" },
    "sub.cancelDesc": { en: "You will be downgraded to the Starter plan (2 accounts).", es: "Serás cambiado al plan Starter (2 cuentas)." },
    "sub.cancelPlan": { en: "Cancel Plan", es: "Cancelar Plan" },
    "sub.cancelConfirm": { en: "Are you sure you want to cancel your subscription? You will be downgraded to the Starter plan.", es: "¿Estás seguro de que quieres cancelar tu suscripción? Serás cambiado al plan Starter." },
    "sub.devLifetime": { en: "Lifetime developer access — no expiration, no limits.", es: "Acceso developer de por vida — sin expiración, sin límites." },
    // Checkout toasts
    "sub.checkoutOpened": { en: "🍋 Checkout opened!", es: "🍋 ¡Checkout abierto!" },
    "sub.checkoutDesc": { en: "Complete your payment in the new tab. Your plan will update automatically.", es: "Completa tu pago en la nueva pestaña. Tu plan se actualizará automáticamente." },
    "sub.checkoutFailed": { en: "Checkout failed", es: "Error en el checkout" },
    "sub.checkoutFailedDesc": { en: "Could not open checkout. Please try again or contact support.", es: "No se pudo abrir el checkout. Intenta de nuevo o contacta soporte." },

    // ═══════════════════════════════════════════════════════════════════
    //  ONBOARDING WIZARD
    // ═══════════════════════════════════════════════════════════════════
    "onboarding.welcomeTitle": { en: "Welcome to KoreX! 🚀", es: "¡Bienvenido a KoreX! 🚀" },
    "onboarding.welcomeDesc": { en: "Let's set up your financial command center in 4 quick steps. Your data is saved securely as you go.", es: "Configuremos tu centro de comando financiero en 4 pasos rápidos. Tus datos se guardan de forma segura." },
    "onboarding.feature1": { en: "Track Income", es: "Rastrear Ingresos" },
    "onboarding.feature2": { en: "Crush Debt", es: "Destruir Deuda" },
    "onboarding.feature3": { en: "Cut Expenses", es: "Reducir Gastos" },
    "onboarding.feature4": { en: "Build Wealth", es: "Crear Riqueza" },

    // Step titles & descriptions
    "onboarding.stepIncome": { en: "Step 1 — Income", es: "Paso 1 — Ingresos" },
    "onboarding.incomeTitle": { en: "Your Income Sources", es: "Tus Fuentes de Ingreso" },
    "onboarding.incomeDesc": { en: "Add every income stream — salary, freelance, etc.", es: "Agrega cada fuente de ingreso — salario, freelance, etc." },
    "onboarding.stepExpenses": { en: "Step 2 — Expenses", es: "Paso 2 — Gastos" },
    "onboarding.expensesTitle": { en: "Your Recurring Expenses", es: "Tus Gastos Recurrentes" },
    "onboarding.expensesDesc": { en: "Add monthly bills, subscriptions, and regular costs.", es: "Agrega facturas mensuales, suscripciones y costos regulares." },
    "onboarding.stepAssets": { en: "Step 3 — Assets", es: "Paso 3 — Activos" },
    "onboarding.assetsTitle": { en: "Your Bank Accounts", es: "Tus Cuentas Bancarias" },
    "onboarding.assetsDesc": { en: "Add checking and savings accounts with current balances.", es: "Agrega cuentas de cheques y ahorro con saldos actuales." },
    "onboarding.stepDebts": { en: "Step 4 — Debts", es: "Paso 4 — Deudas" },
    "onboarding.debtsTitle": { en: "Your Debts & Liabilities", es: "Tus Deudas y Pasivos" },
    "onboarding.debtsDesc": { en: "Add credit cards, loans, and any debt you want to crush.", es: "Agrega tarjetas de crédito, préstamos y cualquier deuda que quieras eliminar." },

    // Buttons & actions
    "onboarding.letsGo": { en: "Let's Go!", es: "¡Comenzar!" },
    "onboarding.continue": { en: "Continue", es: "Continuar" },
    "onboarding.back": { en: "Back", es: "Atrás" },
    "onboarding.addItem": { en: "Add Item", es: "Agregar Item" },
    "onboarding.goToDashboard": { en: "Go to Dashboard", es: "Ir al Dashboard" },
    "onboarding.quickSelect": { en: "Quick Select", es: "Selección Rápida" },
    "onboarding.minOneRequired": { en: "⚠ At least one item is required to continue.", es: "⚠ Se requiere al menos un item para continuar." },

    // Progress labels
    "onboarding.progressWelcome": { en: "Start", es: "Inicio" },
    "onboarding.progressIncome": { en: "Income", es: "Ingresos" },
    "onboarding.progressExpenses": { en: "Expenses", es: "Gastos" },
    "onboarding.progressAssets": { en: "Assets", es: "Activos" },
    "onboarding.progressDebts": { en: "Debts", es: "Deudas" },
    "onboarding.progressDone": { en: "Done!", es: "¡Listo!" },

    // Success screen
    "onboarding.successTitle": { en: "You're All Set! 🎉", es: "¡Todo Listo! 🎉" },
    "onboarding.successDesc": { en: "Your financial command center is ready. Here's a summary of what you entered:", es: "Tu centro de comando financiero está listo. Aquí tienes un resumen:" },
    "onboarding.summaryIncome": { en: "Total Income", es: "Ingreso Total" },
    "onboarding.summaryExpenses": { en: "Total Expenses", es: "Gastos Totales" },
    "onboarding.summaryAssets": { en: "Total Assets", es: "Activos Totales" },
    "onboarding.summaryDebts": { en: "Total Debt", es: "Deuda Total" },

    // Settings — restart
    "settings.restartTutorial": { en: "Restart Tutorial", es: "Reiniciar Tutorial" },
    "settings.restartTutorialDesc": { en: "Re-run the onboarding wizard to update your financial data.", es: "Vuelve a ejecutar el asistente de configuración para actualizar tus datos financieros." },
    "settings.restartBtn": { en: "Restart", es: "Reiniciar" },

    // ═══════════════════════════════════════════════════════════════════
    //  WIDGET HELP SYSTEM
    // ═══════════════════════════════════════════════════════════════════
    "help.peaceShield.title": { en: "Peace Shield", es: "Escudo de Paz" },
    "help.peaceShield.desc": { en: "Your emergency fund progress — shows how protected you are against unexpected expenses.", es: "Tu progreso de fondo de emergencia — muestra qué tan protegido estás contra gastos inesperados." },
    "help.peaceShield.location": { en: "📍 Manage: Settings → Profile → Shield Target", es: "📍 Gestionar: Configuración → Perfil → Meta del Escudo" },
    "help.freedomClock.title": { en: "Freedom Clock", es: "Reloj de Libertad" },
    "help.freedomClock.desc": { en: "Countdown to your projected debt-free date using velocity banking acceleration.", es: "Cuenta regresiva hacia tu fecha estimada libre de deudas usando aceleración de velocity banking." },
    "help.freedomClock.location": { en: "📍 Data: Calculated from your debts & cashflow", es: "📍 Datos: Calculado desde tus deudas y flujo de caja" },
    "help.burndown.title": { en: "Burndown Projection", es: "Proyección de Liquidación" },
    "help.burndown.desc": { en: "A visual chart showing the projected payoff timeline for your debts over time.", es: "Un gráfico visual que muestra la línea de tiempo proyectada de pagos de tus deudas." },
    "help.burndown.location": { en: "📍 Data: Accounts Page → Liabilities", es: "📍 Datos: Página de Cuentas → Pasivos" },
    "help.actionPlan.title": { en: "Action Plan", es: "Plan de Acción" },
    "help.actionPlan.desc": { en: "Step-by-step instructions for your next velocity banking move — which debt to attack and when.", es: "Instrucciones paso a paso para tu próximo movimiento de velocity banking — qué deuda atacar y cuándo." },
    "help.actionPlan.location": { en: "📍 Data: Strategy Page → GPS", es: "📍 Datos: Página de Estrategia → GPS" },
    "help.cashflowHeat.title": { en: "Cashflow Heat Calendar", es: "Calendario de Calor de Flujo de Caja" },
    "help.cashflowHeat.desc": { en: "A heatmap calendar showing your daily cash balance projections for the next 6 months.", es: "Un calendario de calor mostrando las proyecciones diarias de tu saldo de caja para los próximos 6 meses." },
    "help.cashflowHeat.location": { en: "📍 Data: Cashflow Page → Income & Expenses", es: "📍 Datos: Página de Flujo → Ingresos y Gastos" },
    "help.debtSnapshot.title": { en: "Debt Snapshot", es: "Resumen de Deudas" },
    "help.debtSnapshot.desc": { en: "Quick overview of your total debt balance, interest rate, and monthly minimum payments.", es: "Visión rápida de tu saldo total de deuda, tasa de interés y pagos mínimos mensuales." },
    "help.debtSnapshot.location": { en: "📍 Manage: Accounts Page → Liabilities", es: "📍 Gestionar: Página de Cuentas → Pasivos" },
    "help.netWorth.title": { en: "Net Worth", es: "Patrimonio Neto" },
    "help.netWorth.desc": { en: "Your total assets minus total liabilities — the true measure of financial health.", es: "Tus activos totales menos tus pasivos totales — la medida real de salud financiera." },
    "help.netWorth.location": { en: "📍 Data: Accounts Page → All Accounts", es: "📍 Datos: Página de Cuentas → Todas las Cuentas" },
    "help.purchaseSim.title": { en: "Purchase Simulator", es: "Simulador de Compras" },
    "help.purchaseSim.desc": { en: "See the REAL cost of a purchase — how many extra days of debt and extra interest it costs you.", es: "Ve el costo REAL de una compra — cuántos días extra de deuda e interés adicional te cuesta." },
    "help.purchaseSim.location": { en: "📍 Use: Enter any amount to simulate", es: "📍 Uso: Ingresa cualquier monto para simular" },
    "help.cashflowSummary.title": { en: "Cashflow Summary", es: "Resumen de Flujo de Caja" },
    "help.cashflowSummary.desc": { en: "Your monthly income vs expenses breakdown — shows your net surplus available for debt acceleration.", es: "Desglose de ingresos vs gastos mensuales — muestra tu excedente neto disponible para acelerar deudas." },
    "help.cashflowSummary.location": { en: "📍 Manage: Cashflow Page", es: "📍 Gestionar: Página de Flujo de Caja" },
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
