# Misión 15 — Frontend y APK

## localStorage (`grep -rnoE "localStorage.(setItem|getItem)" frontend/src`, sin tests)
| Clave | Contenido | Riesgo |
|---|---|---|
| `sb-<ref>-auth-token` (supabase-js, por defecto) | **access + refresh token de la sesión** | Alto si hay XSS: cualquier script lo lee. Mitigación = sin XSS + CSP (H-06) |
| korex-plan, korex-plan-label | caché del plan para pintar la UI | Bajo: el backend decide el acceso en cada petición (plan_guard) |
| korex-language, korex-currency, korex-theme, korex-date-format | preferencias | Nulo |
| korex-notif-*, kx-checkin, korex_login_streak, korex_onboarding_step | estado de UI | Nulo |
| sessionStorage korex_calc_handoff | cifras de la calculadora pública | Nulo |

## Superficies XSS
- `grep dangerouslySetInnerHTML|innerHTML =|eval(|new Function` en frontend/src → **0**.
- React escapa todo texto (nombres de cuentas, notas de la IA). La nota X-Korex-Note se sanea en el backend (sin `<>` ni controles).
- Headers de korexf.com (Vercel): solo `Strict-Transport-Security`. **Sin CSP ni X-Frame-Options** (H-06). El CSP del backend no protege el SPA (solo viaja en respuestas JSON).

## Secretos en el cliente
- Variables del bundle: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (pública por diseño). Ninguna secreta.
- `grep SERVICE_ROLE|service_role` en frontend/ (sin node_modules) → 0.
- `git ls-files | grep -iE "\.jks|\.keystore|google-services|key\.properties"` → 0 (firma y llaves fuera del repo).

## APK (frontend/android)
- No hay APK compilado en el árbol ni en el equipo para desempaquetar; se audita la fuente que lo genera.
- `debuggable`: no se fija → release no depurable (por defecto de AGP). `minifyEnabled false` (sin ofuscación; info).
- Firma release: `key.properties` fuera de git; si falta, cae a la firma debug (solo para builds locales).
- `android:allowBackup="true"` → el almacenamiento del WebView (sesión Supabase) entra en copias de seguridad (H-12).
- Capacitor: `server.url` y `cleartext` comentados → assets locales, sin tráfico en claro.
- `@capacitor/android` 8.1.x afectado por GHSA-rvm3-566m-v7fv (H-04).

## Componentes exportados (AndroidManifest.xml)
| Componente | exported | Nota |
|---|---|---|
| `.MainActivity` | true | Necesario (LAUNCHER). Acepta deep link `korex://auth-callback` |
| `androidx.core.content.FileProvider` | false | grantUriPermissions solo bajo demanda |
| Servicios/receivers | — | Ninguno declarado (FCM los aporta el plugin con exported=false) |

**Deep link `korex://auth-callback`** (H-03): esquema propio (cualquier app puede registrarlo) + supabase-js en
flujo implícito por defecto (`createClient(url, key)` sin `flowType`) + `nativeAuth.ts` acepta
`#access_token=…&refresh_token=…` → interceptación de sesión por una app maliciosa instalada y login forzado
(CSRF de inicio de sesión) con un enlace `korex://auth-callback#access_token=<del atacante>`.
