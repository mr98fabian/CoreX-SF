# Oficina de Mijo — cómo trabajar las misiones de este repo
Mijo (el asistente de Fabian) deja misiones en `misiones/`. Tú las ejecutas.
Cuando Fabian diga "corre la misión X":
1. Lee `misiones/cola.md`, localiza la misión y lee su archivo completo.
2. **Antes de escribir código**, llena la sección «Criterios de aceptación ejecutables» del
   archivo de la misión (formato de `misiones/plantilla.md`) y commitéala como primer commit de
   la rama: cada criterio con su test/comando y resultado esperado, o su artefacto observable.
   Si la misión llega sin esa sección, la escribes tú primero. Después,
   trabaja SOLO lo que la misión pide. Si algo no está claro, detente y repórtalo en la
   sección **Reporte** del archivo de la misión en vez de improvisar.
3. Usa la rama que indica la misión (`feat/...`). Nunca trabajes directo en `main`.
4. Al terminar: corre `python scripts/verify.py` (la **puerta compartida**: pytest, `alembic
   heads` == 1, vitest, eslint y build; el auditor y el CI corren exactamente lo mismo) y las
   verificaciones extra que pida la misión. En el **Reporte** pega la evidencia de cada criterio
   de aceptación y el checklist de auto-verificación, cada ítem con su artefacto. Una misión con
   un criterio sin evidencia no pasa a `en-auditoria`.
5. Actualiza el estado en el archivo de la misión y en `misiones/cola.md`:
   `pendiente → en-curso → en-auditoria` (nunca `completada`: eso lo marca Mijo tras
   auditar, con orden de Fabian).
6. Haz push de la rama y de los archivos de misión actualizados y **abre un PR hacia
   `main`**. Los merges son por PR: Claude abre el PR, Mijo audita y Fabian aprueba y
   fusiona. **NUNCA hagas merge a `main`** por tu cuenta. `main` está protegida: el PR
   solo se puede fusionar con los checks de CI (`backend` y `frontend`) en verde.
7. Si la misión toca migraciones (Alembic): verifica UN solo head (`alembic heads` == 1)
   antes de darla por lista y anótalo en el reporte.
Reglas fijas de la casa:
- Español en reportes y textos visibles para usuarios; código e identificadores en inglés.
- "Mijo" es un nombre privado entre Fabian y su asistente: en superficies de producto se
  dice "tu IA / tu asistente". Nunca nombres un asistente concreto como requisito.
- Sin comparaciones con competidores en marketing. El enemigo de marca es EL BANCO.
- Nada de secretos en el repo: ni llaves, ni tokens, ni datos bancarios o fiscales.
- Mejoras solo hacia adelante: no rehacer trabajo ya aprobado sin orden expresa.
- **Regla de oro: todo error que se repita se convierte en test o en bloqueo automático.**
- **El candado (hook `Stop`)**: `.claude/settings.json` del repo ejecuta `scripts/verify.py
  --hook` al cerrar cada turno. Si hay cambios sin commitear en el árbol y algo
  falla, el turno no puede terminar (exit 2). Si el árbol está limpio, no corre nada. Un estado
  que ya pasó en verde no se repite (caché por worktree).
- **Vía de escape (solo fallos PREEXISTENTES):** si un check ya fallaba en `main` antes de tu
  cambio, no lo arreglas en silencio ni te quedas bloqueado. Pega en el Reporte la evidencia de
  que ya fallaba en `main` (comando + salida) y añade el check a
  `scripts/verify-known-failures.txt` con el id de la misión. Así avisa pero no bloquea. La
  línea se quita en cuanto se arregla, y el auditor la revisa como cualquier otro cambio.
