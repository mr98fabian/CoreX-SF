# Misión 15: Auditoría de seguridad pre-lanzamiento
- **ID:** 2026-11-25-auditoria-seguridad
- **Estado:** en-auditoria
- **Rama:** audit/seguridad-prelanzamiento
- **Repo:** CoreX-SF
- **Modo:** AUDITOR (no construye features; no cambia código salvo orden expresa de Fabian)

## Objetivo
Auditar la superficie de seguridad antes del lanzamiento del 24 de diciembre de 2026. Puerta:
ningún hallazgo crítico abierto. Los críticos y altos se convierten en misiones de corrección
numeradas, por delante de cualquier feature; Fabian decide qué medias y bajas acepta como riesgo.

## Contexto
- Backend FastAPI (Railway) + Supabase Postgres; frontend React/Vite (Vercel); APK Capacitor;
  pagos Stripe (web) y Google Play (Android); OAuth/MCP para el kit IA; push FCM; correos.
- Reglas del ejercicio: solo cuentas desechables (QA / generadas en local). Nunca la cuenta real de
  Fabian ni datos de usuarios reales. Nada destructivo contra producción. Ningún secreto en el
  reporte ni en la evidencia: «existe / no existe», nunca el valor. La basura de prueba se limpia
  y se lista.
- La matriz IDOR se ejecuta contra el backend en local (SQLite, puerto 8001) con usuarios
  sintéticos: es la forma de probar escrituras cruzadas sin tocar producción.

## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | Matriz IDOR ejecutada: endpoints × {sin token, A, B} (cuentas, deudas, suscripciones, ajustes, push devices, códigos, tokens, DELETE /api/user/me) | `python misiones/evidencia/15/idor_matrix.py` contra backend local | `misiones/evidencia/15/idor-matrix.txt`; B nunca lee ni escribe lo de A; sin token = 401 |
| 2 | RLS verificado tabla por tabla en Supabase (incl. email_log, push_devices, push_log) | consulta a `pg_class.relrowsecurity` + `pg_policies` vía MCP de Supabase | `misiones/evidencia/15/rls.md` con consulta y resultado; toda tabla de `public` con RLS |
| 3 | La llave service-role no sale del backend | `grep` de su nombre en `frontend/`, `android/`, bundle `dist/` | 0 coincidencias en el cliente |
| 4 | Tokens/OAuth/MCP: expiración, rotación del refresh con revocación de familia, PKCE obligatorio, scopes mínimos, `write:payments` inalcanzable, `/mcp` sin token = 401, revocación real | lectura de código + pruebas en local | `misiones/evidencia/15/oauth.txt` |
| 5 | Webhooks: Stripe sin firma = rechazo; RTDN de Play sin OIDC válido = rechazo; replay no duplica efectos | lectura de código + `curl` en local | `misiones/evidencia/15/webhooks.txt` |
| 6 | Barrido de secretos en árbol e historial de git | script de patrones sobre `git ls-files` y `git log -p --all` | `misiones/evidencia/15/secretos.txt`, limpio o hallazgos sin valores |
| 7 | Inventario de variables de entorno: Railway por nombre vs las que usa el código | `grep os.getenv/environ` + listado de Railway por nombre | `misiones/evidencia/15/env-inventario.md` |
| 8 | Frontend/APK: localStorage, XSS, APK sin llaves ni debug, componentes exportados | `grep` + lectura de `AndroidManifest.xml` | `misiones/evidencia/15/frontend-apk.md` |
| 9 | Abuso: fuerza bruta (login, registro, canje), límite de correos de Auth, enumeración | lectura de código + config de Auth | `misiones/evidencia/15/abuso.md` |
| 10 | Dependencias: `npm audit` y `pip-audit` con salida adjunta | comandos | `misiones/evidencia/15/npm-audit.txt`, `pip-audit.txt` |
| 11 | Cada hallazgo con severidad, evidencia, reproducción y corrección propuesta | lectura del Reporte | tabla de hallazgos completa |
| 12 | Puerta compartida en verde (sin cambios de código) | `python scripts/verify.py` | `verify: OK` (exit 0) |
| 13 | Sin migraciones | `git diff --name-only origin/main...HEAD` | solo `misiones/` |

## Pasos
1. Leer código de auth, routers, OAuth/MCP, webhooks.
2. RLS por MCP de Supabase (solo lectura).
3. Barrido de secretos, inventario de variables.
4. Matriz IDOR en local.
5. Frontend/APK, abuso, dependencias.
6. Reporte de una página + anexo; misiones de corrección en la cola.

## No tocar
- Código de la app (salvo orden de Fabian). Datos de producción (solo lecturas de metadatos).
- La cuenta real de Fabian. El puerto 8000.

## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-25 (UTC 2026-11-26 03:40)
- **Rama y commit:** `audit/seguridad-prelanzamiento` (desde `origin/main` 661f47a)

### Veredicto (una página)
**Cero hallazgos críticos. Un alto (Plaid sin auth en producción). Puerta del 24-dic: cumple para críticos;
el alto pasa a la Misión 20, por delante de cualquier feature.**

Lo que aguanta: aislamiento entre usuarios (115/115 pruebas: B nunca leyó ni escribió nada de A; sin token = 401
en 45 endpoints), RLS deny-by-default en las 28 tablas sin privilegios para `anon`/`authenticated`, OAuth/MCP
(PKCE S256 obligatorio, rotación con revocación de familia, `write:payments` inalcanzable, `/mcp` 401 en
producción), webhooks (firma/JWT obligatorios, replay sin efecto) y cero secretos en árbol e historial (465 commits).

| # | Sev. | Hallazgo | Evidencia | Reproducción | Corrección propuesta |
|---|---|---|---|---|---|
| H-01 | **Alta** | `/api/plaid/create_link_token`, `/exchange_public_token` y `/accounts` **sin autenticación** en producción, y el access token de Plaid se guarda en un dict GLOBAL en memoria (`plaid_tokens["current"]`, `routers/transactions.py:180`) compartido por todos los usuarios: `import_accounts`/`sync_transactions` de cualquier usuario usan el banco del último que enlazó. Hoy es Plaid **Sandbox** (datos ficticios) y el SPA no lo usa, así que no hay datos bancarios reales expuestos; pero cualquiera en internet puede gastar cuota de Plaid y fijar el item que verán los demás. Si se pasa a Plaid Production tal cual = **crítico** (el banco de A en la cuenta de B). | `env-inventario.md`; sonda: `GET /api/plaid/create_link_token` sin Authorization → **200** con `link-sandbox-…` | 1) `curl https://corex-sf-production.up.railway.app/api/plaid/create_link_token` → 200. 2) Completar Plaid Link sandbox con ese token → public_token. 3) `POST /api/plaid/exchange_public_token` sin auth → fija el token global. 4) Cualquier usuario que llame `POST /api/plaid/import_accounts` recibe esas cuentas. (Pasos 2-4 NO se ejecutaron en producción: alterarían estado compartido.) | **Misión 20**: rutas `/api/plaid/*` → 404 salvo `PLAID_ENABLED`; quitar `PLAID_*` de Railway; si Plaid vuelve, token por usuario en BD cifrado y todas las rutas con `get_current_user_id`. Test de guarda: toda ruta del router exige auth salvo lista blanca. |
| H-02 | Media | Rate limits «por IP» ven la IP del proxy (Railway / rewrite de Vercel): uvicorn sin `--proxy-headers`. Los cubos de `/api/codes/redeem`, `/oauth/register|authorize|token` son globales → un atacante agota el cupo de todos (p. ej. canje de códigos el día del lanzamiento). `default_limits` de main.py no aplica (no hay `SlowAPIMiddleware`). | `abuso.md` | Por código (Procfile, main.py, vercel.json). No probado contra producción. | Clave de límite = usuario (sesión/token) donde exista; IP real desde `X-Forwarded-For` con proxies de confianza; añadir `SlowAPIMiddleware` si se quiere el global. |
| H-03 | Media | Login nativo de Google por esquema propio `korex://auth-callback` con supabase-js en flujo **implícito** (tokens en el fragmento): una app instalada que registre `korex://` intercepta la sesión; un enlace `korex://auth-callback#access_token=…` mete a la víctima en la cuenta del atacante. | `frontend-apk.md` | Lectura de `lib/supabase.ts` (sin `flowType`) y `lib/nativeAuth.ts` (rama `tokens`). | `createClient(..., { auth: { flowType: 'pkce' } })`, quitar la rama `tokens` en nativo; ideal: App Links https verificados. |
| H-04 | Media | `@capacitor/android` 8.1.x — GHSA-rvm3-566m-v7fv (contenido remoto cargable en el origen de la app vía la ruta del proxy HTTP interno). Explotabilidad en nuestro uso no demostrada; si ocurre, ese contenido lee la sesión del localStorage. | `npm-audit.txt` | `npm audit --omit=dev` | Subir `@capacitor/android`/`core` a ≥ 8.3.5 y recompilar el APK. |
| H-05 | Media | Backend: `pyjwt` 2.11.0 (20 avisos; la ruta de auth), `python-multipart` 0.0.22 (DoS en parseo urlencoded → `/oauth/token` sin auth), `starlette` 0.52.1 (Host/path sin validar en `request.url`). No se encontró explotación directa: cada `jwt.decode` usa una sola alg; las DoS sí aplican a rutas públicas (`/oauth/token`, `/rtdn` con `PyJWKClient`). | `pip-audit.txt` | `pip-audit -r backend/requirements.txt` | Subir pyjwt ≥ 2.15, python-multipart ≥ 0.0.31, fastapi/starlette ≥ 1.3.1; correr la suite. |
| H-06 | Media | `korexf.com` sin CSP ni `X-Frame-Options`/`frame-ancestors` (solo HSTS). Permite clickjacking de `/oauth/consent` (aprobar la conexión de una IA ajena) y de «borrar cuenta»; sin CSP cualquier XSS futura lee la sesión. | `curl -sI https://korexf.com` | Enmarcar `https://korexf.com/oauth/consent?request=…` en otra web. | `headers` en `vercel.json`: `Content-Security-Policy` (con `frame-ancestors 'none'`), `X-Frame-Options: DENY`. |
| H-07 | Baja | Supabase Auth: protección de contraseñas filtradas (HIBP) desactivada. | `rls.md` (advisor) | Advisor de seguridad de Supabase. | Activarla (Authentication → Passwords). |
| H-08 | Media (pendiente) | Correos de Auth por el SMTP integrado de Supabase, con límite por hora de TODO el proyecto: unos pocos registros/resets bastan para bloquear el registro de usuarios reales. No verificable desde aquí si la Misión 13 ya lo cambió. | `abuso.md`, `qa/README.md` | Supabase → Authentication → SMTP / Rate limits. | SMTP propio (Resend ya está en el stack) y límites explícitos. |
| H-09 | Baja | Push: si B conoce el token FCM de A, `POST /api/push/devices` le reasigna el dispositivo (A deja de recibir sus avisos, B recibe los suyos). Requiere el token FCM de A, que no es público. | `idor-matrix.txt` (línea INFO) | Matriz, actor B. | No reasignar un token de otro usuario; o aceptarlo (token por instalación). |
| H-10 | Baja | Tokens manuales `kx_` sin caducidad; `write:payments` solo con casilla explícita del usuario (por diseño). Revocación verificada. | `oauth.txt` | — | Caducidad opcional (p. ej. 90 días) en la UI. |
| H-11 | Baja | Tras borrar la cuenta, su JWT se corta con `DELETED_USERS` en memoria de un solo proceso: con reinicio o más de una réplica, el JWT vive ≤ 1 h. | `auth.py` | — | Aceptable con 1 réplica; si se escala, lista en BD/Redis. |
| H-12 | Baja | APK: `android:allowBackup="true"` (la sesión del WebView entra en backups); `minifyEnabled false`. | `frontend-apk.md` | AndroidManifest.xml | `allowBackup="false"` o `dataExtractionRules` que excluyan el WebView. |
| H-13 | Baja | RTDN: fijar el emisor (`GOOGLE_RTDN_SERVICE_ACCOUNT`) es opcional; sin él, cualquier JWT OIDC de Google con nuestra audiencia pasa (el estado igual se relee de Google). | `webhooks.txt` | — | Confirmar que existe en Railway; volverlo obligatorio. |
| H-14 | Baja | `xlsx` 0.18.5 (prototype pollution/ReDoS solo al importar un archivo malicioso que el propio usuario sube en Ajustes); `jspdf` < 4.2 (avisos en `addJS`/AcroForm, que no usamos). | `npm-audit.txt` | — | xlsx desde el CDN oficial de SheetJS (≥ 0.20.3); subir jspdf. |

Informativo (no hallazgo): el token demo es público por diseño y entra a una cuenta sintética compartida
(bloqueada para tokens, códigos, OAuth y borrado; probado en código).

**Decisión de Fabian sobre medias y bajas (riesgo aceptado para el 24-dic): _pendiente_.**

### Evidencia de los criterios
1. Matriz IDOR → `misiones/evidencia/15/idor-matrix.txt`: **115 PASS · 0 FAIL · 1 INFO** (app real en proceso, JWT HS256 de prueba, SQLite en memoria; script `idor_matrix.py`).
2. RLS → `misiones/evidencia/15/rls.md`: 28/28 tablas con RLS, 0 políticas, `anon`/`authenticated` sin SELECT; incluye email_log, push_devices, push_log.
3. Service-role → solo `backend/supabase_admin.py`; 0 apariciones en frontend; barrido limpio.
4. Tokens/OAuth/MCP → `oauth.txt` (16 pruebas + sondas de producción: `/mcp` 401, `alg=none` 401).
5. Webhooks → `webhooks.txt` (7 pruebas + producción: firma inventada 401, JWT basura 401).
6. Secretos → `secretos.txt`: árbol 1 coincidencia = falso positivo (URL ficticia de test); historial (465 commits) limpio.
7. Variables → `env-inventario.md`: lado código completo y estado en producción inferido por sonda. **Lado Railway pendiente**: el CLI no tiene sesión (`railway status` → Unauthorized).
8. Frontend/APK → `frontend-apk.md`.
9. Abuso → `abuso.md` (canje: 429 al 6.º intento, probado).
10. Dependencias → `npm-audit.txt` (15 en prod: 3 críticas, 8 altas — solo `@capacitor/android` sube a hallazgo por nuestro uso), `pip-audit.txt`.
11. Tabla de hallazgos arriba.
12. verify.py → ver checklist.
13. Sin cambios de código → ver checklist.

### Limpieza
- Producción: solo lecturas y peticiones rechazadas (firma/JWT inválidos, sin token). Un `link_token` sandbox de Plaid quedó emitido por la sonda (caduca solo a las 4 h; no crea items ni datos). Cero filas escritas en Supabase.
- Local: la matriz corre en SQLite en memoria (`sqlite://`): todo desaparece al salir. `korex.db` sin tocar.
- Venv de `pip-audit` en el scratchpad (fuera del repo).


### Checklist de auto-verificación
- [x] Archivos fuera de alcance = 0 → `git diff --name-only origin/main...HEAD`: solo `misiones/cola.md`,
      `misiones/2026-11-25-auditoria-seguridad.md`, `misiones/2026-11-25-plaid-sin-auth.md` y `misiones/evidencia/15/*`
      (la misión solo permite `misiones/`). Cero cambios de código de la app.
- [x] Migraciones → sin migraciones (el diff solo toca `misiones/`); `alembic-heads OK` en verify.
- [x] Sin secretos → `git diff -U0 | grep sk_live|whsec_|PRIVATE KEY|eyJ…`: solo las expresiones regulares del propio
      `secret_sweep.py`, ningún valor.
- [x] Puerta compartida → `python scripts/verify.py --force`:
      `backend:pytest OK · backend:alembic-heads OK · frontend:vitest OK · frontend:eslint OK · frontend:build OK · verify: OK` (exit 0)
- [x] Criterios uno a uno → sección «Evidencia de los criterios».

### Desviaciones o dudas
- Criterio 7 parcial: falta el listado por nombre de las variables de Railway (CLI sin sesión). Se cierra con
  `railway login` + el comando de `env-inventario.md`.
- H-08 (SMTP/límites de Auth) y H-13 (`GOOGLE_RTDN_SERVICE_ACCOUNT`) quedan pendientes de confirmar en los paneles.
- La matriz se ejecutó contra la app real en proceso y no contra el servidor de producción: es la única forma de
  probar escrituras cruzadas sin tocar datos reales. Producción se sondeó solo con lecturas y peticiones rechazadas.
