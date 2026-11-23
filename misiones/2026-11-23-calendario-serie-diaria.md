# Misión: Calendario que se actualiza solo (serie diaria real del motor)
- **ID:** 2026-11-23-calendario-serie-diaria
- **Estado:** en-auditoria
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
- **Fecha:** 2026-11-23
- **Rama y commit:** `feat/calendario-serie-diaria` — db29052 (criterios), c848529 (código + tests).
- **Qué cambió:**
  - `velocity_engine._simulate_freedom_path` registra, por mes y deuda, interés, mínimo y ataque como
    diferencias de saldo (incluido el redondeo de 1 ¢ al liquidar). El memo los guarda junto al resultado.
  - `velocity_engine.daily_series` reparte esos flujos por día:
    - el interés va al corte, nunca después del primer pago de esa deuda;
    - el mínimo va al vencimiento;
    - el ataque va a los días de cobro, repartido a partes iguales con el resto en el último;
    - sin dato de día, todo va a fin de mes;
    - lo que en el mes en curso cae antes de hoy se aplica hoy.
  - Formato de la serie: escalones `[{date, total_balance}]`.
  - `GET /api/velocity/freedom-path` añade `daily_series`; el resto del contrato es idéntico. Sale del
    mismo `load_cashflow_inputs` que ya cargaba, así que no hay SQL nueva.
  - Front:
    - `calendarSeries.buildMonths(…, daily)` lee cada día de la serie, y el día $0 es el primero en 0;
    - la interpolación queda solo como respaldo;
    - nota TECH DEBT retirada.
  - Invalidación: `apiFetch` señala toda escritura del plan (`lib/planEvents.PLAN_WRITE`). `QueryProvider`
    invalida el conjunto `lib/planSync.PLAN_QUERY_KEYS`, el mismo que usa `useKxSummary().reload`.
- **Evidencia de los criterios de aceptación:**
  1. Cierre diario = timeline mes a mes:
     - `pytest tests/test_daily_series.py -q` → `17 passed`.
     - `test_month_close_matches_timeline` cubre 4 usuarios × 3 fechas de inicio (día 1, día 23, febrero),
       con estos casos: tarjetas con corte y vencimiento, préstamo fijo, sin cobros ni días cargados,
       vencimiento el 31.
     - Afirma `[closes[t.date]] == [t.total_balance]` y además `r["timeline"] == simulate_freedom_path(...)["timeline"]`,
       es decir, el contrato mensual no cambia.
     - `test_endpoint_daily_matches_timeline` hace lo mismo vía HTTP y comprueba que compare y freedom-path dan los mismos números.
     - Preview local (demo, 2026-11-23): el cierre de noviembre de la serie es 32,783.44, igual que `timeline[0].total_balance`.
       El calendario pinta $33,679 hasta el día 22 y $32,783 desde el 23.
  2. Día cero = primer 0 de la serie:
     - Fixture: $1,000 al 0 %, mínimo $100 el día 10 y $300 extra en cobros los días 1 y 15.
     - Backend: `test_zero_day_is_first_zero` → primer 0 el **15-ene-2027**. La estimación por ritmo daba el 16.
     - Front, con el mismo fixture: `vitest calendarSeries.test.ts -t "zero day comes from the daily series"` → passed.
       Da `zeroDay: 15`, y con la ruta vieja 16.
     - Preview demo: el primer 0 de la serie es el 2029-04-20.
  3. Invalidación:
     - `vitest src/lib/planSync.test.tsx` → `8 passed`, con `apiFetch` real, `QueryProvider` real y
       `useKxSummary` + `DebtCalendar` montados.
     - Pago (`POST /api/transactions`) → freedom-path se vuelve a pedir una vez y la celda de hoy pasa de ≈ $1000 a ≈ $900.
     - Lo mismo con:
       - el ataque (`POST /api/strategy/execute`);
       - la edición de cuenta (PUT);
       - el cashflow (DELETE);
       - la suscripción (PATCH).
     - Una lectura o un `PUT /api/house-goal` no provocan refetch.
     - Auditoría de la cadena: antes, solo pagos y ataques (vía `reload()`) y el escudo invalidaban `kx-summary`.
       No lo hacían:
       - el alta y la baja de cuentas (`useAccounts`, `AccountsPage`);
       - el cashflow (`CashflowManager`, `OnboardingWizard`);
       - las suscripciones;
       - el `% de ataque`.
       El calendario mostraba el dato viejo hasta 45 s. Ahora cualquier escritura nueva a esas rutas queda
       cubierta sin código a mano.
  4. Puerta compartida, sin migración:
     - `python scripts/verify.py` → `backend:pytest OK · backend:alembic-heads OK · frontend:vitest OK · frontend:eslint OK · frontend:build OK · verify: OK`.
     - `git diff --name-only origin/main...HEAD -- backend/alembic` → vacío.
     - `alembic heads` → `e5a9c3f1b7d2 (head)`, uno solo.
  5. Rendimiento (método de la casa):
     - Medición: token demo, `X-Process-Time`, mediana de 5 en caliente y de 21 en frío con la caché del
       simulador vaciada. Local, SQLite, copia de `korex.db`, persona María (30 meses).

     | Medida | Antes | Después | Δ |
     |---|---|---|---|
     | freedom-path en caliente (mediana) | 3.1 ms | 5.4–5.8 ms | +2.3–2.7 ms |
     | freedom-path en frío (mediana) | 3.6 ms | 5.9–6.7 ms | +2.3–3.1 ms |
     | Respuesta | 5.3 KB | 13.2 KB (168 puntos) | +7.9 KB |

     - Cumple el criterio por la rama de < 10 ms absolutos; en relativo es un +75 %.
     - Las SQL siguen siendo las mismas, y en producción domina la red: ~55 ms por SQL, según la misión 0.
       El extra de ~2.5 ms es CPU.
- **Checklist de auto-verificación:**
  - [x] Diff auto-revisado → `git diff --stat origin/main...HEAD`: `15 files changed, 577 insertions(+), 42 deletions(-)`
        (antes de este commit del Reporte).
  - [x] Archivos fuera de alcance = 0. `git diff --name-only origin/main...HEAD` da:
        - backend: `helpers.py`, `routers/strategy.py`, `tests/test_daily_series.py`, `velocity_engine.py`;
        - front: `components/kx/DebtCalendar.tsx` (solo comentario), `hooks/useKxSummary.ts`, `lib/api.ts`,
          `lib/calendarSeries(.test).ts`, `lib/planEvents.ts`, `lib/planSync(.test).ts(x)`, `providers/QueryProvider.tsx`;
        - `misiones/`.

        La misión permite motor, ruta freedom-path, `calendarSeries` y la cadena de invalidación.
  - [x] Migraciones: ninguna → diff de `backend/alembic` vacío, heads = 1.
  - [x] Sin `console.log`, secretos ni `any` nuevos. El grep da 1 línea, que es un falso positivo:
        `helpers.py: return lambda d: any(_item_triggers(it, d) for it in incomes)`, el `any()` de Python, no un tipo TS.
  - [x] Puerta compartida → `verify: OK`.
  - [x] Criterios uno a uno → sección anterior.
- **Desviaciones o dudas:**
  - **Eventos anteriores a hoy en el mes en curso.** El motor parte del saldo de hoy como inicio de mes. Un
    vencimiento ya pasado este mes se aplica hoy, no en su fecha. No se puede saber si ya está reflejado en el
    saldo, y aplicarlo en su fecha pintaría el pasado con un saldo que nunca existió. Hereda la convención del
    motor mensual; no cambia la convención.
  - **El ataque se reparte a partes iguales entre los cobros del mes**, no en proporción al monto de cada cobro.
    El motor mensual no sabe qué cobro financia el excedente. Es una estimación etiquetada como tal.
  - **Sin días de cobro registrados** (excedente por % de liquidez), el ataque cae a fin de mes. Es la opción
    conservadora: no adelanta crédito.
  - **El saldo inicial del calendario cambia de fuente.** Antes, el primer mes empezaba en `total_debt` del
    dashboard; ahora empieza en el total de la serie, el mismo que el timeline. Difieren solo si el límite del
    plan deja deudas fuera de la simulación, y en ese caso el calendario ya estaba en desacuerdo con su propio
    cierre de mes.
  - **Refetch doble.** `AttackPage` y `AccountsStagePage` siguen llamando a `reload()` tras su POST. La segunda
    invalidación cancela la primera petición en vuelo, así que no se duplica el dato, solo una petición cancelada.
  - **Conflicto de texto previsible.** `misiones/cola.md` en `main` aún muestra la misión 4 `pendiente`; la PR #7
    la marca `en-auditoria`. Si se fusionan las dos, hay un conflicto trivial en esa tabla.
