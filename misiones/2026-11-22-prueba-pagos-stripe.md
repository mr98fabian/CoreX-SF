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
- **Fecha:**
- **Resultado por paso:**
- **Dudas técnicas:**
- **Errores:**
