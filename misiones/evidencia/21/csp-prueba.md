# H-06: prueba local de la CSP (2026-11-27)

**Montaje.** `npm run build` (index.html con LF, como lo saca Vercel de git). Lo sirve un servidor local que
lee las cabeceras de la regla `/(.*)` de `vercel.json` y las añade a cada respuesta. Ese servidor también
reenvía `/api/*` y `/oauth/*` al backend local (:8002, con SQLite, sin `.env` de producción), igual que el
rewrite de Vercel. Navegador: el integrado de la app (Chromium). Login con «Probar demo».

Cabeceras servidas (`curl -sI http://127.0.0.1:4173/oauth/consent`): `Content-Security-Policy` (la de
`vercel.json`) y `X-Frame-Options: DENY`.

| Flujo | Qué se hizo | Violaciones de CSP |
|---|---|---|
| Login | `/login` → «Probar demo» → `/dashboard` | 1, **corregida**: `https://korexf.com/apk.json` (URL absoluta en `lib/apkUpdate.ts`) → añadida a `connect-src`. Con la CSP nueva, `fetch` → 200 |
| Navegación | dashboard, cuentas, análisis, calendario, ajustes/IA, ajustes/planes | 0 |
| Checkout de Stripe | `POST /api/subscriptions/checkout` same-origin (llegó al backend: 422 por un cuerpo de prueba incompleto) y luego `window.location.href = https://checkout.stripe.com/`: la pestaña salió a stripe.com. El checkout es una redirección de página completa y la CSP no gobierna esa navegación. En el front no hay Stripe.js | 0 |
| `/oauth/consent` | solicitud real (`/oauth/register` → `/oauth/authorize` → 302 al consent): renderiza «Prueba CSP quiere acceso a tu KoreX» | 0 |
| Clickjacking | se insertó un iframe del consent dentro de la propia página | bloqueado («Framing … violates … frame-src 'none'») |

**El script inline** de `index.html` (registra el service worker) se ejecuta con el hash
`sha256-Q0CX…3CI=`: aparece su `console.warn`. El test `test_inline_script_hash_matches_index_html`
recalcula el hash y falla si alguien edita ese script sin actualizar `vercel.json`.

**Ruido local, no causado por la CSP:** el service worker no llega a registrarse («An unknown error occurred
when fetching the script»). Control: el mismo `dist` servido **sin** cabeceras (`python -m http.server`) da el
mismo error en este navegador. Chrome nombra la directiva cuando una CSP bloquea algo, y aquí no nombró
ninguna.

**Orígenes permitidos, y por qué.** Supabase (`https://*.supabase.co` y `wss://` para Auth/Realtime);
Google Fonts (`fonts.googleapis.com` para estilos, `fonts.gstatic.com` para fuentes); `korexf.com` (apk.json);
Railway (la URL del backend aparece en el bundle); `formsubmit.co` (el widget de feedback). `img-src https:`
sigue abierto porque los logos de las cuentas son URLs https arbitrarias o base64 de Plaid. Stripe, Resend y
Google Sign-In **no** necesitan entrada: Stripe y el login de Google son navegaciones de página completa, y
Resend solo se usa en el backend. `style-src 'unsafe-inline'` hace falta por los estilos inline de
React/Radix. `script-src` no lleva `'unsafe-inline'` ni `'unsafe-eval'` (en `dist` no hay `eval` ni
`new Function`).

**Pendiente tras el deploy (Mijo):** `curl -sI https://korexf.com` y `curl -sI https://korexf.com/oauth/consent`
deben mostrar las dos cabeceras. Además, en producción, login real con Google y un checkout en modo test, con
la consola abierta.
