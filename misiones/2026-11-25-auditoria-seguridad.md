# Misión 15: Auditoría de seguridad pre-lanzamiento
- **ID:** 2026-11-25-auditoria-seguridad
- **Estado:** en-curso
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
_pendiente_
