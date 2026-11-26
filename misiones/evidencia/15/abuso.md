# Misión 15 — Abuso (fuerza bruta, correos, enumeración)

## Canje de códigos
- Probado (idor-matrix.txt): 7 canjes seguidos → `[400×5, 429, 429]`. Límite 5/min por IP **y** 5/min por sesión.
- Espacio de códigos: 12 caracteres de un alfabeto de 32 (≈ 60 bits), HMAC en BD, error genérico
  («Invalid or unavailable code.») → no se distingue código inexistente de agotado. Fuerza bruta inviable.

## Login y registro
- Van directos del navegador a Supabase Auth (`signInWithPassword`, `signUp`, `resetPasswordForEmail`):
  sus límites son los del proyecto Supabase, no del backend.
- Advisor de Supabase: **protección de contraseñas filtradas (HIBP) desactivada** (H-07).
- DELETE /api/user/me valida la contraseña contra Supabase: con una sesión robada se puede probar
  contraseñas a ~ritmo del límite de Auth de Supabase. Requiere sesión previa → incluido en H-11 como nota.

## Límite de correos de Auth (Misión 13)
- `qa/README.md` («Límites conocidos») documenta que la confirmación sale por el **SMTP integrado de Supabase**,
  limitado por hora a TODO el proyecto, y que el registro falla con «email rate limit exceeded».
- La Misión 13 no figura en `misiones/cola.md`; desde aquí no se puede leer la configuración de SMTP/Rate limits
  de Auth (no la expone el MCP). → **H-08, pendiente de confirmar por Fabian** en Supabase → Authentication →
  Emails/SMTP y Rate Limits.

## Rate limits por IP detrás de proxy (H-02)
- `Procfile`: `uvicorn main:app --host 0.0.0.0 --port $PORT` sin `--proxy-headers`/`--forwarded-allow-ips` →
  uvicorn solo confía en 127.0.0.1, así que `request.client.host` es la IP del proxy de Railway; y las
  llamadas vía `korexf.com/api/*` pasan por el rewrite de Vercel (`vercel.json`).
- slowapi `get_remote_address` usa esa IP → los cubos «por IP» (`/api/codes/redeem` 5/min, `/oauth/register`
  10/min, `/oauth/authorize` 30/min, `/oauth/token` 60/min) los comparte todo el mundo.
- Además `default_limits=["60/minute"]` en main.py no aplica a nada: no hay `SlowAPIMiddleware`.
- Estado: **por código, no probado contra producción** (habría que saturar producción para demostrarlo).

## Enumeración de usuarios
- Login: el SPA traduce `Invalid login credentials` (mismo mensaje para email inexistente y contraseña mala).
- Registro: con confirmación de correo activa (el Probador QA confirma por enlace), Supabase responde a un email
  existente con un usuario ofuscado sin error → no enumera. La rama `already registered` del SPA solo dispara si se
  desactiva la confirmación.
- Reset: Supabase responde 200 exista o no el correo.
- Backend: canje de códigos con error genérico; endpoints con ids ajenos → 404 (no 403), sin distinguir «existe y no
  es tuyo» de «no existe» (idor-matrix.txt).
