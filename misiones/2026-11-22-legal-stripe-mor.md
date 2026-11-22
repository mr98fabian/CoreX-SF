# Misión: Textos legales: Lemon Squeezy → Stripe Managed Payments (ES/EN)
- **ID:** 2026-11-22-legal-stripe-mor
- **Estado:** en-curso
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
- **Fecha:**
- **Rama y commit:**
- **Verificaciones corridas y resultado:**
- **Desviaciones o dudas:**
