# Misión: Prueba de pagos demo de Stripe (teléfono virtual)
- **ID:** 2026-11-22-prueba-pagos-stripe
- **Estado:** en-auditoria
- **Rama:** ninguna (misión de prueba; si aparece un error se reporta, no se arregla sin orden)
- **Repo:** CoreX-SF
## Objetivo
Probar de punta a punta, en modo test de Stripe, la compra web de KoreX Anual hecha en la Misión 8.
## Contexto
Checkout web con Stripe Managed Payments (Misión 8). Llaves de PRUEBA ya en Railway; webhook
verificando firmas (verificado por Mijo). Stripe en Sandbox con el producto «KoreX Anual»
($100/año) y el webhook (6 eventos) creados.
## Pasos
1. Entrar a KoreX en el emulador (app 1.0.9) con la cuenta revisora (o una cuenta nueva con alias de
   Gmail de Fabian si la revisora ya tiene plan).
2. Planes → KoreX Anual → pagar con la tarjeta demo 4242 4242 4242 4242.
3. Panel de Stripe (prueba): sesión completada y suscripción en trialing con 7 días.
4. Webhook «KoreX subscriptions webhook»: entregas en 200; qué eventos llegaron y cuáles no.
5. KoreX: plan activo/en prueba con `store_source = stripe`.
6. Limpieza: cancelar la suscripción de prueba y anotar el estado final.
## Criterios de aceptación
- [ ] Resultado de cada paso con evidencia (capturas del checkout y del panel).
- [ ] Dudas técnicas respondidas: (a) ¿prueba de 7 días aplicada? (b) ¿qué eventos llegaron?
- [ ] Errores del flujo, textuales, sin arreglar código.
## No tocar
- Código (salvo orden). Ninguna contraseña ni llave en el Reporte ni en el repo.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-22 (preparación) · 2026-11-23 (ejecución, pasos 1–6)
- **Resultado por paso (2026-11-23, web korexf.com, Stripe sandbox «New business», modo prueba):**
  1. **Cuenta alias:** `mr98fabian+stripe@gmail.com` creada por Fabian (la contraseña la puso él; no
     consta aquí). El correo de confirmación de Supabase llegó al Gmail de Fabian; Claude abrió el
     enlace en su Chrome → sesión iniciada en `/dashboard`. Estado antes de pagar: `plan=starter`,
     `source=none`, sin `store_source`.
  2. **Pago:** Fabian pagó en la web (Planes → KoreX Anual) con 4242 4242 4242 4242. Checkout
     `cs_test_a0Oj5…` en modo `subscription`, `payment_status=paid`, `amount_total=0` (la prueba no
     cobra hoy), `adaptive_pricing` activado.
  3. **Stripe:** suscripción `sub_1Uf7beBf9O4zEnKE3BGu8j5z`, producto «KoreX Anual», badge «Free
     trial ends Nov 30, 2026», *Trialing until* Nov 30, periodo Nov 23 → Nov 30, **Managed Payments:
     Enabled**, método de pago Visa •••• 4242, metadata `user_id` de la cuenta alias. Próxima factura:
     **$106.60 el 30 de noviembre** (ver Errores). Captura de la suscripción guardada en la sesión.
  4. **Webhook «KoreX subscriptions webhook»** (`we_1UekzCBf9O4zEnKEIPKXi2zd` → Railway
     `/api/subscriptions/webhook`, API `2024-12-18.acacia`, escucha 6 eventos:
     `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`,
     `invoice.payment_failed`). Entregas, todas **200 OK**, 0 fallidas:
     - 18:29:11 CST `customer.subscription.created` → `{"ok": true, "result": "applied"}`
     - 18:29:11 CST `invoice.paid` (factura de $0 de la prueba) → `{"ok": true, "result": "paid"}`
     - 18:29:12 CST `checkout.session.completed` → `{"ok": true, "result": "applied"}`
     - 18:31:42 CST `customer.subscription.deleted` (paso 6) → `{"ok": true, "result": "applied"}`
     - No llegaron `customer.subscription.updated` ni `invoice.payment_failed`: nada los disparó en
       este flujo (ni cambio de plan ni cobro fallido), no es una falla.
  5. **KoreX** (`GET /api/subscriptions/status` de la cuenta alias, tras el pago): `plan=freedom`,
     `status=on_trial`, `source=subscription`, **`store_source=stripe`**, `accounts_limit=999`,
     `current_period_end=2026-12-01T00:29:08Z` (= 30 nov 18:29 CST, el fin de la prueba en Stripe).
  6. **Limpieza:** cancelada en Stripe «Immediately», sin reembolso (estaba en prueba). Stripe:
     **Canceled**, *Ended at* Nov 23 18:31. KoreX tras el webhook: `plan=starter`, `status=expired`,
     `source=none`, `store_source=stripe`, `accounts_limit=2`. Estado final correcto.
- **Antecedente (2026-11-22, antes de ejecutar):**
  - Panel de Stripe (sandbox «New business», el que tiene el webhook «KoreX subscriptions webhook»
    → Railway): 0 suscripciones, 0 entregas de webhook. En los logs no aparece ninguna sesión de
    checkout, solo la creación del producto y del precio. Todavía no se ha hecho ninguna compra.
  - La cuenta de Fabian ya tiene KoreX Anual: Planes muestra «Tu plan actual» y no tiene botón de
    pago. Hace falta una cuenta sin plan (alias +stripe) para el paso 2.
- **Dudas técnicas:**
  - **(a) ¿Prueba de 7 días aplicada en Managed Payments?** Sí. La suscripción tiene Managed Payments
    *Enabled* y *Trialing until* Nov 30 (7 días desde el 23); el checkout cobró $0 y KoreX recibió
    `on_trial` con fin el 1 dic 00:29 UTC.
  - **(b) ¿Llegaron `customer.subscription.*` e `invoice.*`?** Sí: `customer.subscription.created`,
    `customer.subscription.deleted` e `invoice.paid`, más `checkout.session.completed`, todos en 200 y
    aplicados. El backend leyó bien el formato `acacia` (respuestas `applied`/`paid`). No se vieron
    `customer.subscription.updated` ni `invoice.payment_failed` porque este flujo no los genera.
- **Errores y observaciones (textuales, sin arreglar código):**
  - **Precio mostrado ≠ próxima factura:** la web dice $100/año; Stripe programa **$106.60** para el
    30 nov. La diferencia la añade Managed Payments (impuesto sobre la venta). Mostrar «$100» sin «+
    impuestos» puede leerse como lo mostrado ≠ lo cobrado (FTC). Decisión de copy pendiente.
  - **`customer_portal_url` = `https://app.link.com`** en el status de KoreX durante la prueba: el
    enlace de gestión apunta a Link, no al portal de clientes de Stripe. Revisar antes de producción.
  - **Auto-cancelación del sandbox:** Stripe mostraba «Auto-cancels Feb 21, 2027» (con opción
    «Exclude from auto-cancellation»): el sandbox cancela suscripciones solo. No afecta al modo vivo.
  - El cliente en Stripe sale como «Fabian Murillo» (nombre de la tarjeta/Link), no con el alias.
  - **«1 mes gratis» en la web contra 7 días en el checkout** (FTC: lo mostrado ≠ lo cobrado). Vino del
    cambio a `TRIAL_DAYS = 7` de la Misión 8. Las tarjetas de plan, el modal de compra y la landing
    tenían el mes escrito a mano. Por orden de Fabian se corrige en `fix/prueba-7-dias-copy`
    (b862fc5): el texto sale de `TRIAL_DAYS` y un test lo protege. Sin merge.
  - El webhook está fijado a la API `2024-12-18.acacia` (más antigua que la `basil` del checkout).
    El backend lee los dos formatos (`_period_end`, `_invoice_subscription`). Se confirma con la
    primera entrega real.
