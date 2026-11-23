# Misión: Verificación en origen (aceptación antes del código + hook que bloquea)
- **ID:** 2026-11-22-verificacion-origen
- **Estado:** en-auditoria
- **Rama:** chore/verificacion-origen
- **Repo:** CoreX-SF
## Objetivo
Mover la verificación al origen: el ejecutor no puede cerrar un turno con cambios y suites en rojo,
y cada misión fija criterios comprobables antes de escribir código.
## Contexto
Hoy el ejecutor declara «tests en verde» y el auditor lo descubre todo re-corriendo las suites;
cada fallo que el ejecutor pudo cazar cuesta un ciclo completo de auditoría. Solo se tocan archivos
de oficina/herramientas (`misiones/`, `.claude/`, `scripts/`): cero código de producto.
## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba | Resultado esperado |
|---|----------|-------------------|--------------------|
| 1 | Plantilla con aceptación ejecutable y checklist con artefactos | `misiones/plantilla.md` | Secciones presentes |
| 2 | Caso (a): test roto en el árbol → el hook bloquea | comando del hook con un test roto | exit 2 + qué falló |
| 3 | Caso (b): cambios y todo en verde → el cierre pasa | comando del hook con cambios sanos | exit 0 |
| 4 | Caso (c): árbol limpio → no corre suites | comando del hook sin cambios | exit 0 inmediato, sin suites |
| 5 | Cero archivos de producto | `git diff --name-only origin/main...HEAD` | solo `misiones/`, `.claude/`, `scripts/` |
| 6 | CI verde en el PR | checks `backend` y `frontend` | success |
## Pasos
1. Plantilla: sección «Criterios de aceptación ejecutables» (antes del código) y checklist de
   auto-verificación con artefacto por ítem.
2. `scripts/verify.py` (sale 2 si algo falla; 0 sin correr nada si el árbol está limpio) y hook
   `Stop` en `.claude/settings.json` del repo.
3. INSTRUCCIONES: aceptación llena antes de codificar; `scripts/verify.py` como puerta compartida;
   vía de escape para fallos preexistentes.
4. Probar los 3 casos y pegar la evidencia.
## No tocar
- Código de producto (`backend/`, `frontend/`, etc.). Merge: lo ordena Fabian tras auditar Mijo.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-22
- **Rama y commit:** `chore/verificacion-origen`. Los criterios de aceptación entraron en el primer
  commit (b8aea87), antes de las herramientas (364613c y el ajuste de UTF-8). PR:
  https://github.com/mr98fabian/CoreX-SF/pull/5 (sin merge).
- **Qué se hizo:**
  - `misiones/plantilla.md`: sección obligatoria «Criterios de aceptación ejecutables», una tabla
    con criterio, cómo se comprueba y resultado esperado, que se llena antes del código. El Reporte
    trae «Evidencia de los criterios» uno a uno y un checklist de auto-verificación en el que cada
    ítem lleva el comando cuya salida se pega.
  - `scripts/verify.py`: la puerta compartida.
    - Corre backend:pytest, backend:alembic-heads (== 1), frontend:vitest, frontend:eslint y
      frontend:build.
    - Sale 2 con un resumen de lo que falló (las líneas `FAILED` primero). Con el árbol limpio sale 0
      sin correr nada.
    - Caché por worktree (`.git/…/verify-last-green`): un estado que ya pasó en verde no se repite.
    - Fuerza `DATABASE_URL=sqlite://` para no tocar nunca la base de producción de `backend/.env`.
    - Busca el venv del backend en el worktree o en el checkout principal.
  - `.claude/settings.json` (del repo): hook `Stop` →
    `python "$CLAUDE_PROJECT_DIR/scripts/verify.py" --hook` (timeout 900 s).
  - `scripts/verify-known-failures.txt`: la vía de escape para fallos preexistentes. Hoy está vacía.
  - `INSTRUCCIONES.md`: aceptación antes de codificar (primer commit), `verify.py` como puerta
    compartida para el ejecutor, el auditor y el CI, el candado y la vía de escape.
- **Evidencia de los criterios de aceptación:**
  1. Plantilla: las secciones «Criterios de aceptación ejecutables», «Evidencia de los criterios» y
     «Checklist de auto-verificación» están en `misiones/plantilla.md` (diff del PR).
  2. **Caso (a), test roto → bloquea.** Con `backend/tests/test_verify_canary.py` (`assert 1 == 2`)
     en el árbol, el comando exacto del hook dio **exit=2 en 140 s**:
     ```
     verify: backend:pytest FALLA (25s)
     verify: BLOQUEADO. Falló: backend:pytest
     ── backend:pytest (últimas líneas) ──
     FAILED tests/test_verify_canary.py::test_roto_a_proposito - AssertionError: roto a propósito (misión 11, caso a)
     ```
     El resto de checks salió OK (alembic 1 s, vitest 70 s, eslint 16 s, build 28 s). El archivo
     de prueba se borró después.
  3. **Caso (b), cambios y todo en verde → pasa.** Con `scripts/verify.py` modificado:
     `pytest OK (23s) · alembic-heads OK (1s) · vitest OK (62s) · eslint OK (15s) · build OK (25s)
     · verify: OK` → **exit=0 en 126 s**. Repetido sobre el mismo estado:
     `verify: este estado del árbol ya pasó en verde` → exit=0 en 1 s.
  4. **Caso (c), árbol limpio → no corre nada.** Con `git status --porcelain` vacío:
     `verify: árbol limpio, nada que verificar` → **exit=0 en 0 s**.
  5. Cero archivos de producto: `git diff --name-only origin/main...HEAD` lista solo
     `.claude/settings.json`, `misiones/2026-11-22-verificacion-origen.md`, `misiones/INSTRUCCIONES.md`,
     `misiones/cola.md`, `misiones/plantilla.md`, `scripts/verify-known-failures.txt` y
     `scripts/verify.py`.
  6. CI del PR #5: al escribir este Reporte los checks `backend` y `frontend` estaban en curso. La
     evidencia es el estado de los checks del PR (Auto-fix vigila el PR y avisa si salen en rojo).
- **Checklist de auto-verificación:**
  - [x] Diff auto-revisado → `git diff --stat origin/main...HEAD`: 7 archivos, +266 / −8.
  - [x] Archivos fuera de alcance = 0 → la lista del criterio 5 (todo bajo `misiones/`, `.claude/`
        o `scripts/`, como permite la misión).
  - [x] Migraciones = 1 head → sin migraciones en el diff. `alembic heads` OK dentro de verify
        (caso b).
  - [x] Sin `console.log`, secretos ni `any` nuevos → el grep de la plantilla sobre el diff solo
        encuentra la propia línea de la plantilla que documenta ese grep (líneas 125-126 del diff),
        ningún uso real.
  - [x] Puerta compartida → `verify: OK` (caso b).
  - [x] Criterios uno a uno → ver arriba.
- **Desviaciones o dudas:**
  - **Hueco del candado, tal como lo pide la misión:** el hook solo mira cambios sin commitear. Si
    el ejecutor commitea y después cierra el turno, el árbol está limpio y no corre nada; ese caso lo
    cubre el CI con la protección de `main` (misión 10). Se puede ampliar para que también cuente los
    commits de la rama que no están en `origin/main`, pero eso cambia el caso (c): decide Mijo/Fabian.
  - Coste: con cambios, cada cierre de turno tarda unos 2 min (vitest es lo más lento). La caché
    evita repetirlo mientras el árbol no cambie.
  - El hook requiere `python` en el PATH (ya está en esta máquina). En una máquina sin él, el hook
    falla con un error, no en silencio.
  - El primer commit (b8aea87) incluyó, además de los criterios, los primeros cambios de plantilla e
    INSTRUCCIONES. Los criterios sí precedieron al script y al hook.
