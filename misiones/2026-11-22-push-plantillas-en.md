# Misión: Push — plantillas en inglés según idioma del dispositivo
- **ID:** 2026-11-22-push-plantillas-en
- **Estado:** en-curso
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
- **Fecha:**
- **Rama y commit:**
- **Verificaciones corridas y resultado:**
- **Desviaciones o dudas:**
