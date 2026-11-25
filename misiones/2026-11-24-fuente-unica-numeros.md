# Misión 17: Construcción de la fuente única de números (corrección de la Misión 14)
- **ID:** 2026-11-24-fuente-unica-numeros
- **Estado:** en-curso
- **Rama:** feat/fuente-unica-numeros
- **Repo:** CoreX-SF

## Objetivo
Que dos pantallas no puedan volver a contradecirse: un solo motor de proyección (`debt_path`), una
función dueña por concepto y tests de concordancia en CI. Fuente de verdad: los entregables de la
Misión 14 (`misiones/2026-11-24-auditoria-numeros/`, PR #13); si esta misión los contradice, mandan ellos.

## Contexto — decisiones de Fabian (2026-11-24, reglas de la casa)
- **D1:** una obligación «falta» solo si la caja proyectada en su fecha (ingresos y gastos fechados,
  escudo intacto) no la cubre.
- **D2:** corte a $0 solo cuando la caja proyectada lo cubre; si no, mínimo + avalancha, dicho en pantalla.
- **D3:** «Disponible para tu plan» = `get_daily_mission()["ataque"]`; el efectivo se muestra aparte.
- **D4:** fecha de libertad y plan desde la caja real fechada (`debt_path`); prohibido el excedente
  promedio desde el día 1 del mes en curso.

## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | Tests de concordancia §4 (personas fijas, `today` fijo, vía HTTP) | `cd backend && ./venv/Scripts/python.exe -m pytest tests/test_concordancia.py -v` | todos `passed`; en `main` nacen en rojo (salida pegada en el Reporte) |
| 2 | Caso #1: el Calendario ya no promete la baja fantasma | `pytest tests/test_concordancia.py -k caso_real` | cierre de nov = deuda de hoy − pagos fechados del GPS + interés diario acumulado (±$0.01); bajas ≠ 7,667.78 |
| 3 | La demo de María se concilia sola | `pytest tests/test_concordancia.py -k maria` | reserva < deuda total; GPS sin caja bajo el escudo por obligaciones; `plan.meses` = meses calendario |
| 4 | Ninguna pantalla de la tabla §3 calcula dinero por su cuenta | `cd frontend && npx vitest run src/lib/fuenteUnica.test.ts` | `passed` (sin `* 30`, `* 365`, `/ 365`, `start - end` en esos archivos) |
| 5 | Endpoints huérfanos N-15 retirados | `pytest tests/test_concordancia.py -k huerfanos` | 404 en `/api/cashflow/projection`, `/api/notifications/summary`, `/api/notifications/upcoming`; una sola ruta `/api/cashflow/summary` |
| 6 | Suites y puerta compartida en verde | `python scripts/verify.py` | `verify: OK` (exit 0) |
| 7 | Sin migraciones nuevas | `cd backend && python -m alembic heads` + `git diff --name-only origin/main...HEAD` | 1 head, ningún archivo en `backend/alembic/versions/` |

## Pasos
1. `test_concordancia.py` en rojo.
2. Motor: `debt_path`, D1/D2 en la misión, mínimo único, interés en el tramo de caja.
3. Rewire de endpoints (freedom-path, compare, projections, tactical-gps, command-center, coach,
   dashboard, push) a las funciones dueñas.
4. Frontend: rótulos honestos y pantallas de §3 sin aritmética propia.
5. Endpoints huérfanos.

## No tocar
- Avalancha estricta, escudo y reglas de la casa fuera de D1–D4.
- Contratos fuera de los que marca la especificación.

## Reporte (lo llena Claude al ejecutar)
_Pendiente._
