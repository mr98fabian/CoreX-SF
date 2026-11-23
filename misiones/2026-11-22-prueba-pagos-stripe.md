# Misión: Prueba de pagos demo de Stripe (teléfono virtual)
- **ID:** 2026-11-22-prueba-pagos-stripe
- **Estado:** en-curso
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
- **Fecha:** 2026-11-22 (en curso)
- **Resultado por paso:**
  - Panel de Stripe (sandbox «New business», el que tiene el webhook «KoreX subscriptions webhook»
    → Railway): 0 suscripciones, 0 entregas de webhook. En los logs no aparece ninguna sesión de
    checkout, solo la creación del producto y del precio. Todavía no se ha hecho ninguna compra.
  - La cuenta de Fabian ya tiene KoreX Anual: Planes muestra «Tu plan actual» y no tiene botón de
    pago. Hace falta una cuenta sin plan (alias +stripe) para el paso 2.
- **Dudas técnicas:**
- **Errores:**
  - **«1 mes gratis» en la web contra 7 días en el checkout** (FTC: lo mostrado ≠ lo cobrado). Vino del
    cambio a `TRIAL_DAYS = 7` de la Misión 8. Las tarjetas de plan, el modal de compra y la landing
    tenían el mes escrito a mano. Por orden de Fabian se corrige en `fix/prueba-7-dias-copy`
    (b862fc5): el texto sale de `TRIAL_DAYS` y un test lo protege. Sin merge.
  - El webhook está fijado a la API `2024-12-18.acacia` (más antigua que la `basil` del checkout).
    El backend lee los dos formatos (`_period_end`, `_invoice_subscription`). Se confirma con la
    primera entrega real.
