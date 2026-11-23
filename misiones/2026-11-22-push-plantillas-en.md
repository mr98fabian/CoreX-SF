# Misión: Push — plantillas en inglés según idioma del dispositivo
- **ID:** 2026-11-22-push-plantillas-en
- **Estado:** completada
- **Rama:** feat/push-en-y-pulido
- **Repo:** CoreX-SF
## Objetivo
Que cada aviso push llegue en el idioma de la app del usuario (ES o EN), no siempre en español.
## Contexto
El motor de push en vivo (`backend/push_engine.py`) manda SOLO textos en español (detectado en la
auditoría de notificaciones). La app ya es bilingüe (ES/EN). Se ejecuta en la misma rama que la
misión 2b (`2026-11-22-push-pulido-visual`).
## Pasos
1. Al registrar el dispositivo (`POST /api/push/devices`), guardar también el idioma de la
   app/dispositivo (`language`, `es` por defecto).
2. Plantillas EN de los TRES tipos de aviso (corte en 2 días, misión del día, celebración de deuda
   en $0), con las mismas variables y el mismo tono que las ES.
3. El motor elige la plantilla según el `language` del dispositivo; sin idioma → ES.
4. Migración solo si hace falta la columna (una sola, `alembic heads` == 1).
## Criterios de aceptación
- [ ] Tests del motor en AMBOS idiomas (los 3 tipos).
- [ ] pytest + vitest + eslint + build en verde (anotar salida en el Reporte).
- [ ] Si hay migración: `alembic heads` == 1.
## No tocar
- Nada de iOS. Nada de Google Play Billing/RTDN ni de Stripe.
- Reglas del motor (disparadores, topes, horarios).
## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-22
- **Rama y commit:** `feat/push-en-y-pulido`, commit 73adb64 (el Reporte va en el commit de cabeza).
  Base: main c87db24.
- **Qué se hizo:**
  - `POST /api/push/devices` acepta `language` y lo guarda normalizado en `push_devices.language`:
    `en`, `en-US` → `en`; cualquier otro valor o ninguno → `es`.
  - Migración **e5a9c3f1b7d2** (sobre d2f7b3c9e4a6): columna `language`, default `es` para los teléfonos
    ya registrados. Se probó subida y bajada en un test. No toca RLS (la tabla ya lo tenía).
  - `push_engine.TEMPLATES`: los 3 avisos en ES y EN con las mismas variables. Los textos ES no
    cambian ni una letra (los tests viejos de copia exacta siguen pasando). EN:
    - corte: «Statement in 2 days» / «Your {tarjeta} card closes on November 25 with a $430.00
      balance. Pay before it closes and report clean.»
    - misión: «Today's mission» / «Pay $150.00 to {cuenta}. It's today's move.»
    - celebración: «Debt paid off! 🎉» / «{deuda} hit $0. One less debt.»
  - El motor elige la plantilla por teléfono: si un usuario tiene uno en ES y otro en EN, cada uno
    recibe la suya, y el tope de 1 aviso al día se cuenta una sola vez. Disparadores, topes y horarios
    sin cambios.
  - App: el registro manda el idioma de la app (`korex-language`). Al cambiar el idioma en la app,
    el teléfono se vuelve a registrar al momento (import diferido, sin peso extra en el bundle).
- **Verificaciones corridas y resultado:**
  - pytest **622 passed**: incluye los 3 tipos × 2 idiomas con texto exacto, teléfonos mixtos,
    respaldo a ES y la migración.
  - vitest **54 archivos / 331 tests**: el idioma viaja con el token y se re-registra al cambiarlo.
  - `eslint --max-warnings 0` OK; `npm run build` OK; `alembic heads` = **1** (`e5a9c3f1b7d2`).
- **Desviaciones o dudas:**
  - Los teléfonos ya registrados quedan en ES hasta el próximo arranque de la app, que re-registra
    el token con su idioma.
  - El importe usa `$` como hasta hoy; la moneda del usuario no se tocó (fuera de alcance).
  - `test_billing.py` exigía que el head fuera exactamente `d2f7b3c9e4a6`; ahora exige un solo head,
    como ya hacía `test_push.py`.
