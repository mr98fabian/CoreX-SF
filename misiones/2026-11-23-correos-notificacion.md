# Misión: Correos de notificación (canal email del motor de avisos)
- **ID:** 2026-11-23-correos-notificacion
- **Estado:** en-curso
- **Rama:** feat/correos-notificacion
- **Repo:** CoreX-SF
## Objetivo
Que el motor de avisos (corte en 2 días, misión del día, celebración) llegue también por correo
a quien no recibe push, con el mismo patrón fail-closed de la casa.
## Contexto
Hoy solo hay push (`backend/push_engine.py`). Quien no tiene la app, no dio permiso o cambió de
teléfono queda mudo. Proveedor: **Resend** por HTTP, tras `RESEND_API_KEY` y `EMAIL_FROM`
(remitente en `korexf.com`). Sin la clave, el canal se omite sin errores. Se prueba en modo seco
(`EMAIL_DRY_RUN=1`). Cuenta, dominio y clave los pone Fabian en Railway.
## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1a | Sin `RESEND_API_KEY` el motor corre completo, sin excepciones y sin enviar | `pytest tests/test_email_notices.py -k without_resend` | passed: 0 llamadas al proveedor, 0 filas en `email_log` |
| 1b | Con `EMAIL_DRY_RUN=1` cada correo queda en el log con plantilla e idioma, sin red | `pytest tests/test_email_notices.py -k dry_run` + `python scripts/email_dry_run.py` | passed; la salida muestra `kind`, `lang` y el correo renderizado de los 3 eventos × ES/EN, sin llamada HTTP |
| 2 | Paridad ES/EN: 3 eventos en ambos idiomas, mismas variables que el push | `pytest tests/test_email_notices.py -k parity` | passed: mismas claves y mismos `{placeholders}` que `push_engine.TEMPLATES` por evento |
| 3 | Un evento no llega dos veces el mismo día entre canales; si el push lo cubrió, no sale correo | `pytest tests/test_email_notices.py -k "dedup or covered or cap"` | passed |
| 4 | Errores del proveedor quedan en `email_log` y no tumban el motor | `pytest tests/test_email_notices.py -k provider_error` | passed: fila `status=error`, el run termina y reintenta la hora siguiente |
| 5 | Ajustes: toggle «Correos de notificación» y la app sincroniza idioma al backend | `npx vitest run src/components/emailNotices.test.tsx` + `pytest -k email_preferences` | passed |
| 6 | Migración con cabeza única, sube y baja, RLS activo en `email_log` | `pytest -k email_migration` + `alembic heads` | passed; exactamente 1 `(head)` |
| 7 | Puerta compartida en verde | `python scripts/verify.py` | `verify: OK` (exit 0) |
## Pasos
1. Migración: `user_settings.email_enabled` (default activo), `language` (`es`), `email_log`.
2. Motor: canal por usuario (push si puede; si no, email), caps y silencio compartidos.
3. Plantillas ES/EN, sobrias, con pie para desactivar.
4. Ajustes: toggle y sincronización del idioma.
5. Cliente Resend mínimo, fail-closed, con modo seco.
## No tocar
- Reglas del motor push (disparadores, topes, horarios) ni su copy. Nada de iOS, Play Billing ni Stripe.
- Variables de Railway/Supabase: solo se declaran en el Reporte.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:**
- **Rama y commit:**
- **Evidencia de los criterios de aceptación** (uno a uno, con el número de la tabla):
- **Checklist de auto-verificación** (cada ítem con su artefacto):
- **Desviaciones o dudas:**
- **En manos de Fabian:**
