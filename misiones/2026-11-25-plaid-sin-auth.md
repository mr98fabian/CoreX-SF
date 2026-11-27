# Misión 20: Fix de seguridad — apagar Plaid en producción (H-01 de la Misión 15)
- **ID:** 2026-11-25-plaid-sin-auth
- **Estado:** en-curso
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
_pendiente_
