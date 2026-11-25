# Misión 17: Construcción de la fuente única de números (corrección de la Misión 14)
- **ID:** 2026-11-24-fuente-unica-numeros
- **Estado:** en-auditoria
- **Rama:** feat/fuente-unica-numeros
- **Repo:** CoreX-SF

## Objetivo
Que dos pantallas no puedan volver a contradecirse: un solo motor de proyección (`debt_path`), una
función dueña por concepto y tests de concordancia en CI. Fuente de verdad: los entregables de la
Misión 14 (`misiones/2026-11-24-auditoria-numeros/`, PR #13); si esta misión los contradice, mandan ellos.

## Contexto — decisiones de Fabian (2026-11-24, reglas de la casa)
- **D1:** una obligación «falta» solo si la caja proyectada en su fecha (ingresos y gastos fechados,
  escudo intacto) no la cubre.
- **D2:** corte a $0 solo cuando la caja proyectada lo cubre; si no, mínimo + avalancha, dicho en pantalla.
- **D3:** «Disponible para tu plan» = `get_daily_mission()["ataque"]`; el efectivo se muestra aparte.
- **D4:** fecha de libertad y plan desde la caja real fechada (`debt_path`); prohibido el excedente
  promedio desde el día 1 del mes en curso.

## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | Tests de concordancia §4 (personas fijas, `today` fijo, vía HTTP) | `cd backend && ./venv/Scripts/python.exe -m pytest tests/test_concordancia.py -v` | todos `passed`; en `main` nacen en rojo (salida pegada en el Reporte) |
| 2 | Caso #1: el Calendario ya no promete la baja fantasma | `pytest tests/test_concordancia.py -k caso_real` | cierre de nov = deuda de hoy − pagos fechados del GPS + interés diario acumulado (±$0.01); bajas ≠ 7,667.78 |
| 3 | La demo de María se concilia sola | `pytest tests/test_concordancia.py -k maria` | reserva < deuda total; GPS sin caja bajo el escudo por obligaciones; `plan.meses` = meses calendario |
| 4 | Ninguna pantalla de la tabla §3 calcula dinero por su cuenta | `cd frontend && npx vitest run src/lib/fuenteUnica.test.ts` | `passed` (sin `* 30`, `* 365`, `/ 365`, `start - end` en esos archivos) |
| 5 | Endpoints huérfanos N-15 retirados | `pytest tests/test_concordancia.py -k huerfanos` | 404 en `/api/cashflow/projection`, `/api/notifications/summary`, `/api/notifications/upcoming`; una sola ruta `/api/cashflow/summary` |
| 6 | Suites y puerta compartida en verde | `python scripts/verify.py` | `verify: OK` (exit 0) |
| 7 | Sin migraciones nuevas | `cd backend && python -m alembic heads` + `git diff --name-only origin/main...HEAD` | 1 head, ningún archivo en `backend/alembic/versions/` |

## Pasos
1. `test_concordancia.py` en rojo.
2. Motor: `debt_path`, D1/D2 en la misión, mínimo único, interés en el tramo de caja.
3. Rewire de endpoints (freedom-path, compare, projections, tactical-gps, command-center, coach,
   dashboard, push) a las funciones dueñas.
4. Frontend: rótulos honestos y pantallas de §3 sin aritmética propia.
5. Endpoints huérfanos.

## No tocar
- Avalancha estricta, escudo y reglas de la casa fuera de D1–D4.
- Contratos fuera de los que marca la especificación.

## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-24
- **Rama y commits:** `feat/fuente-unica-numeros` desde `origin/main` 868eae6 — 553036c (criterios) · 9d1fd26 (tests en
  rojo) · 6f9b34d (motor) · 46eb700 (pantallas) · 1ba6b0e (rótulos D3 / mes que sube) · este reporte.
- **Evidencia de los criterios de aceptación:**
  1. `pytest tests/test_concordancia.py` → **43 passed** (39 + 4 del criterio del ataque, 2026-11-25). En rojo antes del motor (commit 9d1fd26, con solo
     `helpers.today` añadido): **32 failed** — `test_deuda_total_igual_en_todas` (Calendario-hoy 1,021 ≠ Inicio),
     `cierre_de_mes…[1|15|24|30]`, `ya_no_promete_la_baja_fantasma`, `reserva_una_sola_definicion`,
     `copy_de_reserva…`, `faltante_inicio_igual_gps`, `disponible_es_el_ataque`, `interes_periodos_unicos`,
     `minimo_unico_en_la_mision`, `meses_calendario` (5 ≠ 4, 15 ≠ 14, 6 ≠ 5), `maria_demo_se_concilia_sola`,
     `huerfanos_retirados`.
  2. Caso #1 (`caso_real_anon`, hoy 24-nov), salida de `/api/velocity/freedom-path` y `/api/strategy/tactical-gps`
     con el criterio final del ataque (2026-11-25):
     `{"mes": "2026-11", "inicio": 35410.63, "cierre": 34028.91, "pagos": 1550.74, "interes": 169.02, "baja": 1381.72}`;
     pagos del GPS en noviembre: 29-nov Tarjeta B 1,476.88 · 29-nov Tarjeta D 73.86 = **1,550.74** (= `pagos`, y = los
     pagos reales programados del caso). Antes: «bajas ≈ $7,667.78» igual el 1, 15, 24 y 30; ahora lo fijan
     `test_bajas_no_dependen_de_dias_pasados` y `test_caso_real_noviembre_baja_solo_los_pagos_programados`. Reserva
     6,014.24, ataque **$0**, sin faltante, primer ataque el 12-dic ($1,804.42 a Préstamo personal); copy:
     «Reservamos $6,014.24 para el corte de la Tarjeta B (29 de noviembre) y 5 pagos más hasta el 20 de diciembre.
     Hoy no sobra para atacar sin tocar tu escudo (estimado).»
  3. María (`test_maria_demo_se_concilia_sola` passed; `test_demo_persona.py` passed): reserva **$585.88** (sus
     mínimos) en vez de $18,400; las 4 tarjetas «degradadas» por D2 con copy explícito («No alcanza para dejar la
     Tarjeta de tienda en $0 antes del corte del 28 de noviembre: paga el mínimo ($80.48) antes del 5 de diciembre y
     lo demás va a la avalancha»); ataque $615.00; GPS sin caja negativa; libre en **15 meses calendario**
     (2028-02); interés evitado $30,525.41.
  4. `npx vitest run src/lib/fuenteUnica.test.ts` → **32 passed**. En `main` habría fallado:
     `git grep` en `origin/main` encuentra `sd.daily_interest_all * 30` (SettingsPage.tsx:933) y
     `mo.start - mo.end` (DebtCalendar.tsx:118).
  5. `test_huerfanos_retirados` passed: ninguna ruta GET para `/api/cashflow/projection`, `/api/notifications/summary`
     ni `/api/notifications/upcoming` (responden 404/405: `/cashflow/{id}` contesta 405 a un GET); una sola ruta
     `/api/cashflow/summary`.
  6. `python scripts/verify.py` → `backend:pytest OK · backend:alembic-heads OK · frontend:vitest OK · frontend:eslint OK ·
     frontend:build OK · verify: OK`. Backend completo: 0 fallos; frontend: 59 archivos, 392 tests.
  7. `alembic heads` → 1 head (`a7d4e2c9f1b3`); `git diff --name-only origin/main...HEAD | grep alembic/versions` → 0.
- **Verificación en navegador** (demo local, 24-nov): las 8 superficies responden 200 y concuerdan en vivo —
  deuda $33,678.50 en dashboard / freedom-path / compare / projections; fecha 2029-05-01 en compare / freedom-path /
  GPS / projections / command-center; `disponible_plan` = `mision.ataque` = 0; `reserved_for_bills` = `mision.reserva`
  = 914.53; mismos periodos de interés en Inicio y Ajustes. Inicio: «Disponible para tu plan: $0.00 · Efectivo en
  cuentas: $2,200.00». Calendario de noviembre: «sube desde hoy ≈ $112 por interés» (no hay pagos fechados el resto
  del mes); diciembre: «bajas ≈ $1,004».
- **Checklist de auto-verificación:**
  - [x] Diff auto-revisado → `git diff --stat origin/main...HEAD`: 41 archivos, +1269 / −509 (+ este reporte).
  - [x] Archivos fuera de alcance = 0 → backend (motor, helpers, routers de la §3, push), frontend (pantallas de la §3,
        landing de María), tests y `misiones/`. Nada de `alembic/versions`, nada de diseño visual.
  - [x] Migraciones = 1 head → `a7d4e2c9f1b3 (head)`, sin migraciones nuevas.
  - [x] Sin `console.log`, secretos ni `any` nuevos → el grep del diff sale vacío.
  - [x] Puerta compartida → `verify: OK`.
  - [x] Criterios uno a uno → ver arriba.
- **Desviaciones e interpretaciones (para Fabian y Mijo):**
  1. **Ataque de hoy — decidido por Fabian (2026-11-25)**: el ataque se topa a la caja de HOY menos toda la reserva,
     con el escudo intacto (`líquido − reserva − escudo`); las nóminas fechadas no cuentan para el ataque de hoy. Sigue
     topado también por el punto más bajo de la ventana. El faltante se sigue juzgando con la caja fechada (D1).
     Caso #1: ataque $0 (antes de la decisión, $1,045.04). Lo fijan `test_ataque_de_hoy_no_cuenta_nominas_fechadas`
     (3 personas) y `test_caso_real_noviembre_baja_solo_los_pagos_programados`. Tests ajustados por el tope:
     `test_daily_mission` (Amex 274.20 → 74.20), `test_suscripciones_motor` (el cargo baja el ataque, nunca más que
     él mismo) y la landing de María ($30,526 → $30,525; línea de tiempo recalculada).
  2. **D2 se aplicó también al «estado»** (pagar el estado completo), no solo al corte: es la misma regla de matar la
     tarjeta; sin esto, María volvía a reservar saldos completos tras cada corte simulado.
  3. **Suscripciones activas sin fecha**: el paseo fechado no les inventa día, así que su mes se aparta del ataque.
     Antes se atacaba con ese dinero (`test_suscripciones_motor` actualizado).
  4. **Celda de hoy del Calendario** = cierre de hoy (incluye el movimiento de hoy); los días pasados pintan la deuda
     de hoy y la ruta expone `deuda_hoy`. El test de concordancia compara esos dos, no la celda de hoy.
  5. **Ruta «solo mínimos» sin cambios** (la especificación lo pide): sigue arrancando el día 1 del mes en curso, así que
     «ahorrarás» puede incluir hasta un mes de interés de más en la base de comparación.
  6. **Aviso de corte**: si la caja no alcanza para dejar la tarjeta en $0 (D2), no se envía «paga antes del corte y
     reporta limpio»; el mínimo lo pide la misión.
  7. **«Días acortados» retirado** del historial del Plan: no tenía fuente en el motor (N-10); quedan ahorro diario
     y mensual de `payment_impact`.
  8. **Landing de María** actualizada a la salida del motor el 24-nov: 15 meses, $30,526 evitados, $2.95/día al mes 12;
     `test_demo_persona` fija ese día para que no cambie con el calendario.
  9. **Tests viejos actualizados** porque codificaban las reglas anteriores (cada uno con su nota D1–D4): daily_mission
     (3), u14 (2), analisis_v2, suscripciones_motor, minimo_unico (endpoint retirado + fecha D4), engine_calibration,
     command_center_perf (compara todo salvo lo que D1–D4 cambian), daily_series, demo_persona, push / email
     (sus usuarios de prueba ahora tienen efectivo).
  10. Rama sacada de `main` con el PR #13 (Misión 14) aún abierto: la especificación se lee de ese PR y la persona
      anonimizada viaja en `backend/tests/personas.py`.
- **Fallos preexistentes:** el `korex.db` local estaba atrasado en migraciones (`no such column: user_settings.push_enabled`,
  ya fallaba en `main`). Solo en local: sellé las migraciones ya aplicadas y añadí 4 columnas; respaldo previo en el
  scratchpad de la sesión. Nada de esto entra al repo.
