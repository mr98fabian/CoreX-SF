# Misión 14 · Entregable 1 — Tabla de concordancia

Una fila por número. **Valor** = caso #1 (anonimizado, 2026-11-24) salvo que se indique otra persona.
**¿Concuerda?** compara el mismo concepto en el mismo instante entre superficies (tolerancia $0.01).
Los `N-xx` remiten a `2-discrepancias.md`. Rutas relativas a `backend/` o `frontend/src/`.

## A. Foto de hoy (sin proyección)

| # | Número | Superficie | Valor | Fuente (función) | Fórmula | ¿Concuerda? | Clase · severidad |
|---|---|---|---|---|---|---|---|
| A1 | Deuda total | Inicio, Cuentas | 35,410.63 | `routers/dashboard.py:50` | Σ saldo de deudas activas (límite del plan) | sí | — |
| A2 | Deuda total | Gráfica de Inicio (`deuda_hoy`) | 35,410.63 | `velocity_engine.compare_paths:290` | Σ saldo > 0 | sí | — |
| A3 | Deuda total | Plan (`projections.total_debt`) | 35,410.63 | `velocity_engine.get_projections:796` | Σ saldo | sí | — |
| A4 | Deuda total | Calendario, día 1 del mes | 35,410.63 | `daily_series:1485` | saldo de **hoy** rotulado día 1 | sí en valor; es el saldo de hoy, no el del día 1 | (a) · pulido (N-02) |
| A5 | Deuda total | Calendario, celda de **hoy** | 29,249.15 | `daily_series:1494` | saldo − eventos del mes «aterrizados» hoy | **no** (−6,161.48) | (a) · crítica (N-02) |
| A6 | Deuda no monitoreada | Inicio | 0.00 | `routers/dashboard.py:52` | Σ todas − Σ activas | sí (única fuente) | — |
| A7 | Efectivo («Disponible para tu plan») | Inicio | 4,803.20 | `routers/dashboard.py:53` → `HomePage.tsx:105` | Σ saldo de cuentas no-deuda | **no** vs ataque 0.00 | (a) · crítica (N-06) |
| A8 | Efectivo | Plan (`available_cash`), escudo | 4,803.20 | `helpers.get_liquid_cash` | ídem | sí | — |
| A9 | Escudo (meta) | Ajustes, misión, GPS | 1,000.00 | `helpers.get_shield_target` | `user_settings.shield_target` | sí | — |
| A10 | Interés diario | Inicio | 24.47 | `velocity_engine.daily_interest` | Σ saldo × APR / 36500 | sí (manual 24.4724) | — |
| A11 | Interés diario por deuda | Plan (ranking) | p. ej. Préstamo personal 10.10 | `debt_daily_interest` | saldo × APR / 36500 | sí | — |
| A12 | Interés diario por cuenta | Cuentas | igual valor | **frontend** `AccountsPage.tsx:820` | `balance × APR / 100 / 365` en cliente | sí en valor; calcula por su cuenta | (a) · molesta (N-10) |
| A13 | Interés por semana | Inicio | 137.06 | `interest_periods` | día redondeado × 7 | sí | — |
| A14 | Interés por mes | Inicio | 744.30 | `interest_periods` | día redondeado × 365/12 | **no** vs A15, A16 | (a/c) · molesta (N-09) |
| A15 | Interés del mes | Simulador / Calendario | 744.38 | `_simulate_freedom_path:1377` | Σ redondeo(saldo × APR/12) | no | (a/c) · molesta |
| A16 | Interés por mes | Ajustes → Suscripción | 734.10 | **frontend** `SettingsPage.tsx:933` | día × 30 en cliente | no | (a) · molesta |
| A17 | Interés por año | Inicio, Ajustes | 8,931.55 | `interest_periods` / `SettingsPage.tsx:938` | día redondeado × 365 | sí entre sí; 8,932.44 sin redondear | (c) · pulido (N-16) |
| A18 | Mínimo por cuenta | Cuentas, Calendario, resumen | Tarjeta A 97.91 | `helpers.account_plan_minimum` | `max(almacenado, regla)` tope saldo | **no** vs A19 | (a) · molesta (N-07) |
| A19 | Mínimo por cuenta | Misión (brecha), sobrante seguro, `velocity_target` | Tarjeta A 71.26 | `MissionAccount.min_payment` (`velocity_engine.py:2158, 2165, 941`; `dashboard.py:266`) | valor almacenado | no | (a) · molesta |
| A20 | Pagos de deuda al mes | Reloj, Cuentas, Plan | 1,466.10 | `cashflow_summary:1862` / `get_projections:797` | Σ `plan_minimum` | sí | — |
| A21 | Mínimos del mes | Calendario | 1,396.10 | `helpers.calendar_month:450` | Σ `plan_minimum` de deudas **con fecha** | no vs A20 (−70.00 sin fecha); avisado en `deudas_sin_fecha` | (a) · pulido |
| A22 | Utilización de crédito | Cuentas | por tarjeta | `velocity_engine.credit_panel` | saldo / límite | sí | — |
| A23 | Utilización por tarjeta | Lista de Cuentas | por tarjeta | **frontend** `AccountsPage.tsx:877` | `round(balance / limit × 100)` en cliente | calcula por su cuenta (redondeo distinto: entero vs 1 decimal) | (c) · pulido |

## B. Flujo mensual

| # | Número | Superficie | Valor | Fuente | Fórmula | ¿Concuerda? | Clase · severidad |
|---|---|---|---|---|---|---|---|
| B1 | Ingreso mensual | Reloj, Cuentas, Análisis | 13,242.50 | `velocity_engine.monthly_income` | Σ monto × factor (semanal 52/12) | sí | — |
| B2 | Entra este mes | Calendario | 12,305.00 | `helpers.calendar_month:468` | Σ ingresos fechados del mes | **no** vs B1 (mes calendario vs promedio) | (a) · molesta (N-08) |
| B3 | Gastos mensuales | Reloj, Análisis | 3,062.50 | `cashflow_summary:1860` | Σ gastos sin duplicados de suscripción | sí | — |
| B4 | Suscripciones al mes | Suscripciones | 1,767.84 | `routers/recurring.summarize` | Σ activas × factor | sí = B5 | — |
| B5 | Suscripciones al mes | Reloj, Plan, Análisis | 1,767.84 | `cashflow_summary:1861` | misma `monthly_amount` | sí | — |
| B6 | Suscripciones al año | Suscripciones | 21,214.08 | `summarize:57` | mensual × 12 | sí | — |
| B7 | Sale al mes | Reloj, Cuentas | 6,296.44 | `cashflow_summary:1871` | gastos + suscripciones + pagos | **no** vs B8 | (a) · molesta (N-08) |
| B8 | «Te cobran este mes» | Calendario | 6,226.44 | `helpers.calendar_month:463` | Σ cobros fechados del mes entero (4,751.36 ya pasaron) | no | (a) · molesta |
| B9 | Excedente / «Te sobra» | Reloj, Plan | 6,946.06 | `velocity_engine.monthly_surplus` | ingreso − gastos − suscripciones − pagos | sí entre sí | — |
| B10 | Aporte mensual del plan | Gráfica, Plan | 6,946.06 | `monthly_attack` | = B9 (o % del efectivo sin ingresos) | sí = B9; **no** vs ataque real (C3) | (b) · crítica (N-03) |

## C. Misión del día y GPS (motor de caja)

| # | Número | Superficie | Valor | Fuente | Fórmula | ¿Concuerda? | Clase · severidad |
|---|---|---|---|---|---|---|---|
| C1 | Misión (único pendiente) | Inicio | Tarjeta B a $0 antes del 29-nov | `helpers.build_daily_mission` | primera obligación | sí = C2 | — |
| C2 | Misión | Plan (command-center) | ídem | misma función | ídem | sí | — |
| C3 | Ataque de hoy | Inicio, Plan | 0.00 | `get_daily_mission:2172-2177` | sobrante seguro tras la reserva | sí entre sí | — |
| C4 | Reserva | Inicio (`mision.reserva`, `reserved_for_bills`) | 6,014.24 | `get_daily_mission:2151` | Σ obligaciones a 35 días | **no** vs C5 y vs su texto | (a) · crítica (N-04) |
| C5 | Reserva (desglose) | `/api/dashboard.safety_breakdown` | 1,339.93 | `calculate_safe_attack_equity` | efectivo − escudo − punto más bajo (mínimos almacenados) | no | (a) · crítica |
| C6 | Texto de la reserva | `/api/dashboard.velocity_target.justification` (lo lee el asistente por token) | «pagos mínimos… este mes» | `routers/dashboard.py:138-143` | copy fijo | no describe C4 | (a) · crítica |
| C7 | Faltante | Inicio | 797.24 (Auto 11-dic) | `get_daily_mission:2181-2190` | reserva acumulada − efectivo de hoy | **no** vs C8 | (b) · crítica (N-05, D1) |
| C8 | Faltantes | GPS | ninguno; caja mínima 1,413.80 | `generate_action_plan:673-676` | caja día a día con ingresos fechados | no | (b) · crítica |
| C9 | Pagos a deuda en noviembre | GPS | 1,550.74 | `generate_action_plan` | Σ obligaciones con acción ≤ 30-nov | sí = pagos reales programados | — |
| C10 | Primer ataque | GPS | 12-dic, 1,777.78 a Préstamo personal | `generate_action_plan:712-719` | sobrante de la misión de ese día | sí (avalancha) | — |
| C11 | Monto recomendado | Ataque | recorte propio | **frontend** `AttackPage.tsx:74` | `min(monto, saldo, fondos)` en cliente | calcula por su cuenta | (a) · molesta (N-10) |
| C12 | Ahorro diario / mensual / «días acortados» por pago | Plan (historial) | por pago | **frontend** `ActionPlanPage.tsx:397-402` | pago × APR/365; × 30; pago / interés diario | **sin fuente en el motor** | (a) · molesta (N-10) |
| C13 | Totales del mes (ataque, mínimos, ingresos) | Plan | por mes | **frontend** `ActionPlanPage.tsx:307-310` | Σ movimientos en cliente | calcula por su cuenta | (a) · pulido |
| C14 | Próximo día de pago | `/api/dashboard.velocity_target.next_payday` | 1-dic | `routers/dashboard.py:101-116` | solo `day_of_month` | **no** (la nómina cae el viernes 27) | (a) · pulido (N-15) |

## D. Proyecciones (motor mensual)

| # | Número | Superficie | Valor | Fuente | Fórmula | ¿Concuerda? | Clase · severidad |
|---|---|---|---|---|---|---|---|
| D1 | Debes al cierre del mes | Calendario | ≈ 27,743 | `daily_series` ← `_simulate_freedom_path` | hoy + interés mes − mínimos − excedente | **no** vs GPS 33,859.89 (C9) | (b) · crítica (N-01) |
| D2 | Bajas del mes | Calendario | ≈ 7,668 | `DebtCalendar.tsx:118` | `mo.start − mo.end` | **no** vs 1,550.74 programados | (b) · crítica (N-01) |
| D3 | Serie diaria | Calendario (banda, hoja del día) | 24: 29,249 · 26: 29,201 · 27: 27,812 · 30: 27,743 | `daily_series:1486-1509` | flujos mensuales colocados por día | no (N-01, N-02) | (b) · crítica |
| D4 | Día en verde | Calendario | marzo 2027 | `calendarSeries.monthsFromDaily` | primer día con serie en 0 | sí = D5; hereda N-03 | (b) · crítica |
| D5 | Fecha de libertad | Inicio, Plan, GPS, logros | 2027-03-01 | `compare_paths:315` / `get_projections:819` | fin de la ruta mensual | sí entre sí; **no** reserva | (b) · crítica (N-03) |
| D6 | Meses del plan | Gráfica | 5 | `compare_paths:313` | meses simulados (cuenta el actual) | **no** vs 4 meses calendario | (a) · molesta (N-11) |
| D7 | Interés del plan («pagarás» = deuda + interés) | Plan, logros | 1,893.18 (→ 37,303.81) | `compare_paths:317` | Σ interés de la ruta | hereda N-03 | (b) · crítica |
| D8 | Interés solo mínimos | Gráfica | 22,271.23 | `compare_paths:331` | ruta de mínimos recalculados | sí (única fuente) | — |
| D9 | «Ahorrarás» | Inicio, Plan, GPS, modal, Ajustes | 20,378.05 | `compare_paths:305` | D8 − D7 | sí entre sí; hereda N-03 | (b) · crítica |
| D10 | Fecha solo mínimos | Gráfica, GPS | 2039-10-01 | `compare_paths:325` | fin de la ruta de mínimos | sí | — |
| D11 | Pagos a deuda en diciembre | GPS vs ruta mensual | 9,897.33 vs 8,417.41 | `generate_action_plan` vs `_simulate_freedom_path` | caja vs promedio | **no**, en la misma respuesta | (a) · molesta (N-03) |
| D12 | Proyección de caja | `/api/cashflow/projection` (sin pantalla) | — | `routers/cashflow.py:137` | ingreso solo si `category == "income"` | **no** (ingresos «Ingreso» restan) | (a) · pulido (N-15) |

## E. Avisos (push y correo)

| # | Número | Superficie | Valor | Fuente | Fórmula | ¿Concuerda? | Clase · severidad |
|---|---|---|---|---|---|---|---|
| E1 | Monto de la misión | Push y correo «Tu misión de hoy» | monto de la misión | `push_engine.candidates:184-193` | `mision.monto` si acción ≤ hoy | sí = C1 | — |
| E2 | Saldo en aviso de corte | Push y correo «Corte en 2 días» | saldo completo | `push_engine.py:176-180` | `a.balance` | **no** vs corte de la misión (saldo − mínimo de estado; inexistente en estado «estado») | (a) · molesta (N-14) |
| E3 | Deuda saldada | Push «celebración» | sin monto | `push_engine.py:195-203` | saldo ≤ 0 + movimiento en 7 días | sí | — |
| E4 | Resumen de avisos | `/api/notifications/summary` (sin pantalla) | error | `routers/notifications.py:92` | `account_type` inexistente | sin fuente válida | pulido (N-15) |

## F. Cuenta demo (María) — cifras públicas

| # | Número | Superficie | Valor público | Valor del motor | Fuente | ¿Concuerda? | Clase · severidad |
|---|---|---|---|---|---|---|---|
| F1 | Deuda | Demo, landing, onboarding | 18,400 | 18,400.00 | `routers/demo.py` MARIA | sí | — |
| F2 | Disponible | Onboarding | 3,350 | 3,350.00 | cheques 2,150 + ahorro 1,200 | sí | — |
| F3 | Interés diario | Landing | 13.12 | 13.12 | `daily_interest` (`test_demo_persona.py`) | sí | — |
| F4 | Meses a $0 | Landing | 14 | `plan.meses` = 15 | `compare_paths:313` | **no** | (a) · molesta (N-11) |
| F5 | Ahorro de interés | Landing | 30,176 | 30,176.05 | `compare_paths:305` | sí | — |
| F6 | «Plan $22,100 / $12,300» | citado en la misión | 22,100 / 12,300 | pagarás 21,632.86 / ahorro 30,176.05 | **ninguna** | **sin fuente identificada** | hallazgo · molesta (N-13) |
| F7 | Misión de la demo | Inicio (demo) | — | reserva 18,400.00, «Te faltan $3,062.50», ataque 0 | `get_daily_mission` | **no** vs plan de 15 meses | decisión D2 · crítica en demo (N-12) |
| F8 | Cierre de mes (demo) | Calendario (demo) | — | 17,360.60 (bajas 1,039.40) vs GPS 16,100.00 | N-01 | no | (b) · crítica |

## G. Otras personas fijas

| Persona | Deuda hoy | Ataque | Reserva | Faltante Inicio | Faltantes GPS | Calendario «bajas» | Pagos a deuda del mes (GPS) |
|---|---|---|---|---|---|---|---|
| Caso real (anon.) 24-nov | 35,410.63 | 0 | 6,014.24 | 797.24 | 0 | 7,667.78 | 1,550.74 |
| María (demo) | 18,400.00 | 0 | 18,400.00 | 3,062.50 | sí (caja −685) | 1,039.40 | 2,300.00 |
| Dueño (`test_invariantes_numeros`) | 26,595.52 | 0 | 2,447.70 | 405.07 | 0 | 4,821.60 | 0.00 |

En las tres personas el Calendario y el GPS dan cierres de mes distintos; en dos de tres Inicio anuncia un
faltante que el GPS no tiene.

## Resumen

- **Concuerdan**: deuda total (salvo la celda de hoy del Calendario), efectivo, escudo, interés diario,
  suscripciones, resumen mensual, misión Inicio = Plan, fecha de libertad Plan = Calendario.
- **No concuerdan**: 6 críticas (N-01 a N-06), 8 molestas (N-07 a N-14), 3 de pulido (N-15 a N-17).
- **Sin fuente identificada**: F6 (cifras públicas de la demo), C12 («días acortados»).
