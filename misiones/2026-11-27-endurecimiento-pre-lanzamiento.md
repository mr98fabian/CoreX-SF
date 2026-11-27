# Misión 21: Endurecimiento pre-lanzamiento (H-02, H-05, H-06)
- **ID:** 2026-11-27-endurecimiento-pre-lanzamiento
- **Estado:** en-auditoria
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
- **Fecha:** 2026-11-27
- **Rama y commit:** `fix/endurecimiento-pre-lanzamiento`. Commits: afa39f3 (criterios), f8e0aef (H-02), 3836aee (H-05), cdbcf9d (H-06) y el commit de este reporte.

### Qué cambió en cada hallazgo
**H-02: rate limits.**
- La app tiene ahora un solo limitador, en `backend/rate_limit.py`, y lo comparten `main.py`, `codes` y `oauth`.
- Clave del cubo: el hash del bearer cuando existe (sesión o token `kx_`). Si no hay bearer, la IP real del cliente.
- El token demo lo comparten todos los visitantes, así que se cuenta por IP.
- IP real: se toma `X-Forwarded-For` solo si el peer TCP es un proxy de confianza (`TRUSTED_PROXY_CIDRS`; por defecto, loopback y rangos privados/CGNAT, que es por donde entra el edge de Railway). La cadena se lee de derecha a izquierda y gana el primer salto que no es de confianza. Lo que forje el cliente queda a la izquierda y no se elige nunca. Si el peer no es de confianza, la cabecera se ignora.
- `/api/codes/redeem`: 5/min por sesión. Se quitó el cubo por IP: tras el rewrite de Vercel, la IP vista es la de salida de Vercel, compartida por muchos usuarios, y era justo el cubo global que pedía arreglar el hallazgo.
- `/oauth/*`: los mismos cupos que antes (10, 30 y 60/min), ahora por IP real.
- `default_limits` ya se aplica: **120/min** por usuario o IP (`RATE_LIMIT_DEFAULT`). El valor de 60/min que había en el código nunca llegó a aplicarse, y con un cubo por usuario real podía cortar a alguien que navega rápido. Quedan exentos `/health` y los webhooks de Stripe y Google (llegan en ráfagas desde pocas IPs; los protege su firma). `/mcp` sigue con su límite por token en `api_tokens`.
- **Desviación: no se usa `SlowAPIMiddleware` tal cual.** Desde FastAPI 0.137, `include_router` anida los routers (`_IncludedRouter`). La búsqueda de ruta del middleware no encuentra el handler y exenta todas las rutas sin avisar: con la subida de H-05, el test del límite por defecto falló por eso. Se aplica lo mismo como dependencia global de la app (`enforce_default_limit`), que corre después del enrutado y usa el `_check_request_limit` de slowapi.

**H-05: dependencias.**
- `PyJWT[crypto]` 2.11.0 → 2.15.1, `python-multipart` 0.0.22 → 0.0.34 y `fastapi` 0.128.5 → 0.165.0.
- `starlette` 0.52.1 → 1.10.0. Ahora está fijada explícitamente; antes entraba como dependencia de fastapi.
- La subida de FastAPI rompió dos tests que buscaban rutas en `app.routes`. Uno, `test_no_plaid_routes_are_mounted`, habría pasado en vacío. Ahora usan `tests/route_list.py` (aplana los routers) y comprueban que ven más de 50 rutas.
- `slowapi` se queda en 0.1.9: la 0.1.10 no cambia nada de esto.

**H-06: CSP y X-Frame-Options.**
- `vercel.json` añade, para `/(.*)`, `Content-Security-Policy` (con `frame-ancestors 'none'`) y `X-Frame-Options: DENY`.
- `script-src` permite solo `'self'` más el hash del script inline de `index.html`: sin `'unsafe-inline'` ni `'unsafe-eval'`.
- El test `test_vercel_headers.py` rompe si alguien edita ese script sin actualizar el hash.
- Detalle de los orígenes y de la prueba: `misiones/evidencia/21/csp-prueba.md`.

### Qué quedó igual y por qué
- `Procfile` y Railway sin tocar. La IP real se resuelve en código, así que no hace falta `--forwarded-allow-ips`.
- Los headers que el backend ya enviaba en sus respuestas de API no cambian.
- `python-dotenv` 1.2.1 (PYSEC-2026-2270) y `pytest` 8.3.5 (PYSEC-2026-1845) siguen con avisos en pip-audit. Están fuera del alcance de H-05 y quedan para otra misión si Fabian quiere.
- **Riesgo residual de H-02.** Las peticiones web **sin sesión** que pasan por el rewrite de Vercel (`/api/*` público) se cuentan por la IP de salida de Vercel, no por la del cliente: Vercel no publica sus IPs de salida y por eso no está en `TRUSTED_PROXY_CIDRS`. Con 120/min el impacto es bajo, y todo lo autenticado va por usuario.
- Que el peer de Railway caiga en rango privado no se ha probado contra producción. Con la primera petición que llega desde un proxy de confianza, el proceso escribe una línea `rate-limit: peer … is a trusted proxy; X-Forwarded-For has N hop(s)`. Si en los logs de Railway no aparece, el peer es público: hay que añadir su rango a `TRUSTED_PROXY_CIDRS`. Mientras tanto, el comportamiento queda como hoy (por IP del edge), sin empeorar.

### Evidencia de los criterios de aceptación
1. Usuarios con cubo propio → `test_users_do_not_share_bucket_on_redeem`: passed (dentro de los 735 de la suite, `verify.txt`).
2. Una IP no agota el cubo global → `test_one_ip_does_not_exhaust_redeem_for_everyone` y `test_one_ip_does_not_exhaust_oauth_register_for_everyone`: passed.
3. XFF forjado → `test_forwarded_header_from_untrusted_peer_is_ignored` y `test_forwarded_forged_left_part_is_ignored_behind_trusted_proxy`: passed.
4. Límite por defecto → `test_default_limit_applies_to_routes_without_their_own` (la petición 121 da 429 y otra IP sigue en 200) y `test_default_limit_exempts_health_and_webhooks`: passed.
5. Contraprueba → `misiones/evidencia/21/contraprueba-main.txt`: en main, **5 failed y 2 passed**. Los 2 que pasan cubren lo que main ya hacía (ignorar XFF de un peer externo; en webhooks no hay 429 porque no hay límite global). Cada criterio 1–4 tiene al menos un test que falla en main.
6. pip-audit → `misiones/evidencia/21/pip-audit.txt`: 0 avisos para pyjwt, python-multipart, fastapi y starlette. Versiones instaladas en `pytest-deps-nuevas.txt`.
7. Headers en `vercel.json` → `test_vercel_headers.py` (3 passed). **El `curl -sI https://korexf.com` de producción queda pendiente del deploy, tras el merge.** Lo verifica Mijo y va a `misiones/evidencia/21/headers.txt`.
8. La CSP no rompe la app → `misiones/evidencia/21/csp-prueba.md`: login demo, 6 pantallas, checkout (POST + redirección a Stripe) y `/oauth/consent`. Encontró 1 violación (`korexf.com/apk.json`), corregida; después, 0.
9. Puerta compartida → `misiones/evidencia/21/verify.txt`: `verify: OK`, exit 0. Corrió con un venv del worktree instalado desde el `requirements.txt` nuevo (fastapi 0.165.0 / starlette 1.10.0).
10. Migraciones → sin migraciones en el diff; `alembic heads` → `a7d4e2c9f1b3 (head)`, uno solo.

### Checklist de auto-verificación
- [x] Diff auto-revisado → `git diff --stat origin/main...HEAD`: `20 files changed, 425 insertions(+), 26 deletions(-)` (antes de este commit de reporte).
- [x] Archivos fuera de alcance = 0 → `backend/{main.py,rate_limit.py,requirements.txt}`, `backend/routers/{codes,oauth,subscriptions,google_play}.py`, `backend/tests/{conftest,route_list,test_concordancia,test_plaid_disabled,test_rate_limit_keys,test_vercel_headers}.py`, `vercel.json` y `misiones/…`. Del frontend, solo `vercel.json`, como permite la misión.
- [x] Migraciones = 1 head → `a7d4e2c9f1b3 (head)`.
- [x] Sin `console.log`, secretos ni `any` nuevos → el grep del checklist sale vacío (exit 1).
- [x] Puerta compartida → `verify: OK`.
- [x] Criterios uno a uno → arriba. El 7 queda abierto **solo** en su parte de producción (curl tras el deploy).

- **Desviaciones o dudas:** el límite por defecto va como dependencia global y no como `SlowAPIMiddleware` (motivo arriba). El límite por defecto pasa a 120/min. Se quitó el cubo por IP de `/api/codes/redeem`. Hay que confirmar en los logs de Railway la línea `rate-limit: peer …`.
- **Fallos preexistentes:** ninguno.
