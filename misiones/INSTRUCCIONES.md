# Oficina de Mijo — cómo trabajar las misiones de este repo
Mijo (el asistente de Fabian) deja misiones en `misiones/`. Tú las ejecutas.
Cuando Fabian diga "corre la misión X":
1. Lee `misiones/cola.md`, localiza la misión y lee su archivo completo.
2. Trabaja SOLO lo que la misión pide. Si algo no está claro, detente y repórtalo en la
   sección **Reporte** del archivo de la misión en vez de improvisar.
3. Usa la rama que indica la misión (`feat/...`). Nunca trabajes directo en `main`.
4. Al terminar: corre las verificaciones que pida la misión (tests, lint, build) y anota
   los resultados REALES en la sección **Reporte**.
5. Actualiza el estado en el archivo de la misión y en `misiones/cola.md`:
   `pendiente → en-curso → en-auditoria` (nunca `completada`: eso lo marca Mijo tras
   auditar, con orden de Fabian).
6. Haz push de la rama y de los archivos de misión actualizados. **NUNCA hagas merge
   a `main`**: el merge espera la auditoría de Mijo y la orden de Fabian.
7. Si la misión toca migraciones (Alembic): verifica UN solo head (`alembic heads` == 1)
   antes de darla por lista y anótalo en el reporte.
Reglas fijas de la casa:
- Español en reportes y textos visibles para usuarios; código e identificadores en inglés.
- "Mijo" es un nombre privado entre Fabian y su asistente: en superficies de producto se
  dice "tu IA / tu asistente". Nunca nombres un asistente concreto como requisito.
- Sin comparaciones con competidores en marketing. El enemigo de marca es EL BANCO.
- Nada de secretos en el repo: ni llaves, ni tokens, ni datos bancarios o fiscales.
- Mejoras solo hacia adelante: no rehacer trabajo ya aprobado sin orden expresa.
