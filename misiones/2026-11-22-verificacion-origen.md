# Misión: Verificación en origen (aceptación antes del código + hook que bloquea)
- **ID:** 2026-11-22-verificacion-origen
- **Estado:** en-curso
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
- **Fecha:**
