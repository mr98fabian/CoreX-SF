# Misión: CI en GitHub con bloqueo real de merge
- **ID:** 2026-11-22-ci-bloqueo
- **Estado:** en-curso
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
- **Fecha:**
- **Rama y commit:**
- **Verificaciones corridas y resultado:**
- **Desviaciones o dudas:**
