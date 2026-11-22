# Misión: Textos legales: Lemon Squeezy → Stripe Managed Payments (ES/EN)
- **ID:** 2026-11-22-legal-stripe-mor
- **Estado:** en-auditoria
- **Rama:** feat/legal-stripe-mor
- **Repo:** CoreX-SF
## Objetivo
Las páginas legales de KoreX (Términos y Privacidad, ES + EN) nombran a Lemon Squeezy como
procesador de pagos web. Lemon Squeezy rechazó la cuenta y está fuera. La facturación web
será **Stripe Managed Payments**, donde Stripe actúa como vendedor registrado (merchant of
record): procesa el pago y se encarga de los impuestos aplicables (sales tax / VAT).
## Contexto
- Decisión de Fabian (2026-11-21). Google Play Billing sigue siendo la vía de pago dentro de
  la app Android y NO cambia.
- Redacción base:
  - ES: «Las compras realizadas en nuestro sitio web se procesan a través de Stripe, que actúa
    como vendedor registrado (merchant of record): Stripe procesa tu pago y se encarga de los
    impuestos aplicables a la venta.»
  - EN: "Purchases made on our website are processed through Stripe, which acts as the
    merchant of record: Stripe processes your payment and handles the taxes applicable to the
    sale."
## Pasos
1. Buscar en todo el repo (frontend y backend) cualquier mención visible al usuario de
   "Lemon Squeezy" / "Lemon" en textos legales, páginas de precios, checkout web y correos.
   Reportar cada archivo y línea antes de tocar.
2. Reemplazarlas por la redacción del modelo MoR, en ES y EN con paridad total, adaptada al
   contexto de cada cláusula (pagos, impuestos, reembolsos), sin cambiar ninguna otra
   condición: precio ($100/año), prueba de 7 días, política de reembolsos y demás términos
   quedan EXACTAMENTE igual.
3. No tocar nada que mencione Google Play / Play Billing. No cambiar diseño, rutas ni fechas
   de vigencia; si una página tiene campo de "última actualización" ligado al texto, dejarlo
   como está y reportarlo.
4. Si alguna mención de Lemon vive en código funcional (integración, webhooks, variables) y
   no en texto legal, NO tocarla: reportarla aparte como deuda técnica.
## Criterios de aceptación
- [ ] `grep -ri "lemon" frontend/src backend/` → cero menciones en textos visibles al usuario
      (las que queden, listadas y justificadas en el Reporte).
- [ ] pytest + vitest + eslint + build en verde.
- [ ] Sin migraciones (si se cree necesitar una, detenerse y reportarlo).
## No tocar
- Google Play / Play Billing, diseño, rutas, fechas de vigencia.
- Código funcional de Lemon (integración, webhooks, variables): solo se reporta.
- Merge a main: lo ordena Fabian tras la auditoría de Mijo.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-22
- **Rama y commit:** `feat/legal-stripe-mor` — cambio legal en eedbb1c; este reporte va en el commit
  de cabeza de la rama. Base: main 0306362.
- **Inventario (paso 1), menciones visibles al usuario antes de tocar:**
  - `frontend/src/features/legal/privacyCopy.ts:47` (EN) y `:120` (ES): proveedor «Lemon Squeezy»
    en la lista de terceros de la sección «sharing».
  - `frontend/src/features/legal/termsCopy.ts:72` (EN) y `:164` (ES): proveedor «LemonSqueezy» en la
    lista de integraciones de terceros.
  - Fuera de eso no hay ninguna mención visible: ni en precios, ni en checkout, ni en correos (el
    backend no tiene plantillas de correo con Lemon) ni en `LanguageContext`. Las cláusulas legales
    no tienen secciones propias de pagos, impuestos o reembolsos que nombren al procesador.
- **Cláusulas, antes → después:**
  - Privacidad EN — antes: «• **Lemon Squeezy** — subscription payment processing (receives your
    account identifier, and your name and email when you subscribe; card details are entered in Lemon
    Squeezy's checkout, never in KoreX).» → después: «• **Stripe** — purchases made on our website are
    processed through Stripe, which acts as the merchant of record: Stripe processes your payment and
    handles the taxes applicable to the sale (receives your account identifier, and your name and email
    when you subscribe; card details are entered in Stripe's checkout, never in KoreX).»
  - Privacidad ES — antes: «• **Lemon Squeezy** — procesamiento de los pagos de suscripción (recibe el
    identificador de tu cuenta y, cuando te suscribes, tu nombre y correo electrónico; los datos de tu
    tarjeta se ingresan en el checkout de Lemon Squeezy, nunca en KoreX).» → después: «• **Stripe** —
    las compras realizadas en nuestro sitio web se procesan a través de Stripe, que actúa como vendedor
    registrado (merchant of record): Stripe procesa tu pago y se encarga de los impuestos aplicables a la
    venta (recibe el identificador de tu cuenta y, cuando te suscribes, tu nombre y correo electrónico;
    los datos de tu tarjeta se ingresan en el checkout de Stripe, nunca en KoreX).»
  - Términos EN — antes: «• **LemonSqueezy** — for payment processing and subscription management» →
    después: «• **Stripe** — for payment processing and subscription management on our website.
    Purchases made on our website are processed through Stripe, which acts as the merchant of record:
    Stripe processes your payment and handles the taxes applicable to the sale»
  - Términos ES — antes: «• **LemonSqueezy** — para el procesamiento de pagos y la gestión de
    suscripciones» → después: «• **Stripe** — para el procesamiento de pagos y la gestión de
    suscripciones en nuestro sitio web. Las compras realizadas en nuestro sitio web se procesan a
    través de Stripe, que actúa como vendedor registrado (merchant of record): Stripe procesa tu pago y
    se encarga de los impuestos aplicables a la venta»
  - Sin cambios: Google Play (ambas páginas), precio, prueba de 7 días, reembolsos, diseño y rutas.
- **Fechas de vigencia (no tocadas, a revisar):** ambas páginas dicen «November 14, 2026» /
  «14 de noviembre de 2026» (`effectiveDate`, ligada al texto). La misión habla de páginas del
  2026-11-21, pero el archivo dice 14. Si la nueva redacción debe tener su propia fecha de entrada en
  vigor, que lo decidan Fabian/Mijo.
- **Verificaciones corridas y resultado:** pytest **602 passed**; vitest **54 archivos / 330 tests
  passed** (2 nuevos en `enEsSweep.test.tsx`: la frase MoR aparece exactamente en Privacidad y en
  Términos, en ES y EN, sin «lemon», y Google Play sigue); `eslint --max-warnings 0` sin errores;
  `npm run build` OK; `alembic heads` = 1 (`c9a4f2e7b815`), sin migraciones.
- **Desviaciones o dudas:**
  - El test que verifica que en la versión en español no quede inglés marcaba el «of» de «(merchant of
    record)», que es el texto pedido. Añadí `/merchant of record/` a su lista de términos que se
    mantienen en inglés (como «Row-Level Security» o «small claims court»). No se cambió el texto.
  - `grep -ri lemon frontend/src backend/` sigue dando resultados, pero ninguno es texto visible al
    usuario: todos están en código funcional, comentarios o tests (lista abajo).
- **Deuda técnica (código funcional con Lemon, no tocado):**
  - **Riesgo real:** el checkout web sigue siendo Lemon. `UpgradeModal.tsx:57` y `PlansPage` abren el
    `checkout_url` que devuelve `backend/routers/subscriptions.py` (API `api.lemonsqueezy.com`, webhook,
    variables `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_WEBHOOK_SECRET`, `LEMONSQUEEZY_STORE_ID`). Con la cuenta
    rechazada, la compra web falla hasta integrar Stripe. Hace falta una misión de integración.
  - CSP en `backend/main.py:68,72,73` permite `app.lemonsqueezy.com` / `api.lemonsqueezy.com`; al
    integrar Stripe hay que cambiarlo por los dominios de Stripe.
  - Valor de datos `store_source = "lemon"` (`backend/models.py:109`, `server_default`), tipo
    `BillingProvider = 'google_play' | 'lemon'` (`frontend/src/lib/billing.ts`, `planLimits.ts`): renombrar
    exige migración; se deja para la misión de integración.
  - Comentarios y docstrings que nombran Lemon: `plan_guard.py`, `routers/account.py`,
    `routers/google_play.py`, `models.py:398`, `PlayStoreActions.tsx`, `SettingsHome.tsx`,
    `SettingsPage.tsx`, `useEffectivePlan.ts`, `pricing.ts`, la migración `a3f6c8e2d1b9` y los tests del
    webhook (`test_billing`, `test_hardening`, `test_ai_lock`, `test_google_play`, `playBilling.test`,
    `myAccount.test`).
