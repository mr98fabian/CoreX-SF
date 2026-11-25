# Misión: Fix — HTTP 500 intermitente en el primer acceso de cuentas nuevas
- **ID:** 2026-11-25-carrera-primer-acceso
- **Estado:** en-auditoria
- **Rama:** fix/carrera-primer-acceso
- **Repo:** CoreX-SF
## Objetivo
Que el primer acceso de una cuenta recién confirmada nunca devuelva 500 porque varias peticiones
paralelas intentan crear a la vez su fila por usuario (`user_settings` y similares).
## Contexto
- Hallazgo del Equipo QA (misión 12, canario-1004): ~1 de cada 3 registros nuevos recibe 500 en
  `GET /api/settings` en el primer acceso.
- Causa (Mijo): `backend/routers/settings_api.py::_get_or_create` hace SELECT y, si no hay fila,
  INSERT sin manejar el conflicto. El frontend dispara en paralelo settings, push/profile, etc.;
  dos peticiones ven «no hay fila», insertan las dos y la segunda choca con la unicidad de
  `user_id` → `IntegrityError` → 500.
- El mismo SELECT→INSERT sin protección existe en `routers/push.py` (preferences, email,
  profile), `routers/strategy.py` (shield, attack-percentage), `routers/coach.py::_profile`
  (`coach_profile`), `routers/sync.py` (`sync_state`) y `routers/house.py` (`house_goal`); todas
  esas tablas tienen `user_id` único.
- Límite: mismo contrato de endpoints (rutas y respuestas). Debe funcionar en Postgres (prod) y
  SQLite (local/tests).
## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | N peticiones simultáneas de primer acceso (`GET /api/settings` + `PUT /api/push/profile`) para un usuario sin fila → todas 200 y exactamente UNA fila en `user_settings` | `pytest tests/test_carrera_primer_acceso.py` (SQLite en archivo, hilos reales, barrera que fuerza a todos a pasar el SELECT antes del INSERT) | passed |
| 2 | El test del criterio 1 falla sin el arreglo | mismo test contra el código de `main` (antes del fix) | failed con `IntegrityError` / 500 (evidencia en rojo en el Reporte) |
| 3 | El patrón vive en UN solo lugar reutilizable | `helpers.get_or_create_for_user`; `grep -rn "or UserSettings(\|or SyncState(\|or HouseGoal(" backend/routers` | helper único; grep vacío |
| 4 | Mismo contrato: suites existentes de settings/push/strategy/coach/sync/house siguen verdes | `python scripts/verify.py` (incluye pytest completo) | `verify: OK` (exit 0) |
| 5 | Puerta compartida en verde | `python scripts/verify.py` | `verify: OK` (exit 0) |
| 6 | Sin migraciones | `git diff --name-only origin/main...HEAD` | ninguna ruta bajo `backend/alembic/` |
| 7 | CI verde en el PR | checks `backend` y `frontend` del PR | success |
| 8 | Confirmación en producción | Siguiente corrida del Probador QA (registro de cuenta nueva) | sin 500 en el primer acceso — **pendiente de esa corrida** |
## Pasos
1. Helper `get_or_create_for_user(session, model, user_id, **defaults)` en `backend/helpers.py`:
   `INSERT … ON CONFLICT (user_id) DO NOTHING` + SELECT (Postgres y SQLite).
2. Sustituir los SELECT→INSERT de los routers listados en Contexto por el helper.
3. Test de concurrencia; evidencia en rojo contra el código previo.
## No tocar
- Frontend (las peticiones paralelas son legítimas; el backend debe aguantarlas).
- `subscriptions` (filas creadas por webhooks, no en el primer acceso).
- Migraciones / esquema.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-25
- **Rama y commit:** `fix/carrera-primer-acceso` — criterios `bf57fd7`, fix + test `d6fde95` (desde `main` `b607c69`)
- **Evidencia de los criterios de aceptación:**
  1. `pytest tests/test_carrera_primer_acceso.py -q` → `5 passed` (endpoint: 6 peticiones paralelas
     3× `GET /api/settings` + 3× `PUT /api/push/profile` → todas 200, `count(user_settings) == 1`;
     helper con 6 hilos para `user_settings`, `coach_profiles`, `sync_state`, `house_goals` → un solo id, una fila).
  2. **Rojo sin el arreglo** (mismo test contra `routers/` de `main`, antes de `d6fde95`):
     ```
     E   AssertionError: statuses=[500, 500, 200, 500, 500, 500] bodies=['{"error":"INTERNAL_ERROR",...
     [ERROR] korex: [2c36e998] Unhandled error on PUT /api/push/profile: IntegrityError:
       (sqlite3.IntegrityError) UNIQUE constraint failed: user_settings.user_id
     FAILED tests/test_carrera_primer_acceso.py::test_first_access_parallel_requests_all_200_and_one_row
     ```
  3. Helper único `backend/helpers.py::get_or_create_for_user` (`INSERT … ON CONFLICT (user_id) DO NOTHING`
     + SELECT; dialectos `postgresql` y `sqlite`). Lo usan `settings_api._get_or_create`, `push` (preferences,
     email, profile), `strategy` (shield, attack-percentage), `coach._profile`, `sync.mark`, `house` (PUT).
     `grep -rn "or UserSettings(\|or SyncState(\|or HouseGoal(\|or CoachProfile(" backend/routers` → vacío (exit 1).
  4. Contrato intacto: mismas rutas, mismos cuerpos (el test 1 compara los JSON); suite completa en la puerta (ver 5).
  5. Puerta compartida: ver salida al final del checklist.
  6. Sin migraciones: el diff no toca `backend/alembic/` (lista abajo); el esquema ya tenía `user_id` único.
  7. CI: ver checks del PR.
  8. **Pendiente:** el Probador QA debe confirmar en su siguiente corrida (registro de cuenta nueva,
     canario-1004) que el 500 del primer acceso no reaparece.
- **Checklist de auto-verificación:**
  - [x] Diff auto-revisado → `git diff --stat origin/main...HEAD`:
    ```
    backend/helpers.py                           | 33 ++++++++++
    backend/routers/coach.py                     |  8 +--
    backend/routers/house.py                     |  4 +-
    backend/routers/push.py                      |  7 +-
    backend/routers/settings_api.py              | 17 ++---
    backend/routers/strategy.py                  | 14 ++--
    backend/routers/sync.py                      |  3 +-
    backend/tests/test_carrera_primer_acceso.py  | 96 ++++++++++++++++++++++++++++
    misiones/2026-11-25-carrera-primer-acceso.md | 55 ++++++++++++++++
    misiones/cola.md                             |  1 +
    ```
  - [x] Archivos fuera de alcance = 0 → la lista de arriba: helper, los 6 routers con get-or-create por
        usuario, el test nuevo y los archivos de misión. Nada de frontend ni `alembic/`.
  - [x] Migraciones → sin migraciones (ninguna ruta `backend/alembic/` en el diff).
  - [x] Sin `console.log`, secretos ni `any` nuevos → única coincidencia: la línea del propio checklist
        de esta ficha (`+  - [ ] Sin \`console.log\`…`), no código.
  - [x] Puerta compartida → `python scripts/verify.py`: 
    ```
    verify: backend:pytest OK (38s)
    verify: backend:alembic-heads OK (1s)
    verify: frontend:vitest OK (59s)
    verify: frontend:eslint OK (15s)
    verify: frontend:build OK (20s)
    verify: OK                             (exit 0)
    ```
  - [x] Criterios de aceptación uno a uno → sección anterior.
- **Desviaciones o dudas:**
  - El arreglo se extendió a `coach_profiles`, `sync_state` y `house_goals` (mismo patrón, `user_id` único),
    como pide el paso 2. `subscriptions` queda fuera: sus filas las crean webhooks, no el primer acceso.
  - El helper hace commit del INSERT antes de que el endpoint aplique sus cambios (antes iba todo en un
    commit). Inocuo: se llama al principio de cada endpoint, sin cambios pendientes en la sesión.
  - Trabajado en un worktree aparte (`KoreX-wt-carrera`) para no tocar la carpeta compartida.
- **Fallos preexistentes:** ninguno.
