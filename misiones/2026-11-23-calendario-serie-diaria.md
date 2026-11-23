# Misión: Calendario que se actualiza solo (serie diaria real del motor)
- **ID:** 2026-11-23-calendario-serie-diaria
- **Estado:** en-curso
- **Rama:** feat/calendario-serie-diaria
- **Repo:** CoreX-SF

## Objetivo
Que el motor emita la serie **diaria** de deuda total proyectada (pagos y días de cobro en su día real) y
que el calendario la consuma: el día de libertad se calcula, no se estima por ritmo.

## Contexto
- Hoy `frontend/src/lib/calendarSeries.ts` interpola linealmente entre cierres de mes
  (`timeline[].total_balance` de `GET /api/velocity/freedom-path`) y estima el día $0 por el ritmo del
  mes anterior (nota TECH DEBT).
- El motor mensual es `velocity_engine._simulate_freedom_path` (memoizado por `simulate_freedom_path`).
  La serie diaria se deriva de **los mismos flujos de esa simulación** (interés, mínimo, ataque por deuda
  y mes), repartidos en su día real: interés en el corte (`closing_day`), mínimo en el vencimiento
  (`due_day`), ataque en los días de cobro del cashflow (mismo disparador que `cashflow._item_triggers`).
  Así el cierre de cada mes es, por construcción, el `total_balance` del timeline.
- Aditivo: campo nuevo `daily_series` en la respuesta de freedom-path; `timeline`, `freedom_date`, etc.
  no cambian.
- La serie viaja dentro de la entrada `kx-summary` de React Query (la misma que ya invalidan pagos y
  ataques). Auditoría de la cadena: hay mutaciones (cuentas, cashflow, suscripciones, plan de acción,
  onboarding) que no invalidan esa entrada.

## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | El saldo de la serie diaria al cierre de cada mes iguala el `total_balance` del timeline mensual, mes a mes | `pytest tests/test_daily_series.py::test_month_close_matches_timeline` (varios usuarios de prueba: tarjetas con corte/vencimiento, préstamo fijo, sin días de cobro, varios cobros al mes) y `::test_endpoint_daily_matches_timeline` (vía `GET /api/velocity/freedom-path`) | passed |
| 2 | El día de libertad del calendario es el primer día en que la serie diaria llega a 0, sin estimación por ritmo | Backend: `pytest tests/test_daily_series.py::test_zero_day_is_first_zero`. Front: `vitest calendarSeries.test.ts -t "zero day comes from the daily series"` (fixture con día cero conocido, distinto del que daría el ritmo) | passed |
| 3 | Registrar un pago (o confirmar un ataque) invalida también la serie: el calendario abierto refleja el nuevo saldo sin recargar | `vitest planSync.test.tsx` — un `POST /api/transactions` (y `POST /api/strategy/execute`) vuelve a pedir freedom-path y el calendario montado pinta el nuevo saldo; también cuentas/cashflow/suscripciones | passed |
| 4 | Puerta compartida en verde, sin migración | `python scripts/verify.py`; `git diff --name-only origin/main...HEAD -- backend/alembic` | `verify: OK` (exit 0); lista vacía (heads sigue == 1) |
| 5 | Rendimiento: freedom-path no empeora de forma material | Método de la casa: token demo, mediana de 5, cabecera `X-Process-Time`, local; más el motor en frío (caché vaciada) antes/después | tabla antes/después en el Reporte; aumento en servidor < 20 % o < 10 ms |

## Pasos
1. Motor: `_simulate_freedom_path` registra los flujos por deuda y mes; `daily_series(...)` los reparte
   por día. La ruta freedom-path añade `daily_series` con los días de cobro del usuario.
2. Front: `buildMonths` usa la serie diaria (saldo exacto por día, día cero exacto); la interpolación
   queda de respaldo. Retirar la nota TECH DEBT.
3. Invalidación: un único punto que invalida los datos del plan tras toda mutación que los cambia.
4. Medir antes/después.

## No tocar
- Reglas del motor mensual (avalancha, mínimos, interés): el timeline mensual debe salir idéntico.
- Eventos del calendario (`/api/calendar/events`), copy legal, billing, RLS.

## Reporte (lo llena Claude al ejecutar)
- **Fecha:**
- **Rama y commit:**
- **Evidencia de los criterios de aceptación** (uno a uno, con el número de la tabla):
- **Checklist de auto-verificación** (cada ítem con su artefacto; una marca sola no vale):
- **Desviaciones o dudas:**
