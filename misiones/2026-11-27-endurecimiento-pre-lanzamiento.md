# Misión 21: Endurecimiento pre-lanzamiento (H-02, H-05, H-06)
- **ID:** 2026-11-27-endurecimiento-pre-lanzamiento
- **Estado:** en-curso
- **Rama:** fix/endurecimiento-pre-lanzamiento (desde origin/main a110ae9)
- **Repo:** CoreX-SF

## Objetivo
Cerrar tres hallazgos medios de la auditoría de la Misión 15 (`misiones/2026-11-25-auditoria-seguridad.md`)
antes del lanzamiento: rate limits que hoy son globales (H-02), dependencias del backend con avisos (H-05)
y la web sin CSP ni protección anti-clickjacking (H-06).

## Contexto
Decisión de Fabian (2026-11-27): antes del lanzamiento se arreglan H-02, H-04, H-05, H-06, H-07, H-08, H-12
y H-13; H-03, H-09, H-10, H-11 y H-14 quedan como riesgo aceptado hasta enero. Esta misión cubre SOLO
H-02, H-05 y H-06. PR obligatorio; sin merge sin orden de Fabian; la rama no se borra.

## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | H-02a: dos usuarios distintos no comparten cubo | `pytest tests/test_rate_limit_keys.py -k users` | passed |
| 2 | H-02b: una IP que agota su cupo de `/api/codes/redeem` no bloquea a otra IP ni a otro usuario | `pytest tests/test_rate_limit_keys.py -k redeem` | passed |
| 3 | H-02c: un `X-Forwarded-For` forjado desde una IP no confiable se ignora; desde un proxy de confianza se toma el primer salto no confiable por la derecha | `pytest tests/test_rate_limit_keys.py -k forwarded` | passed |
| 4 | H-02: `SlowAPIMiddleware` instalado y `default_limits` aplica a rutas sin límite propio (webhooks y `/health` exentos) | `pytest tests/test_rate_limit_keys.py -k default` | passed |
| 5 | Contraprueba H-02: los tests nuevos fallan contra `main` | correr el archivo de tests en un worktree de `origin/main` → `misiones/evidencia/21/contraprueba-main.txt` | failed (≥ 1 por cada criterio 1–4) |
| 6 | H-05: `pyjwt` ≥ 2.15, `python-multipart` ≥ 0.0.31, `fastapi`/`starlette` ≥ 1.3.1 (o motivo documentado si una no sube) | `pip-audit -r backend/requirements.txt` → `misiones/evidencia/21/pip-audit.txt` | 0 avisos para esas tres |
| 7 | H-06: `vercel.json` sirve `Content-Security-Policy` con `frame-ancestors 'none'` y `X-Frame-Options: DENY` en todas las rutas | test de guarda sobre `vercel.json` + tras el deploy `curl -sI https://korexf.com` → `misiones/evidencia/21/headers.txt` | ambos headers presentes |
| 8 | H-06: la CSP no rompe la app: login, checkout de Stripe y `/oauth/consent` sin violaciones de CSP | build servido localmente con la misma CSP, consola sin `Refused to …` → `misiones/evidencia/21/csp-prueba.md` | 0 violaciones |
| 9 | Puerta compartida en verde | `python scripts/verify.py` → `misiones/evidencia/21/verify.txt` | `verify: OK` (exit 0) |
| 10 | Sin migraciones nuevas: un solo head | `cd backend && python -m alembic heads` | exactamente 1 `(head)` |

## Pasos
1. H-02: limitador único (`backend/rate_limit.py`) con clave usuario-o-IP real; `SlowAPIMiddleware`; tests.
2. H-05: subir dependencias en `backend/requirements.txt`, suite completa y `pip-audit`.
3. H-06: `headers` en `vercel.json`; probar la CSP con el build local.
4. Puerta compartida, evidencia y reporte.

## No tocar
- H-03, H-09, H-10, H-11, H-14; H-04 y H-12 (van en el build 1.0.9).
- Plaid, Railway (configuración/panel), Play. Nada del frontend salvo `vercel.json`.
- No crear cuentas, no rotar secretos, no tocar dinero real.

## Reporte (lo llena Claude al ejecutar)
_pendiente_
