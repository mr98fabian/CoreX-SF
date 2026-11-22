# Misión: Integración de Stripe Managed Payments (checkout web)
- **ID:** 2026-11-22-integracion-stripe
- **Estado:** en-curso
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
- **Fecha:**
- **Rama y commit:**
- **Verificaciones corridas y resultado:**
- **Desviaciones o dudas:**
