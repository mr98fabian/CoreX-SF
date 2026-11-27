---
name: ciclo-mision
description: Secuencia exacta de commits y estados para ejecutar una misión de la Oficina de Mijo en KoreX. Úsalo SIEMPRE que Fabian diga "corre la misión X", "sigue con la misión", "abre el PR de la misión", o cuando se vaya a tocar `misiones/cola.md` o un archivo `misiones/AAAA-MM-DD-*.md`. También al cerrar una misión para comprobar que no falta ningún paso antes de pasarla a en-auditoria.
---

# Ciclo de misión

La norma vive en `misiones/INSTRUCCIONES.md`. **Léela primero; si este skill y ese archivo
discrepan, manda el archivo.** Este skill solo fija el orden que el historial demuestra
(misiones 0–19) para que ningún paso se salte.

## Secuencia (un commit por paso, en este orden)

1. **Rama** la que indique la misión (`feat/…`, `fix/…`, `chore/…`, `perf/…`). Nunca `main`.
2. **Criterios primero.** Llenar «Criterios de aceptación ejecutables» (formato de
   `misiones/plantilla.md`) y pasar la fila de `misiones/cola.md` a `en-curso`.
   Commit: `docs(misiones): misión N (<tema>), criterios de aceptación`
   Este commit va **antes** de cualquier línea de código.
3. **Tests en rojo** cuando el criterio es un test nuevo.
   Commit: `test(<área>): … en rojo`
4. **Código**, solo lo que pide la misión.
   Commit: `feat|fix|perf|chore(<área>): <qué cambia> (misión N)`
5. **Puerta:** `python scripts/verify.py` (pytest, `alembic heads` == 1, vitest, eslint, build).
   Si toca migraciones, anotar el head único en el Reporte.
6. **Reporte** en el archivo de la misión: evidencia por criterio + checklist, cada ítem con
   su artefacto. Estado a `en-auditoria` en el archivo y en la cola.
   Commit: `docs(misiones): Reporte de la misión N, en-auditoria`
7. **Push + PR hacia `main`.** No fusionar: audita Mijo, ordena Fabian.
8. Cerrar el turno con el bloque de la skill `reporte-mijo`.

## Comprobación antes de `en-auditoria`

- [ ] El primer commit de la rama es el de criterios (`git log main..HEAD --reverse --oneline`).
- [ ] Cada criterio tiene evidencia pegada; ninguno queda "pendiente" sin decirlo.
- [ ] `verify.py` en verde, o el fallo documentado como preexistente en `main` con su salida
      y su línea en `scripts/verify-known-failures.txt` (nunca en silencio).
- [ ] Archivo de misión y `cola.md` dicen el mismo estado, rama y nombre de archivo.
- [ ] `git diff main --stat` no trae archivos fuera del alcance de la misión.

## Lo que este ciclo nunca hace

- Marcar `completada` (solo Mijo, con orden de Fabian).
- Merge a `main`, ni `--no-verify`, ni saltarse el hook `Stop`.
- Improvisar ante una duda: se para y se escribe en el Reporte.
- Reescribir una decisión de Fabian: se registra como commit propio
  (`docs(misiones): misión N, <decisión> (decisión de Fabian)`).
