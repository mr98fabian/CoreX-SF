# Misión: Command-center rápido + caché stale-while-revalidate
- **ID:** 2026-11-22-command-center-cache
- **Estado:** en-auditoria
- **Rama:** perf/command-center-cache
- **Repo:** CoreX-SF

## Objetivo
`GET /api/strategy/command-center` deja de repetir consultas (mismo contrato, mismos valores) y el
Plan de ataque (AttackPage) lo lee de React Query: al volver, pinta la caché al instante y refresca por
detrás; toda escritura del plan la invalida por el mecanismo ya existente (`lib/planEvents` +
`lib/planSync.PLAN_QUERY_KEYS`), sin una invalidación paralela.

## Contexto
- Mijo midió ~867 ms de servidor en producción (2026-11-22). Línea base local con el método de la
  Misión 0 (token demo, María, 55 ms inyectados por sentencia SQL, mediana de 5 de `X-Process-Time`):
  **11 sentencias, 624 ms** (15 ms sin latencia: el cómputo no domina, dominan los viajes a la DB).
- Las 11 sentencias (con su origen): `accounts`; `user_settings` ×2 (`get_shield_target`,
  `get_attack_percentage`); `cut_history` (misión); `cashflow_items` + `recurring_subscriptions` ×3
  (`dated_cashflow`, `get_cashflow_surplus`, `get_cashflow_breakdown`); `movement_log`.
- AttackPage hoy: `useState` + `apiFetch` manual en `useEffect`, sin caché; tras atacar llama `fetchCc()`.

## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | Contrato idéntico: misma respuesta, campo a campo, que la composición original | `pytest tests/test_command_center_perf.py::test_same_response_as_original` — la composición previa (copiada tal cual en el test, sobre los mismos helpers) contra el endpoint, para varios usuarios: María (demo), sin deudas, deudas sin cashflow, escudo bajo, varias deudas con cortes | passed; además `diff` del JSON antes/después de la persona demo en el Reporte = vacío |
| 2 | El endpoint no repite consultas | `pytest tests/test_command_center_perf.py::test_sql_statements` | ≤ 6 sentencias (antes 11); cada tabla se lee una vez |
| 3 | Tiempo de servidor antes/después | Método de la Misión 0 (arriba), mismo script antes y después | tabla en el Reporte; baja proporcional a las sentencias quitadas |
| 4 | AttackPage con React Query: al volver pinta la caché al instante y refresca por detrás | `vitest src/features/attack/attackCache.test.tsx -t "paints the cached plan"` — 2º montaje: el plan aparece en el primer render (sin esperar a la red) y se pide de nuevo en segundo plano | passed |
| 5 | Una escritura del plan invalida la query (sin mecanismo paralelo) | `vitest attackCache.test.tsx -t "plan write"`: `POST /api/transactions`, `POST /api/strategy/execute`, `PUT /api/accounts/:id` → command-center se vuelve a pedir y la pantalla muestra el número nuevo; la clave está en `PLAN_QUERY_KEYS` y no hay `invalidateQueries` propio de command-center | passed; `git grep -n "command-center" frontend/src` solo en `planSync.ts`, el hook y su test |
| 6 | Inventario de pantallas con fetch manual (reportar, no migrar) | `git grep` de `useEffect` + `apiFetch` sin `useQuery`, listado en el Reporte | lista con archivo y endpoint |
| 7 | Puerta compartida, sin migración | `python scripts/verify.py`; `git diff --name-only origin/main...HEAD -- backend/alembic` | `verify: OK`; vacío |

## Pasos
1. Backend: `user_settings` una vez (escudo + % de ataque); `load_cashflow_inputs` una vez, pasado
   explícitamente a `dated_cashflow`, `get_cashflow_breakdown` (de donde sale también el excedente).
   Sin caché implícita en la sesión: los datos viajan como parámetro opcional.
2. Front: hook `useCommandCenter` (React Query, clave `command-center` + usuario, staleTime 45 s como
   `kx-summary`); la clave entra en `PLAN_QUERY_KEYS`.
3. Medir, inventariar, reportar.

## No tocar
- Contrato ni valores de command-center; motor financiero; copy; billing; RLS.
- Las demás pantallas con fetch manual (solo se reportan).

## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-23
- **Rama y commit:** `perf/command-center-cache`, base main baffb64:
  - d3a3d7e: criterios;
  - 10c76f6: código y tests.
- **Qué cambió:**
  - **Backend.** `helpers.get_plan_settings` devuelve escudo y % de ataque leyendo `user_settings` una vez.
    `dated_cashflow` y `get_cashflow_breakdown` aceptan `data=` (un `load_cashflow_inputs` ya cargado),
    y el endpoint lo carga una vez y se lo pasa. El excedente sale del breakdown, que es la misma
    función con las mismas tuplas que `get_cashflow_surplus`. Es todo explícito, sin caché oculta en la
    sesión, así que ninguna escritura en la misma petición puede leer un dato viejo. El motor no se tocó.
  - **Front.**
    - `hooks/useCommandCenter` usa React Query con la clave `['command-center', usuario]` y staleTime de 45 s.
    - `COMMAND_CENTER_KEY` entra en `lib/planSync.PLAN_QUERY_KEYS`.
    - AttackPage pierde el `useState` + `useEffect` y el `fetchCc()` tras confirmar: el `POST /api/strategy/execute`
      es una escritura del plan, así que la cadena existente lo invalida. El botón «Reintentar» usa `s.reload()`,
      que es el mismo conjunto de claves.
- **Evidencia de los criterios de aceptación:**
  1. Contrato idéntico:
     - `pytest tests/test_command_center_perf.py` da `7 passed`.
     - `test_same_response_as_original` compara para 5 usuarios: María, el dataset de estrés, sin deudas,
       deudas sin cashflow, y escudo bajo con cortes, pagos tras el corte, suscripción, racha y APY.
       La referencia es `_original`, el cuerpo previo del endpoint copiado tal cual (extraído con `ast`)
       sobre los mismos helpers.
     - El test se corrió antes del refactor: verde en los 5, y el test de SQL en rojo, lo que demuestra que
       mide algo real.
     - Antes y después, con la persona demo y el mismo script, el `diff` del JSON da vacío.
  2. Sin consultas repetidas:
     - Con `test_sql_statements`, ninguna tabla se lee dos veces.
     - Para María (demo) quedan **11 → 6** sentencias: `accounts`, `user_settings`, `cut_history`,
       `cashflow_items`, `recurring_subscriptions`, `movement_log`.
     - Es **7** cuando alguna deuda tiene un corte registrado, porque se lee `transactions` para los pagos desde el corte.
       Ver Desviaciones.
  3. Tiempo de servidor:
     - Método de la Misión 0: local, persona María, mediana de 5 de `X-Process-Time`, caché del simulador vaciada en cada corrida.

       | Medida | Antes | Después |
       |---|---|---|
       | Sentencias SQL | 11 | 6 |
       | Servidor con 55 ms/SQL (≈ producción) | 624 ms | **345 ms** (−45 %) |
       | Servidor sin latencia (cómputo) | 15.2 ms | 13.4 ms |

     - Estimación para producción: si allí manda el viaje por sentencia, quitar 5 viajes de ~55 ms deja los
       ~867 ms medidos por Mijo en unos ~590 ms. No está medido en producción; queda pendiente del deploy,
       con el mismo método.
  4. Caché al volver:
     - `vitest attackCache.test.tsx -t "paints the cached plan"` pasa, con `apiFetch` y `QueryProvider` reales.
       - En el primer render de la segunda visita ya está el plan ($500) y no hay petición.
       - Pasados 45 s, el primer render sigue pintando la caché, la petición sale por detrás y la pantalla pasa a $450.
     - En el preview (demo), al volver al Plan dentro de 45 s no hubo shimmer ni petición nueva de command-center:
       2 antes y 2 después. Pasados 45 s se volvió a pedir por detrás: de 1 a 2.
  5. Invalidación por la cadena existente:
     - `vitest attackCache.test.tsx -t "plan write"` da 3 passed. Un pago (`POST /api/transactions`), un ataque
       (`POST /api/strategy/execute`) o una edición de deuda (`PUT /api/accounts/3`) vuelven a pedir command-center
       una vez, y la pantalla muestra el número nuevo.
     - `PLAN_QUERY_KEYS` contiene `command-center`.
     - `git grep -n "command-center" frontend/src`, sin contar tests, solo devuelve comentarios
       (`MissionCard.tsx`, `AttackPage.tsx`) y la clave en `planSync.ts`. No hay ningún `invalidateQueries`
       propio de command-center.
     - Mutaciones que invalidan la caché: toda escritura con `apiFetch` a `PLAN_WRITE`, es decir:
       - `/api/accounts…`, `/api/transactions…`, `/api/cashflow…`, `/api/subscriptions…`;
       - `/api/strategy/execute`, `/api/user/me/attack-percentage`, `/api/user/me/shield`;
       - las semillas demo y `plaid`.
  6. Pantallas que siguen con fetch manual (`useEffect` + `apiFetch`, sin `useQuery`). Solo se reportan, no se migran:

     | Archivo | Endpoints que lee |
     |---|---|
     | `features/actionplan/ActionPlanPage.tsx` (simulación completa) | `/api/strategy/tactical-gps`, `/api/accounts`, `/api/transactions/all` |
     | `features/accounts/AccountsPage.tsx` (cuentas, vista completa) | `/api/accounts`, `/api/accounts/:id/transactions` |
     | `features/analytics/AnalyticsPage.tsx` | `/api/analytics/v2` |
     | `features/accounts/hooks/useCashflowStats.ts` | `/api/cashflow` |
     | `features/settings/SettingsPage.tsx` | `/api/accounts`, `/api/debts`, `/api/transactions/recent`, `/api/subscriptions/savings-estimate` |
     | `components/OnboardingWizard.tsx` | `/api/accounts`, `/api/cashflow`, `/api/velocity/projections` |
     | `features/settings/MyAccountPage.tsx`, `PlansPage.tsx` | `/api/user/me`, `/api/subscriptions/status` |
     | `components/ConnectAI.tsx`, `features/oauth/ConsentPage.tsx`, `features/settings/OwnerCodesPanel.tsx` | tokens, OAuth, códigos (no son del plan) |
     | `components/EmailToggleRow.tsx`, `PushToggleRow.tsx`, `hooks/useOnboarding.ts` | preferencias (no son del plan) |

     Las cuatro primeras muestran números del plan. Son las candidatas si se quiere la misma garantía de frescura.
  7. Puerta compartida, sin migración:
     - `python scripts/verify.py` da:
       `backend:pytest OK · backend:alembic-heads OK · frontend:vitest OK · frontend:eslint OK · frontend:build OK · verify: OK`.
     - `git diff --name-only origin/main...HEAD -- backend/alembic` sale vacío.
- **Checklist de auto-verificación:**
  - [x] Diff auto-revisado: `git diff --stat origin/main...HEAD` da `12 files changed, 512 insertions(+), 38 deletions(-)`
        (sin contar este Reporte).
  - [x] Archivos fuera de alcance = 0. La lista es:
        - backend: `helpers.py`, `routers/strategy.py`, `tests/test_command_center_perf.py`;
        - front: `hooks/useCommandCenter.ts`, `lib/planSync.ts`, `features/attack/AttackPage.tsx`,
          `features/attack/attackCache.test.tsx`;
        - los 3 tests que montan AttackPage (`AttackPage.test.tsx`, `subsEatSurplus.test.tsx`,
          `components/kx/MissionCard.test.tsx`): solo se envolvieron en `QueryClientProvider`, con las mismas aserciones;
        - `misiones/`.
  - [x] Migraciones: ninguna. El diff de `backend/alembic` sale vacío.
  - [x] Sin `console.log`, secretos ni `any` nuevos. El grep del checklist sale vacío (exit 1).
  - [x] Puerta compartida: `verify: OK`.
  - [x] Criterios uno a uno: ver la sección anterior.
- **Desviaciones o dudas:**
  - **Criterio 2: 7 sentencias, no 6, cuando hay un corte registrado.** `transactions` (los pagos desde el
    corte) solo se lee en ese caso, y se lee una vez. La regla real que fija el test es «cada tabla una vez»;
    el tope es 6 para María y 7 con corte. Bajar de ahí exigiría unir tablas distintas en una sola consulta.
    Eso cambiaría los helpers compartidos por el dashboard y el calendario, y se deja fuera de alcance.
  - **Lo que no se tocó.** La consulta del plan en `effective_plan_limit` (`subscriptions`, `access_grants`)
    es una dependencia compartida por todos los endpoints con límite de plan, así que queda fuera. En
    producción sigue sumando sus viajes.
  - **Nota de frescura.** Una mutación hecha con `fetch` directo, fuera de `apiFetch`, no invalida nada. Hoy
    todas las escrituras del plan pasan por `apiFetch`, según el inventario de la Misión 5.
