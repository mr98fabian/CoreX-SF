# Misión: CI en GitHub con bloqueo real de merge
- **ID:** 2026-11-22-ci-bloqueo
- **Estado:** en-auditoria
- **Rama:** chore/ci-bloqueo
- **Repo:** CoreX-SF
## Objetivo
Que ningún código entre a `main` con tests en rojo: GitHub Actions corre las suites en cada rama y
cada PR, y la protección de `main` bloquea el merge si el CI falla.
## Contexto
Hoy el bloqueo es procedural (Mijo corre las suites a mano en cada auditoría); esta misión lo vuelve
técnico.
## Pasos
1. `.github/workflows/ci.yml` con dos jobs: backend (dependencias como producción, pytest desde
   `backend/`, `alembic heads` == 1) y frontend (`npm ci`, vitest, eslint, build). Disparadores:
   `pull_request` hacia `main` y `push` a cualquier rama.
2. Abrir el PR de esta rama y dejar el CI en verde (si falla por entorno, se arregla el workflow,
   no los tests).
3. Prueba del bloqueo: rama desechable con un test roto → PR en rojo y merge bloqueado; luego
   borrarla.
4. Protección de `main`: PR obligatorio + checks de CI en verde + sin force-push.
5. `misiones/INSTRUCCIONES.md`: merges por PR y la regla de oro «todo error que se repita se
   convierte en test o en bloqueo automático».
## Criterios de aceptación
- [ ] CI verde en el PR de la misión + evidencia del bloqueo con el test roto.
- [ ] Suites locales en verde; ningún test modificado para pasar.
- [ ] Reporte: tiempos de cada job, diferencias de entorno y estado final de la protección de `main`.
## No tocar
- Tests (no se modifican para pasar). Merge: lo ordena Fabian tras la auditoría de Mijo.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-22
- **Rama y commit:** `chore/ci-bloqueo`; CI en 9ec4699, oficina en el commit siguiente, este Reporte en
  la cabeza. PR: https://github.com/mr98fabian/CoreX-SF/pull/3 (sin merge).
- **Qué se hizo:**
  - `.github/workflows/ci.yml` reemplaza al CI anterior, que solo corría en push a `main` y en PRs,
    con Python 3.12 y Node 20.
    - Disparadores: `push` a cualquier rama y `pull_request` hacia `main`. `concurrency` cancela la
      corrida vieja de la misma rama.
    - Job `backend`: Python **3.13** e instalación con `pip install -r backend/requirements.txt`, igual
      que `railpack.json` (Railway). Corre `python -m pytest` desde `backend/`, y luego `alembic heads`
      debe devolver exactamente 1 `(head)`; si no, falla con un error explícito.
    - Job `frontend`: Node **24**, igual que el proyecto `corex-web` en Vercel (`nodeVersion 24.x`).
      Corre `npm ci`, `npx vitest run`, `npx eslint src --ext .ts,.tsx --max-warnings 0` y
      `npm run build`.
  - **Protección de `main` activada con `gh`** (acceso admin):
    - Exige PR para todo cambio (0 aprobaciones: Fabian no puede aprobar su propio PR).
    - Exige los checks `backend` y `frontend` en verde, sin pedir que la rama esté al día.
    - Se aplica también a los admins (`enforce_admins`).
    - Prohíbe el force-push y el borrado de `main`.
  - `misiones/INSTRUCCIONES.md`: los merges son por PR (Claude abre el PR, Mijo audita, Fabian
    aprueba y fusiona) y se agrega la regla de oro «todo error que se repita se convierte en test o en
    bloqueo automático».
- **Verificaciones corridas y resultado:**
  - **PR #3 (esta misión): verde.** `backend` 46 s (01:52:38→01:53:24 UTC) y `frontend` 80 s
    (01:52:38→01:53:58). Estado de merge: `CLEAN`.
  - **Prueba del bloqueo:** rama desechable `tmp/ci-test-roto`, PR #4, con
    `tests/test_ci_canary.py::test_roto_a_proposito` (`assert 1 == 2`). Resultado:
    - `backend` = **FAILURE** (45 s), con el log
      `FAILED tests/test_ci_canary.py::test_roto_a_proposito - AssertionError: roto a propósito…`.
    - `frontend` = success.
    - Con el PR listo para revisión, GitHub reportó `mergeStateStatus = BLOCKED`.
    - El PR se cerró y la rama se borró (local y remota).
  - Suites locales: pytest **622 passed**, vitest **332 passed**. Ningún test se modificó.
- **Desviaciones o dudas:**
  - Diferencias de entorno encontradas: el CI viejo usaba **Python 3.12** contra **3.13** en
    producción y **Node 20** contra **24** en Vercel. El CI viejo tampoco corría en ramas ni comprobaba
    `alembic heads`. Todas se corrigieron en el workflow; ningún test necesitó cambios.
  - No intenté fusionar el PR roto «para ver el rechazo»: si la protección hubiera fallado, habría
    metido un test roto en `main`. La evidencia es el `BLOCKED` de GitHub con la protección ya activa.
  - Consecuencia de `enforce_admins`: ya nadie, ni con admin, puede hacer push directo a `main`. Los
    commits de docs de la oficina (marcar misiones completadas) también deben ir por PR. Fabian puede
    quitarlo en Settings → Branches si lo prefiere.
