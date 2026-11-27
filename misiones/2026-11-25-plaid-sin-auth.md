# Misión 20: Fix de seguridad — apagar Plaid en producción (H-01 de la Misión 15)
- **ID:** 2026-11-25-plaid-sin-auth
- **Estado:** en-auditoria
- **Rama:** fix/plaid-sin-auth
- **Repo:** CoreX-SF
- **Prioridad:** por delante de cualquier feature (hallazgo ALTO de la auditoría pre-lanzamiento)

## Objetivo
Que ninguna ruta `/api/plaid/*` sea alcanzable en producción mientras Plaid no esté en uso, y que nunca
más exista un access token de Plaid compartido entre usuarios.

## Contexto
- Hallazgo H-01 (`misiones/2026-11-25-auditoria-seguridad.md`): `create_link_token`, `exchange_public_token`
  y `GET /api/plaid/accounts` no exigen sesión; el token de Plaid vive en `plaid_tokens["current"]`
  (dict global en memoria, `backend/routers/transactions.py`), así que `import_accounts` y
  `sync_transactions` de cualquier usuario usan el banco del último que enlazó.
- Producción emite hoy `link_token` de Sandbox sin auth. El SPA no usa estas rutas.

## Diseño (decidido al ejecutar, 2026-11-27)
- Fail-closed por **ausencia**: las 5 rutas `/api/plaid/*` se retiran del router → 404 con o sin sesión.
- Interruptor explícito en el código (`PLAID_IN_APP_ENABLED = False` en `routers/transactions.py`), no
  variable de entorno. Ponerlo en `True` revienta el arranque: reactivar Plaid exige almacenamiento de
  tokens por usuario (S-05) y el sí de Fabian.
- `plaid_tokens` desaparece. `plaid_service.py` queda intacto.
- Cambio frente a la versión anterior de esta tabla: se sustituye `PLAID_ENABLED` (variable de entorno)
  por el interruptor en código, y el criterio «retirar `PLAID_*` de Railway» sale del alcance (orden de
  Mijo 2026-11-26: no rotar ni borrar variables; solo se listan por nombre en el Reporte).

## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba | Resultado esperado |
|---|----------|-------------------|--------------------|
| 1 | Sin login, las 5 rutas `/api/plaid/*` no devuelven datos | `pytest tests/test_plaid_disabled.py -k anonymous` + sonda local (`curl` a 8001) | 5 × `404`, cero cuerpos con `accounts`/`link_token` |
| 2 | Con login de A, imposible leer o importar cuentas de B | `pytest tests/test_plaid_disabled.py -k cross_user` (B enlaza, A pide accounts/import) | `404`; A sigue sin cuentas Plaid |
| 3 | Ninguna ruta `/plaid` montada en la app | `pytest tests/test_plaid_disabled.py -k no_plaid_routes` (recorre `app.routes`) | passed |
| 4 | El interruptor no se puede encender a medias | `pytest tests/test_plaid_disabled.py -k switch` | `PLAID_IN_APP_ENABLED is False` |
| 5 | Sin token global | `rg "plaid_tokens" backend/` | 0 resultados |
| 6 | Ninguna pantalla llama a `/plaid/*` | `rg -n "/plaid" frontend/src` | solo la regex `PLAN_WRITE` de `lib/planEvents.ts` (no es una llamada) |
| 7 | Puerta compartida (pytest, alembic heads == 1, vitest, eslint, build) | `python scripts/verify.py` | `verify: OK` |
| 8 | CI del PR en verde | checks `backend` y `frontend` | success |
| 9 | Producción tras el deploy (lo corre Mijo/Fabian tras el merge) | `curl -s -o /dev/null -w "%{http_code}" https://corex-sf-production.up.railway.app/api/plaid/create_link_token` | `404` |

Evidencia en `misiones/evidencia/20/`.

## No tocar
- El resto del router de transacciones, cuentas, deudas, el frontend, `plaid_service.py`.
- Variables y credenciales de Railway. Medias y bajas de la Misión 15.
- Límite duro: nada de tokens por usuario, Plaid Link ni persistencia de `access_token` (S-05).

## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-27
- **Rama y commit:** `fix/plaid-sin-auth` · criterios `af10db3` · fix `40abd77` (+ este commit de reporte)

**Resultado:** H-01 cerrado en código. Las 5 rutas `/api/plaid/*` ya no existen (404 con o sin
sesión) y el token global `plaid_tokens` desapareció. Ningún token de banco vive en memoria
compartida. Interruptor `PLAID_IN_APP_ENABLED = False` en `backend/routers/transactions.py`: si alguien
lo pone en `True`, el backend no arranca (`RuntimeError`), porque reactivar Plaid exige la S-05.

**Diseño del cierre:** 404 por ausencia (no 401/403). Motivo: una ruta que no existe no puede filtrar
nada aunque falle la auth, y no revela que Plaid estuvo ahí. `plaid_service.py` intacto. Se quitaron
4 imports que solo usaba el código de Plaid (`logging`, `date/timedelta`, `MovementLog`,
`classify_transaction`); el resto de `transactions.py` no cambia.

**Evidencia de los criterios** (`misiones/evidencia/20/`):
1. Sin login → `sonda-local.txt`: las 5 rutas, `[anon]` y `[demo]`, `{"detail":"Not Found"} | HTTP 404`;
   control `GET /api/accounts [demo]` → 200. Test `test_anonymous_plaid_routes_are_closed` ×5 → PASSED.
2. A no lee a B → `test_cross_user_cannot_read_or_import_other_users_bank` PASSED: B intenta enlazar,
   A pide `accounts` e `import_accounts` → 404, Plaid (falso) nunca se llama y A no tiene la cuenta de B.
   **Contraprueba** (`pytest-main-antes.txt`): los mismos 8 tests contra `origin/main` → `8 failed`; ahí
   `GET /api/plaid/accounts` sin login devolvía 200 con la cuenta de B.
3. `test_no_plaid_routes_are_mounted` PASSED (recorre `app.routes`).
4. `test_switch_is_off_and_no_global_token_state` PASSED (el módulo solo expone `PLAID_IN_APP_ENABLED`).
5. `rg "plaid_tokens" backend/` → 0 resultados (`rg.txt`).
6. `rg -n "/plaid|plaid/" frontend/src` → ninguna pantalla llama a Plaid; solo la regex `PLAN_WRITE` de
   `lib/planEvents.ts` y su test `planSync.test.tsx` (clasifican rutas, no llaman). Se dejan: la regex
   queda huérfana pero inocua, y quitarla obliga a tocar su test (fuera de alcance).
7. `python scripts/verify.py --force` → `verify: OK` (`verify.txt`): pytest 725 passed, alembic 1 head
   (`a7d4e2c9f1b3`, sin migración nueva), vitest, eslint y build OK.
8. CI del PR: ver checks `backend` y `frontend` del PR.
9. Producción: pendiente del merge y deploy; lo corre Mijo/Fabian (`curl … /api/plaid/create_link_token` → `404`).

**Variables `PLAID_*` que lee el código** (solo nombres, no se rotó ni borró nada):
`PLAID_CLIENT_ID`, `PLAID_SECRET` (ambas en `plaid_service.py`). Hoy nada en la app las usa; si Fabian
quiere retirarlas de Railway, es decisión suya aparte.

**Checklist de auto-verificación:**
- [x] Diff → `git diff --stat origin/main...HEAD`: `transactions.py | 145 +++---…`, `tests/test_plaid_disabled.py | 78 +`,
      archivo de misión, `cola.md`, `misiones/evidencia/20/*`.
- [x] Fuera de alcance = 0: solo `backend/routers/transactions.py`, el test nuevo y `misiones/`.
- [x] Migraciones: ninguna; `alembic heads` = 1.
- [x] Sin `console.log`, secretos ni `any` nuevos → el grep de la plantilla sale vacío (exit 1).
- [x] Puerta compartida → `verify: OK`.
- [x] Criterios uno a uno → arriba.

**Desviaciones o dudas:** se cambió el diseño original de esta tabla (`PLAID_ENABLED` por variable de
entorno → interruptor en código; criterio «retirar `PLAID_*` de Railway» fuera de alcance), siguiendo
la orden de Mijo del 2026-11-26. Ninguna necesidad de S-05 apareció.
**Fallos preexistentes:** ninguno.
