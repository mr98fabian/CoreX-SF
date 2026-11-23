# Misión: Correos de notificación (canal email del motor de avisos)
- **ID:** 2026-11-23-correos-notificacion
- **Estado:** en-auditoria
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
- **Fecha:** 2026-11-23
- **Rama y commit:** `feat/correos-notificacion`. Criterios en 936a80c, código en 2d07d11, este Reporte en el commit de cabeza.
- **Qué se hizo:**
  - Migración `a7d4e2c9f1b3` (sobre `e5a9c3f1b7d2`). `user_settings` gana `email_enabled` (activo por defecto),
    `language` (`es`) y `timezone`. Nueva tabla `email_log` (usuario, evento, clave, idioma, estado, detalle,
    fecha local), con RLS activo y cero políticas.
  - `backend/email_engine.py`:
    - plantillas ES/EN (asunto, título, cuerpo, botón) y HTML sobrio (slate + ámbar #F59E0B);
    - pie «Las cifras son estimaciones…» + «Puedes desactivar estos correos en Ajustes → Notificaciones»;
    - cliente Resend por HTTP, modo seco y lectura de la dirección desde Supabase Auth en el momento del
      envío (nunca se registra).
  - `push_engine.run_once` decide el canal por usuario:
    - push si tiene teléfono vivo y el push activo;
    - si el push no cubrió el aviso (sin teléfono, push apagado o fallo de FCM), correo cuando `email_enabled`;
    - tope de 1 aviso/día, silencio 22:00–07:00, prioridad y dedupe, contando `push_log` + `email_log`
      (estados `sent`/`dry_run`);
    - el demo nunca recibe;
    - las reglas y el copy del push no cambian.
  - `main.py`: el bucle horario arranca si hay push **o** correo (o modo seco) y el log dice qué canales.
  - Endpoints (solo sesión): `GET/PUT /api/push/email` (preferencia) y `PUT /api/push/profile`
    (idioma + zona horaria).
  - Frontend:
    - `EmailToggleRow` «Correos de notificación» bajo el switch del push (web y app);
    - `lib/noticeProfile.ts` sincroniza idioma y zona al iniciar sesión (`PushSetup`) y al cambiar de
      idioma (`LanguageContext`).
  - `scripts/email_dry_run.py`: corre el motor real en modo seco sobre SQLite en memoria, con la red
    bloqueada, e imprime los 6 correos.
- **Evidencia de los criterios de aceptación:**
  1. **1a, sin clave:** `test_without_resend_nothing_runs_and_nothing_is_recorded` passed.
     - Sin ningún canal configurado → `{"skipped": "not configured"}`.
     - Con push y sin Resend, el motor corre completo: `emailed=0`, 0 llamadas al proveedor, 0 filas en
       `email_log`.
     - Clave sin `EMAIL_FROM`: sigue sin estar configurado.
     - En el arranque local real el log dijo: `Notices: neither FIREBASE_SERVICE_ACCOUNT_JSON nor
       RESEND_API_KEY+EMAIL_FROM set, nothing will be sent`.
  2. **1b, modo seco:** `test_dry_run_logs_kind_and_language_without_network` passed.
     - `httpx.AsyncClient` sustituido por uno que revienta si se usa.
     - El log contiene `email dry-run: kind=corte lang=en subject='Your Visa Oro card closes in 2 days'`.
     - La dirección no aparece en el log; la fila de `email_log` queda con `status=dry_run`.
     - `python scripts/email_dry_run.py` (red bloqueada) imprime los 6 correos y termina con
       `dry run OK: 6 e-mails, 0 network calls`. Extracto:
       ```
       korex.email email dry-run: kind=corte lang=en subject='Your Visa Oro card closes in 2 days'
       Subject: Your Visa Oro card closes in 2 days
       Your Visa Oro card closes on November 25 with an estimated balance of $430.00. Pay it before it closes and it reports clean.
       See my accounts: https://korexf.com/dashboard/accounts/manage
       korex.email email dry-run: kind=mision lang=es subject='Tu misión de hoy: $150.00 a Visa Oro'
       Paga $150.00 a Visa Oro. Es el movimiento de hoy según tu plan estimado.
       korex.email email dry-run: kind=celebracion lang=es subject='Deuda saldada: Tarjeta chica llegó a $0'
       Tarjeta chica llegó a $0. Una deuda menos en tu camino.
       ```
       `--html` escribe cada HTML en `scripts/out/` (ignorado por git).
  3. **2, paridad:**
     - `test_parity_every_kind_in_both_languages_with_the_push_variables` passed: mismos 3 eventos que
       `push_engine.TEMPLATES`, ES y EN, y los mismos `{placeholders}` por evento que el push.
     - `test_parity_each_mail_renders_with_footer_and_no_leftover_braces` passed (6 casos, 3 × 2): sin llaves
       sueltas, con pie legal y opt-out, con #F59E0B y sin palabras de venta.
     - `test_parity_user_text_is_escaped_in_the_html` passed: el nombre de la cuenta va escapado.
  4. **3, dedupe y tope entre canales**, todos passed:
     - `test_dedup_push_covered_the_notice_so_no_email`: el push entrega y el correo no sale.
     - `test_covered_by_email_when_there_is_no_phone_and_never_twice`: 1 correo en dos corridas.
     - `test_dedup_a_failed_push_falls_back_to_email_and_push_does_not_repeat_it`.
     - `test_cap_one_notice_a_day_summing_channels`: correo a las 9, nada a las 11 aunque haya celebración
       pendiente, y push al día siguiente.
     - `test_cap_quiet_hours_in_the_synced_time_zone`.
     - `test_cap_priority_and_the_mission_in_english`.
     - `test_email_off_demo_and_no_address_get_nothing`.
  5. **4, errores del proveedor**, todos passed:
     - `test_provider_error_is_recorded_and_retried_next_hour`: fila `error` con `http 500 …` y `sent` a la
       hora siguiente.
     - `test_provider_error_an_exploding_mailer_never_stops_the_engine`: 2 usuarios, 2 filas
       `engine: RuntimeError`, el run termina.
     - `test_provider_error_resend_client_maps_http_answers`: 200 → `sent`, 422 → `http 422 validation_error`.
  6. **5, Ajustes y sincronización:**
     - `test_email_preferences_default_on_toggle_and_profile_sync` y `test_email_preferences_need_a_session`
       passed (401 sin sesión, 403 con token de IA).
     - `frontend/src/components/emailNotices.test.tsx`: 5 passed (switch lee y guarda, se oculta sin servidor,
       sync de idioma y zona, no lanza, el cambio de idioma sincroniza).
     - Preview local (demo, SQLite) en `/dashboard/settings/advanced?section=notifications`: el switch
       «Correos de notificación» aparece encima de las preferencias y al tocarlo hace
       `PUT http://127.0.0.1:8001/api/push/email → 200 OK`.
  7. **6, migración:** `test_email_migration_one_head_up_and_down` passed (heads == `["a7d4e2c9f1b3"]`,
     sube con defaults `True/es/None`, crea `email_log`, contiene `ENABLE ROW LEVEL SECURITY`, baja limpia).
     `alembic upgrade head` sobre el `korex.db` local aplicó `e5a9c3f1b7d2 -> a7d4e2c9f1b3` sin error.
     `alembic heads` → `a7d4e2c9f1b3 (head)`.
  8. **7, puerta:** `python scripts/verify.py` → `backend:pytest OK`, `backend:alembic-heads OK`,
     `frontend:vitest OK`, `frontend:eslint OK`, `frontend:build OK`, `verify: OK`.
     Conteos: pytest **645 passed** (622 + 23 nuevos); vitest **337 passed** (55 archivos).
- **Checklist de auto-verificación:**
  - [x] Diff auto-revisado → `git diff --stat origin/main...HEAD`: `17 files changed, 1106 insertions(+), 38 deletions(-)`
        (antes de este Reporte).
  - [x] Archivos fuera de alcance = 0 → `git diff --name-only origin/main...HEAD`:
        - `.gitignore`, `scripts/email_dry_run.py`;
        - backend: `alembic/versions/a7d4e2c9f1b3_email_notices.py`, `email_engine.py`, `main.py`, `models.py`,
          `push_engine.py`, `routers/push.py`, `tests/test_email_notices.py`;
        - frontend: `components/EmailToggleRow.tsx`, `components/PushSetup.tsx`, `components/emailNotices.test.tsx`,
          `contexts/LanguageContext.tsx`, `features/settings/SettingsPage.tsx`, `lib/noticeProfile.ts`;
        - misiones: este archivo y `cola.md`.

        Todas son de datos, motor, plantillas, Ajustes, envío o su prueba. Nada de iOS, Billing ni Stripe.
  - [x] Migraciones = 1 head → `a7d4e2c9f1b3 (head)`.
  - [x] Sin `console.log`, secretos ni `any` nuevos → el grep de la plantilla devuelve una sola línea:
        `+httpx.AsyncClient = NoNetwork  # proof: any HTTP call would blow up`. Es un falso positivo: la palabra
        «any» de un comentario cae en el patrón `: any\b`. No hay tipos `any`, `console.log` ni claves.
        `re_test_dummy` es un valor ficticio de los tests.
  - [x] Puerta compartida → `verify: OK` (arriba).
  - [x] Criterios uno a uno → sección anterior.
- **Desviaciones o dudas:**
  - Además de `email_enabled` y `language`, se añadió `user_settings.timezone`. Sin ella, a un usuario sin
    teléfono no se le pueden aplicar las horas de silencio en su zona (`push_devices` era la única fuente
    de zona). La app la envía junto con el idioma.
  - Si el push falla (error transitorio de FCM), el aviso sale por correo esa misma hora en lugar de
    esperar a la siguiente. El dedupe impide luego que el push lo repita. Interpreté «el evento no quedó
    cubierto por push» así. Si Mijo prefiere esperar al reintento del push, es un cambio de una línea.
  - El correo solo evalúa a usuarios con fila en `user_settings`, que la app crea al sincronizar idioma
    y zona. Un usuario que nunca abrió la app tras este deploy no recibe correo hasta su próximo inicio
    de sesión. Es deliberado: sin idioma ni zona conocidos, no se le escribe.
  - Un error del proveedor se reintenta cada hora (fuera del silencio) y deja una fila `error` por
    intento. Hoy no hay tope de reintentos.
  - El modo seco cuenta para el tope y el dedupe igual que un envío real. Activarlo en producción
    «gasta» el aviso del día de cada usuario sin enviarle nada: no activarlo en Railway salvo para una
    prueba consciente.
- **En manos de Fabian:**
  1. Crear la cuenta de Resend y verificar el dominio `korexf.com` (registros DNS SPF/DKIM que da Resend).
  2. Pegar en Railway `RESEND_API_KEY` y `EMAIL_FROM` (p. ej. `KoreX <avisos@korexf.com>`). Sin las dos, el
     canal sigue apagado.
  3. Comprobar que `SUPABASE_SERVICE_ROLE_KEY` sigue en Railway: el motor lee de ahí la dirección de cada
     usuario. Sin ella, cuenta `no_address` y no envía.
  4. Aplicar la migración `a7d4e2c9f1b3` en Supabase con el deploy habitual.
