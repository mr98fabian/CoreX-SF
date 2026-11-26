# Misión 15 — Inventario de variables de entorno (solo nombres, nunca valores)

## Lado código (backend/ y mcp/, sin tests)
`grep -rhoE "(os.getenv|os.environ.get|_env)\(['\"][A-Z0-9_]+" backend mcp`

| Variable | Uso | Secreto | En producción (inferido por sonda, sin leer valores) |
|---|---|---|---|
| DATABASE_URL | conexión Postgres | sí | sí (la app responde) |
| SUPABASE_URL | JWKS + Auth | no | sí (JWT verificados) |
| SUPABASE_ANON_KEY | Auth (password check) | público | no verificable |
| SUPABASE_JWT_SECRET | solo HS256 legado | sí | no verificable |
| SUPABASE_SERVICE_ROLE_KEY | admin Auth (borrar cuenta) | **sí, crítico** | no verificable sin tocar una cuenta |
| STRIPE_SECRET_KEY | checkout / leer suscripción | sí | no verificable |
| STRIPE_WEBHOOK_SECRET | firma de webhook | sí | **existe** (401, no 503) |
| STRIPE_PRICE_FREEDOM_ANNUAL | precio | no | — |
| GOOGLE_PLAY_SERVICE_ACCOUNT_JSON | API de Play | sí | **existe** (RTDN 401, no 503) |
| GOOGLE_RTDN_AUDIENCE | audiencia OIDC | no | **existe** |
| GOOGLE_RTDN_SERVICE_ACCOUNT | fijar emisor OIDC | no | **pendiente de confirmar** (H-13) |
| GOOGLE_PLAY_PACKAGE_NAME / _PRODUCT_ID | Play | no | — |
| FIREBASE_SERVICE_ACCOUNT_JSON | push FCM | sí | no verificable |
| RESEND_API_KEY / EMAIL_FROM / EMAIL_DRY_RUN | correos | sí / no / no | no verificable |
| ACCESS_CODE_HMAC_KEY | HMAC de códigos | sí | no verificable |
| OWNER_USER_ID | admin de códigos | no | no verificable |
| MCP_REMOTE_ENABLED / OAUTH_ISSUER_URL | OAuth/MCP | no | **activo** (discovery 200, /mcp 401) |
| PLAID_CLIENT_ID / PLAID_SECRET | Plaid | sí | **existen** (link_token sandbox emitido sin auth → H-01) |
| DEMO_MODE_ENABLED | demo pública | no | activo (por defecto true; demo responde 200) |
| ENVIRONMENT / FRONTEND_URL / WEBAUTHN_ORIGINS | config | no | ENVIRONMENT≠development (/docs 404) |
| KOREX_API_TOKEN / KOREX_API_URL | solo mcp/korex_mcp.py local (stdio) | sí | no debería existir en Railway |
| KX_CAPTURE_BASELINE / VERCEL | herramientas / build | no | — |

## Lado Railway — PENDIENTE
`railway status` → "Unauthorized. Please login with `railway login`". El CLI no tiene sesión en este equipo,
así que el listado por nombre de las variables de Railway no se pudo sacar. Para cerrarlo (imprime
solo nombres):

```powershell
railway login
railway variables --json | python -c "import json,sys; print('\n'.join(sorted(json.load(sys.stdin))))"
```
Se compara contra la tabla de arriba: sobrantes (ej. claves de Lemon Squeezy antiguas, KOREX_API_TOKEN)
se borran; faltantes se anotan.
