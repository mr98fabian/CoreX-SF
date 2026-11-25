# Misión: Fix — HTTP 500 intermitente en el primer acceso de cuentas nuevas
- **ID:** 2026-11-25-carrera-primer-acceso
- **Estado:** en-curso
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
- **Fecha:**
- **Rama y commit:**
- **Evidencia de los criterios de aceptación** (uno a uno, con el número de la tabla):
  1.
- **Checklist de auto-verificación** (cada ítem con su artefacto; una marca sola no vale):
  - [ ] Diff auto-revisado → `git diff --stat origin/main...HEAD`
  - [ ] Archivos fuera de alcance = 0 → `git diff --name-only origin/main...HEAD`
  - [ ] Migraciones = 1 head → sin migraciones + diff que lo prueba
  - [ ] Sin `console.log`, secretos ni `any` nuevos
  - [ ] Puerta compartida → salida final de `python scripts/verify.py`
  - [ ] Criterios de aceptación uno a uno → ver la sección anterior
- **Desviaciones o dudas:**
- **Fallos preexistentes** (si los hay):
