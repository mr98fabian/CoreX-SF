# Misión: Command-center rápido + caché stale-while-revalidate
- **ID:** 2026-11-22-command-center-cache
- **Estado:** en-curso
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
