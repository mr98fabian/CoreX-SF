# Misión: Integración de Stripe Managed Payments (checkout web)
- **ID:** 2026-11-22-integracion-stripe
- **Estado:** en-auditoria
- **Rama:** feat/integracion-stripe
- **Repo:** CoreX-SF
- **Origen:** deuda técnica de la Misión 1. Por dentro, el checkout web sigue siendo Lemon Squeezy,
  cuya cuenta fue rechazada, así que hoy comprar por la web FALLA. Los textos legales ya dicen
  Stripe; falta la integración real.
## Objetivo
Que la compra web de KoreX Anual ($100/año, prueba de 7 días) funcione con **Stripe Managed
Payments**: Stripe es el vendedor registrado (merchant of record), procesa el pago y se encarga de
los impuestos. Google Play Billing (Android) NO se toca.
## Contexto
- Puerta previa (verificar y reportar, no bloquear el resto): la cuenta Stripe de KONTROLLY CONSULTING
  GROUP LLC debe estar activa con Managed Payments. Las llaves (secret key, publishable key, webhook
  secret) las pega **Fabian en Railway**; nunca pasan por el chat ni por el repo. Si la cuenta aún no
  está lista, construir todo contra el modo de prueba de Stripe y anotar la puerta en el Reporte: la
  estructura y los tests no dependen de las llaves reales.
## Pasos
1. **Backend**: reemplazar el flujo web de Lemon en `backend/routers/subscriptions.py` (API
   api.lemonsqueezy.com, webhook y variables LEMONSQUEEZY_*) por Stripe:
   - Endpoint que crea la sesión de checkout (suscripción anual, prueba de 7 días) y devuelve la URL,
     con el mismo patrón UX que hoy usan UpgradeModal/PlansPage.
   - Webhook de Stripe con **verificación de firma** que activa, renueva o cancela el plan en KoreX
     según los eventos de suscripción (equivalente al webhook de Lemon y al RTDN de Play).
   - Variables `STRIPE_*` desde Railway; el backend falla cerrado (503) si faltan.
2. **Datos**: renombrar el proveedor `lemon` → `stripe` donde viva (`BillingProvider` en
   `frontend/src/lib/billing.ts` y `planLimits.ts`; `store_source` en `backend/models.py`). Si exige
   migración de Alembic: una sola, con un upgrade que convierta los registros `lemon` a `stripe`, y
   **`alembic heads` == 1** al final.
3. **CSP**: en `backend/main.py`, reemplazar los dominios de Lemon por los de Stripe que apliquen
   (checkout.stripe.com, js.stripe.com, api.stripe.com).
4. **Frontend**: UpgradeModal y PlansPage abren la URL de checkout de Stripe que devuelve el backend;
   textos visibles sin cambios.
5. **Comentarios/docstrings** que nombran Lemon: SOLO en los archivos que esta misión toca; el resto
   se reporta, no se persigue.
## Criterios de aceptación
- [ ] `grep -ri "lemon" frontend/src backend/` → cero en código funcional (solo puede quedar la
      migración histórica a3f6c8e2d1b9 y, si aplica, el downgrade de la migración nueva); cada resto,
      listado y justificado en el Reporte.
- [ ] Tests del webhook de Stripe (firma válida/inválida, alta, renovación, cancelación) + pytest +
      vitest + eslint + build en verde.
- [ ] Si hay migración: `alembic heads` == 1.
- [ ] Google Play / RTDN intactos (sus tests lo prueban).
- [ ] Prueba en modo test de Stripe documentada en el Reporte (sesión creada y webhook simulado), o
      la puerta de la cuenta anotada si no se pudo.
## No tocar
- Nada de Google Play Billing ni del RTDN. Nada de precios, prueba ni textos legales.
- Ninguna llave real en el repo, en el chat ni en el Reporte.
- Merge a main: lo ordena Fabian tras la auditoría de Mijo.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-22
- **Rama y commit:** `feat/integracion-stripe`: backend en 2b12a65, frontend en 8fc9e53; este reporte va
  en el commit de cabeza de la rama. Base: main 69ede62 (incluye la misión 1).
- **Puerta previa (cuenta Stripe):** **no verificada.** Desde aquí no tengo acceso a la cuenta de
  KONTROLLY CONSULTING GROUP LLC ni a sus llaves (por diseño: solo se cargan en Railway). Todo se
  construyó contra la API de Stripe y se probó con la API simulada. No se creó ninguna sesión real de
  prueba en Stripe porque eso exige una llave `sk_test_…`, y esa llave no puede pasar por el chat ni por
  el repo. Pasos para Fabian, en el panel de Stripe y en Railway:
  1. En Stripe: activar Managed Payments y pasar la revisión de elegibilidad (producto digital y
     automatizado, venta directa).
  2. Crear el producto «KoreX Anual» con un tax code **elegible para Managed Payments** (por ejemplo,
     SaaS `txcd_10103001`) y un precio recurrente anual de USD 100.
  3. Crear un webhook a `https://corex-sf-production.up.railway.app/api/subscriptions/webhook` con los
     eventos `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` e
     `invoice.paid`.
  4. En Railway: cargar `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y `STRIPE_PRICE_FREEDOM_ANNUAL`
     (primero las de modo prueba) y luego borrar las `LEMONSQUEEZY_*` y `LS_VARIANT_*`. La publishable
     key no hace falta: el checkout es la página alojada por Stripe, sin Stripe.js.
  5. Prueba en modo test: comprar con la tarjeta 4242 4242 4242 4242 desde korexf.com → Planes; luego
     comprobar `store_source=stripe` y el plan en `/api/subscriptions/status`, y cancelar desde Link.
- **Qué se construyó:**
  - `POST /api/subscriptions/checkout` crea la Checkout Session (`mode=subscription`,
    `managed_payments[enabled]=true`, `Stripe-Version: 2025-03-31.basil`, el único precio vendido,
    `client_reference_id` y `metadata.user_id`) y devuelve `checkout_url`. Es el mismo contrato que ya
    usan UpgradeModal y PlansPage, así que no cambia nada visible. Sin `automatic_tax`, que Managed
    Payments no admite porque Stripe gestiona los impuestos.
  - `POST /api/subscriptions/webhook` verifica `Stripe-Signature` (HMAC-SHA256 sobre `t.body`, con 5
    minutos de tolerancia contra repeticiones) y maneja estos eventos:
    - `checkout.session.completed`: lee la suscripción en Stripe; si no puede, responde 500 y Stripe
      reintenta.
    - `customer.subscription.*`: estados `trialing→on_trial`, `active`, `past_due`; con cancelación
      programada, `cancelled` hasta el fin del periodo; `canceled`/`unpaid`/`incomplete_expired` →
      `expired` y plan starter.
    - `invoice.payment_failed` → `past_due`; `invoice.paid` → vuelve a `active`.
    - Orden e idempotencia por `event.created`. Un evento de una suscripción vieja no pisa a la nueva,
      y un fin de Stripe nunca toca una fila de Google Play.
  - Falla cerrado: 503 sin `STRIPE_SECRET_KEY`, sin el precio o sin `STRIPE_WEBHOOK_SECRET`.
  - La gestión de la suscripción (cancelar, cambiar tarjeta) va por Link (`https://app.link.com`), como
    indica la documentación de Managed Payments; `/portal` devuelve ese enlace.
  - Migración **d2f7b3c9e4a6**: `store_source` pasa de `lemon` a `stripe` en las filas y en el server
    default. Se probó subida y bajada en una DB de prueba.
  - CSP: `js.stripe.com` (script), `api.stripe.com` (connect), `checkout.stripe.com` y `js.stripe.com`
    (frame).
  - Frontend: `BillingProvider` y `store_source` pasan a `'stripe'`, más los comentarios de los archivos
    tocados.
- **Verificaciones corridas y resultado:** pytest **612 passed** (desde `backend/`, como CI). Son 31 tests de facturación web en
  `test_billing.py`:
  - firma válida, inválida, ausente o malformada, repetida (antigua) y sin secreto;
  - alta, prueba, renovación, cancelación al fin de periodo, borrado, pago fallido y recuperado,
    `checkout.session.completed`;
  - duplicados, eventos viejos, re-suscripción, precio desconocido, fila de Play;
  - checkout: 503, 400, 502, y que la sesión sea managed payments, anual y con la prueba;
  - precio y prueba iguales a los de `pricing.ts`, y la migración.
  Además: vitest **54 archivos / 330 tests passed**; `eslint --max-warnings 0` sin errores;
  `npm run build` OK; `alembic heads` = **1** (`d2f7b3c9e4a6`). Los tests de Google Play/RTDN pasan; en
  ellos solo cambió una etiqueta (la fila web ahora dice `stripe`, antes `lemon`), no su lógica.
- **Desviaciones o dudas:**
  - **Prueba gratis: 7 días (decisión de Fabian, 2026-11-22).** Antes la web mostraba 30
    (`TRIAL_DAYS = 30` en `pricing.ts`). Por orden de Fabian, `TRIAL_DAYS = 7` en `frontend/src/lib/pricing.ts`
    y en `backend/routers/subscriptions.py`, en un mismo commit; la tarjeta del plan y el checkout
    leen esa constante y un test ata ambas. Los textos legales no mencionan la duración.
  - No está documentado si Managed Payments admite `subscription_data[trial_period_days]`: se usa el
    parámetro estándar de Billing y hay que confirmarlo en la prueba en modo test.
  - Las páginas de Managed Payments solo listan los eventos `checkout.session.*`. Los eventos
    `customer.subscription.*` e `invoice.*` son los estándar de Billing y se asumen; también hay que
    confirmarlos en la prueba en modo test.
  - Las columnas `ls_subscription_id` / `ls_customer_id` conservan su nombre y guardan los ids de
    Stripe; renombrarlas sería otra migración sin beneficio funcional.
  - Las filas que estaban como `lemon` pasan a `stripe` con sus ids viejos de Lemon; el webhook de Stripe
    no las toca. Como la cuenta de Lemon fue rechazada, no se esperan suscriptores reales de Lemon.
- **Restos de «lemon» (`grep -ri lemon frontend/src backend/`), ninguno en código funcional:**
  - Migración histórica `a3f6c8e2d1b9` (docstring y server default original) y la constante
    `PREVIOUS_WEB_STORE = 'lemon'` del downgrade de `d2f7b3c9e4a6`.
  - Tests: `test_billing.py` (docstring y la tabla de prueba de la migración), `test_google_play.py`
    (docstring y la prueba de la migración histórica), `enEsSweep.test.tsx` (comprueba que no quede
    Lemon en los textos legales).
  - Comentarios en archivos que esta misión no toca (se reportan, no se persiguen): `plan_guard.py:42,54`,
    `routers/account.py:14`, `routers/google_play.py:6,10,36,136,164,291` (Google Play no se toca),
    `PlayStoreActions.tsx:3`, `useEffectivePlan.ts:9`.
