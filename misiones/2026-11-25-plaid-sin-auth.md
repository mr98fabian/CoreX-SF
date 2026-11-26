# Misión 20: Fix de seguridad — apagar Plaid en producción (H-01 de la Misión 15)
- **ID:** 2026-11-25-plaid-sin-auth
- **Estado:** pendiente
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

## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba | Resultado esperado |
|---|----------|-------------------|--------------------|
| 1 | Sin `PLAID_ENABLED`, toda ruta `/api/plaid/*` responde 404 | test pytest nuevo | passed |
| 2 | Con `PLAID_ENABLED`, todas exigen sesión (sin token = 401) | test pytest nuevo | passed |
| 3 | No existe estado de Plaid global entre usuarios | `grep -n "plaid_tokens" backend` | 0 coincidencias |
| 4 | Guarda de regresión: toda ruta del API exige auth salvo lista blanca explícita (public, oauth, webhooks, health) | test pytest que recorre `app.routes` | passed |
| 5 | Producción tras el deploy | `curl -s -o /dev/null -w "%{http_code}" https://corex-sf-production.up.railway.app/api/plaid/create_link_token` | `404` |
| 6 | Variables `PLAID_*` retiradas de Railway (Fabian) | listado por nombre | ausentes |
| 7 | Puerta compartida | `python scripts/verify.py` | `verify: OK` |

## No tocar
- El resto del router de transacciones. El frontend (no usa Plaid).

## Reporte (lo llena Claude al ejecutar)
_pendiente_
