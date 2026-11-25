# Misión 14 · Entregable 3 — Especificación de la fuente única

Para Opus (misión siguiente). **Puerta**: Fabian aprueba esta especificación y las decisiones D1-D4 de
`2-discrepancias.md` antes de construir. Sin tocar avalancha, cortes ni escudo salvo lo que Fabian decida.

## Principio

**Un solo motor de caja fechado manda sobre todo lo que ocurre antes del cierre del mes siguiente; el motor
mensual solo continúa desde donde el de caja termina.** Hoy el motor de caja ya existe y es correcto
(`generate_action_plan` = la misión proyectada día a día). Se convierte en la fuente; el mensual deja de
simular el mes en curso.

## 1. Conceptos y su función dueña

| Concepto | Función dueña (única) | Hoy | Qué cambia |
|---|---|---|---|
| Deuda total hoy | `helpers.total_debt(accounts, plan_limit)` (nueva, envuelve `filter_active_debt_accounts`) | 4 sumas sueltas | dashboard, compare, projections, calendario la llaman |
| Efectivo | `helpers.get_liquid_cash` | ya único | — |
| Disponible para atacar | `get_daily_mission()["ataque"]` | Inicio muestra efectivo | según D3: `HomePage.tsx:105` muestra el ataque o rotula «efectivo» |
| Interés diario / periodos | `velocity_engine.daily_interest` + `interest_periods` | 3 fórmulas de mes | Ajustes y Cuentas leen el campo del servidor; el simulador sigue con interés por mes (es su paso), pero no se rotula «interés del mes» en pantalla |
| Mínimo | `helpers.account_plan_minimum` | almacenado en misión/sobrante | `MissionAccount.min_payment` = `engine_minimum` en brecha y sobrante (`velocity_engine.py:2158, 2165`); `velocity_target.min_payment` igual |
| Reserva | `get_daily_mission()["reserva"]` + su desglose `obligaciones` | 3 definiciones | se borra `calculate_safe_attack_equity` del dashboard (`routers/dashboard.py:74-77`) y `safety_breakdown` pasa a ser `obligaciones`; copy de `justification` describe la reserva real («para el corte de Tarjeta B del 1-dic y 5 pagos más hasta el 20-dic») |
| Faltante | motor de caja fechado (D1) | caja de hoy vs 35 días | `get_daily_mission` reutiliza la simulación de caja de `generate_action_plan` para decidir faltante |
| Serie diaria de deuda (Calendario) | **nueva** `velocity_engine.debt_path(...)` | `daily_series` mensual | ver §2 |
| Cierre de mes / bajas | `debt_path` | `daily_series` | `bajas = deuda de hoy − cierre`; rotular «desde hoy» |
| Fecha de libertad, meses, interés del plan, ahorro | `debt_path` (tramo diario + continuación mensual) | `compare_paths` desde el día 1 | `compare_paths` y `get_projections` arrancan la ruta mensual desde el estado del GPS al final del horizonte |
| Lo que entra / sale este mes | `helpers.calendar_month` (mes calendario) y `cashflow_summary` (promedio) | mismo nombre | quedan los dos, con rótulos distintos: «Este mes (fechado)» vs «Al mes (promedio)» |
| Monto del aviso de corte | `mission_obligations` (obligación `corte`) | `a.balance` | `push_engine.candidates:176-180` toma el monto de la obligación del corte |
| Ahorro por pago / días acortados | `velocity_engine.payment_impact` (nueva) o retirar | frontend | `ActionPlanPage.tsx:397-402` deja de calcular |

## 2. `debt_path` — el motor único de proyección

```
debt_path(mission_accounts, incomes, expenses, liquid_cash, shield, weapons, today, horizon_days=62) -> {
  "daily": [{date, total_balance}],        # día a día, desde HOY (no desde el día 1)
  "monthly": timeline,                       # mismo contrato que simulate_freedom_path
  "freedom_date", "total_months", "total_interest_paid",
  "etiqueta": "estimado",
}
```

1. **Tramo de caja (hoy → hoy + horizonte)**: `generate_action_plan` tal cual (obligaciones primero,
   escudo, ataque solo del sobrante, avalancha estricta, corte a $0 en su turno). El saldo de cada día =
   saldo de ayer − pagos del día + interés diario (`debt_daily_interest`) acumulado del día.
2. **Continuación mensual**: `_simulate_freedom_path` arrancando el **mes siguiente al fin del horizonte**,
   con los saldos que el tramo de caja dejó y el excedente mensual (D4 decide si se mantiene el promedio).
3. Los días anteriores a hoy **no se proyectan**: el Calendario pinta el pasado con el saldo de hoy (o
   gris), nunca con eventos «aterrizados» hoy.
4. `daily_series`, `compare_paths(plan)`, `get_projections`, `/api/velocity/freedom-path`,
   `/api/strategy/tactical-gps` (fechas) y `coach.py` leen de `debt_path`. La ruta «solo mínimos» queda
   igual (es la comparación honesta).

## 3. Pantallas que dejan de calcular

| Archivo | Línea | Hoy calcula | Debe leer |
|---|---|---|---|
| `frontend/src/features/settings/SettingsPage.tsx` | 933, 938 | interés × 30, × 365 | `interes_diario.periodos` de `/api/dashboard` (o del mismo campo en savings-estimate) |
| `frontend/src/features/accounts/AccountsPage.tsx` | 269-271, 820 | interés diario por cuenta | `daily_interest` por cuenta servido en `/api/accounts` |
| `frontend/src/features/accounts/AccountsPage.tsx` | 877 | utilización entera | `credit_panel.por_tarjeta` (1 decimal) |
| `frontend/src/features/actionplan/ActionPlanPage.tsx` | 307-310, 397-402 | totales del mes, ahorro, días acortados | campos del GPS (`totales_mes`, `payment_impact`) |
| `frontend/src/features/attack/AttackPage.tsx` | 74 | `Math.min` del monto | `recommended_action.amount` (ya viene topado por `attack_impact`) |
| `frontend/src/components/kx/DebtCalendar.tsx` | 118 | `mo.start − mo.end` | `bajas_desde_hoy` servido por `debt_path` |
| `backend/routers/dashboard.py` | 74-77, 101-116, 132-145 | sobrante viejo, próximo pago, copy | misión, `payday_rule`, copy derivado de `obligaciones` |

Endpoints sin pantalla con definición propia (N-15): `/api/cashflow/projection`,
`/api/notifications/summary`, `/api/notifications/upcoming`, el `/api/cashflow/summary` duplicado en
`strategy.py:313`. Retirar o reescribir sobre las funciones dueñas.

## 4. Tests de concordancia para CI (regla de oro)

Nuevo `backend/tests/test_concordancia.py`, parametrizado por **persona** con `today` fijo:
`caso_real_anon_2026_11_24` (datos de `evidencia/sonda_concordancia.py::seed_caso_real`), `maria_demo`,
`owner_invariantes`, y el mismo caso con `today` = 1, 15 y 30 de noviembre. Todos vía HTTP (TestClient),
para probar las respuestas que ven las pantallas, no solo las funciones.

| Test | Aserción (tolerancia $0.01) |
|---|---|
| `test_deuda_total_igual_en_todas` | `dashboard.total_debt == Σ /api/accounts deudas == compare.deuda_hoy == projections.total_debt == freedom_path.daily[hoy]` |
| `test_cierre_de_mes_calendario_igual_a_gps` | `freedom_path` cierre del mes en curso `==` deuda de hoy − Σ pagos a deuda del GPS con fecha ≤ fin de mes + interés diario acumulado |
| `test_bajas_no_dependen_de_dias_pasados` | con `today` = 30, `bajas ≤ pagos del GPS el 30 + 0.01`; nunca la baja de un mes entero |
| `test_calendario_no_ataca_lo_que_la_mision_reserva` | si `mision.ataque == 0`, ningún día del tramo diario baja más que las obligaciones de ese día |
| `test_reserva_una_sola_definicion` | `dashboard.reserved_for_bills == mision.reserva == Σ mision.obligaciones.monto` y `safety_breakdown` no contradice |
| `test_copy_de_reserva_describe_la_reserva` | `justification` no contiene «mínimos» cuando hay obligaciones de corte/estado; nombra el mes correcto |
| `test_faltante_inicio_igual_gps` | `mision.faltante is None` ⇔ el GPS no tiene movimientos `faltante` (tras D1) |
| `test_disponible_es_el_ataque` | (tras D3) el número rotulado «disponible» en `/api/dashboard` == `mision.ataque` |
| `test_interes_periodos_unicos` | `savings-estimate` y `dashboard` dan los mismos `dia/semana/mes/anio` |
| `test_minimo_unico_en_misión` | la brecha de interés de la misión usa `account_plan_minimum` (Tarjeta A 97.91, no 71.26) |
| `test_fecha_libre_unica` | `compare.plan.fecha_libre == freedom_path.freedom_date == tactical_gps.freedom_date_velocity == projections.velocity_debt_free_date` y el tramo diario del GPS es su prefijo |
| `test_meses_calendario` | `plan.meses` = meses calendario hasta la fecha de libertad (María: 14) |
| `test_aviso_corte_igual_obligacion` | monto del push «corte» == monto de la obligación `corte` de esa tarjeta |
| `test_demo_publica` | María: deuda 18,400; disponible 3,350; ahorro == constante de la landing; meses == `EXAMPLE_MONTHS`; misión sin caja negativa en el GPS (tras D2) |

Frontend (Vitest): `DebtCalendar` y `SettingsPage` no contienen aritmética de dinero (`* 30`, `* 365`,
`start - end`) — test de texto sobre el código, como `invariantes.test.ts`.

Los tests nacen **en rojo** contra `main` (prueban N-01 a N-14); la misión de Opus termina cuando están en
verde. No se marcan en `verify-known-failures.txt`: entran en la misma rama que la corrección.

## 5. Orden recomendado para Opus

1. `test_concordancia.py` en rojo (primer commit de su rama).
2. Mínimo único en misión (N-07) y reserva única + copy (N-04) — baratos y sin decisión.
3. `debt_path` y migrar Calendario/compare/projections (N-01, N-02, N-03, N-11).
4. Faltante y corte según D1/D2 (N-05, N-12).
5. Pantallas que dejan de calcular (N-09, N-10) y aviso de corte (N-14).
6. Endpoints sin pantalla (N-15).
