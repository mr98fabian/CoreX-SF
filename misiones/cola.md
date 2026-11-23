# Cola de misiones — Oficina de Mijo
Estados: `pendiente` → `en-curso` → `en-auditoria` → `completada` (solo Mijo marca
completada, tras auditar y con orden de Fabian). Claude ejecuta; Mijo audita; Fabian
aprueba merges.
## CoreX-SF (la app)
| # | Misión | Estado | Nota |
|---|--------|--------|------|
| 0 | Limpieza completa y optimización de rendimiento | completada | PRIORIDAD ALTA: app lenta en producción; archivo `misiones/2026-11-22-limpieza-optimizacion.md` |
| 1 | Textos legales: Lemon Squeezy → Stripe Managed Payments (ES/EN) | completada | Prompt de Mijo ya escrito (mision-legal-stripe-mor) |
| 2 | Push: plantillas en inglés según idioma del dispositivo | en-auditoria | Hoy el copy de push es solo ES; archivo `misiones/2026-11-22-push-plantillas-en.md` |
| 2b | Push: pulido visual de notificaciones (Android) | en-auditoria | Pedido de Fabian: elegantes y profesionales; misma rama `feat/push-en-y-pulido`; archivo `misiones/2026-11-22-push-pulido-visual.md` |
| 3 | Kit IA: neutralizar la marca en `lib/aiKit.ts` | pendiente | Opcional |
| 4 | Correos de notificación transaccionales | pendiente | Cola original de lanzamiento |
| 5 | Calendario que se actualiza solo | pendiente | Cola original de lanzamiento |
| 6 | Apple IAP (pagos iOS) | bloqueada | Espera inscripción Apple Developer + Mac |
| 8 | Integración de Stripe Managed Payments (checkout web) | completada | Deuda de la misión 1: la compra web falla (Lemon rechazado); archivo `misiones/2026-11-22-integracion-stripe.md` |
## Fase 2 — Equipo de agentes QA (SOLO con la app al 100%)
Probador (Playwright, flujos reales tras cada deploy + smoke test diario), Revisor UX
(reseña priorizada) y Regresión (flujos críticos tras cada merge). Los hallazgos entran
a esta cola como misiones. Orden de Fabian (2026-11-22): primero la app al 100%.
## Reglas de la cola
- Una misión a la vez por repo, salvo que Fabian diga lo contrario.
- Toda misión terminada queda `en-auditoria` hasta que Mijo la revise.
