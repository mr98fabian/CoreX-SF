# Cola de misiones — Oficina de Mijo
Estados: `pendiente` → `en-curso` → `en-auditoria` → `completada` (solo Mijo marca
completada, tras auditar y con orden de Fabian). Claude ejecuta; Mijo audita; Fabian
aprueba merges.
## CoreX-SF (la app)
| # | Misión | Estado | Nota |
|---|--------|--------|------|
| 0 | Limpieza completa y optimización de rendimiento | completada | PRIORIDAD ALTA: app lenta en producción; archivo `misiones/2026-11-22-limpieza-optimizacion.md` |
| 1 | Textos legales: Lemon Squeezy → Stripe Managed Payments (ES/EN) | completada | Prompt de Mijo ya escrito (mision-legal-stripe-mor) |
| 2 | Push: plantillas en inglés según idioma del dispositivo | completada | Hoy el copy de push es solo ES; archivo `misiones/2026-11-22-push-plantillas-en.md` |
| 2b | Push: pulido visual de notificaciones (Android) | completada | Pedido de Fabian: elegantes y profesionales; misma rama `feat/push-en-y-pulido`; archivo `misiones/2026-11-22-push-pulido-visual.md` |
| 3 | Kit IA: neutralizar la marca en `lib/aiKit.ts` | en-auditoria | Rama `chore/kit-ia-neutro`; archivo `misiones/2026-11-22-kit-ia-neutro.md` |
| 4 | Correos de notificación (canal email del motor de avisos) | en-auditoria | Rama `feat/correos-notificacion`; archivo `misiones/2026-11-23-correos-notificacion.md` |
| 5 | Calendario que se actualiza solo (serie diaria real del motor) | en-auditoria | Rama `feat/calendario-serie-diaria`; archivo `misiones/2026-11-23-calendario-serie-diaria.md` |
| 6 | Apple IAP (pagos iOS) | bloqueada | Espera inscripción Apple Developer + Mac |
| 7 | Command-center rápido + caché stale-while-revalidate | en-auditoria | Rama `perf/command-center-cache`; archivo `misiones/2026-11-22-command-center-cache.md` |
| 8 | Integración de Stripe Managed Payments (checkout web) | completada | Deuda de la misión 1: la compra web falla (Lemon rechazado); archivo `misiones/2026-11-22-integracion-stripe.md` |
| 9 | Prueba de pagos demo de Stripe (teléfono virtual) | en-curso | Prueba de punta a punta de la misión 8 en modo test; archivo `misiones/2026-11-22-prueba-pagos-stripe.md` |
| 10 | CI en GitHub con bloqueo real de merge | en-auditoria | Rama `chore/ci-bloqueo`; archivo `misiones/2026-11-22-ci-bloqueo.md` |
| 11 | Verificación en origen (aceptación antes del código + hook que bloquea) | en-auditoria | Rama `chore/verificacion-origen`; archivo `misiones/2026-11-22-verificacion-origen.md` |
| 12 | Fase 2: equipo de agentes QA (Probador, Revisor UX, Regresión) | en-auditoria | Rama `chore/equipo-qa`; archivo `misiones/2026-11-24-equipo-qa.md` |
| 17 | Fuente única de números (corrección de la Misión 14, D1–D4) | en-auditoria | Rama `feat/fuente-unica-numeros`; archivo `misiones/2026-11-24-fuente-unica-numeros.md`; Mijo corre la sonda de concordancia contra producción tras el despliegue |
| 16 | Fix: HTTP 500 intermitente en el primer acceso de cuentas nuevas (carrera en get-or-create) | en-auditoria | Rama `fix/carrera-primer-acceso`; archivo `misiones/2026-11-25-carrera-primer-acceso.md`; hallazgo QA canario-1004; el Probador QA confirma en su siguiente corrida |
| 18 | Rediseño «Cobre a la vista» — A: Cimientos (tokens, línea, iconos, barra, apertura) | en-auditoria | Rama `feat/rediseno-cimientos`; archivo `misiones/2026-11-25-rediseno-cimientos.md`; fuente: `misiones/2026-11-25-direccion-de-arte.md`; criterio 8 (fotogramas ≤ 32 ms) NO cumplido: decide Fabian |
| 19 | Rediseño «Cobre a la vista» — B: Composición (5 pantallas, ceremonia de $0, login, estados) | pendiente | Rama `feat/rediseno-composicion`; precondición: misión 18 fusionada |
## Fase 2 — Equipo de agentes QA (SOLO con la app al 100%)
Probador (Playwright, flujos reales tras cada deploy + smoke test diario), Revisor UX
(reseña priorizada) y Regresión (flujos críticos tras cada merge). Los hallazgos entran
a esta cola como misiones. Orden de Fabian (2026-11-22): primero la app al 100%.
## Reglas de la cola
- Una misión a la vez por repo, salvo que Fabian diga lo contrario.
- Toda misión terminada queda `en-auditoria` hasta que Mijo la revise.
