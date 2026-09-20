# Entregable 4 — Plan de Implementación Paso a Paso

> Objetivo: integrar los 5 skills nuevos + el flujo de trabajo en el día a día de KoreX. Tiempo total estimado: ~2 horas repartidas en 2 semanas. Todo lo del Día 1 ya quedó hecho en esta sesión.

## Día 1 — Instalación y verificación (HECHO ✅ / verificar en 10 min)

1. ✅ Skills creados en `.claude/skills/`:
   - `legal-expert-usa/` (SKILL.md + `references/regulatory-map.md`, `marketing-claims.md`, `checklists.md`)
   - `deep-research/`, `critical-evaluator/`, `executive-synthesis/`, `velocity-domain/`
2. **Verificar carga**: en una sesión de Claude Code en este repo, escribe `/` y confirma que aparecen los 5 nombres. Si es la primera vez que el repo tiene `.claude/skills/`, puede pedir reiniciar la sesión y aceptar el diálogo de confianza del workspace (los skills de proyecto lo requieren).
3. **Prueba de humo** (una por skill):
   - `/legal-expert-usa revisa esta frase para la landing: "KoreX guarantees you'll eliminate your debt 5x faster"` → debe devolver 🔴 con alternativas
   - `/velocity-domain ¿qué edge cases debe cubrir un cambio en calculate_minimum_payment?`
   - `/deep-research`, `/critical-evaluator`, `/executive-synthesis` con cualquier tema pequeño
4. **Commit**: `git add .claude/skills docs/claude-optimization && git commit` — los skills viajan con el repo (funcionan igual si clonas en otra máquina).

## Semana 1 — Integración al flujo real

**Paso 5. Primera auditoría legal real (30 min, mayor ROI inmediato)**
Ejecuta el prompt C2 del entregable 2: auditoría de `TermsOfServicePage.tsx` y `PrivacyPolicyPage.tsx` contra los checklists. Guarda el resultado en `docs/legal/audit-YYYY-MM.md`. Los ❌ críticos (ej. entidad legal, cláusulas de suscripción) van a tu backlog con prioridad.

**Paso 6. Crear `CLAUDE.md` en la raíz (15 min)**
Hoy el repo no tiene uno. Contenido mínimo: comandos de verificación (pytest/vitest/eslint/build), quirk del puerto 8001, reglas de bundle-splitting, y una línea: "Cifras monetarias → skill velocity-domain; copy público → skill legal-expert-usa". Puedes generarlo con `/init` y editarlo.

**Paso 7. Adoptar las cadenas (hábito, no tarea)**
Imprime/ancla la matriz del entregable 1:
- Copy nuevo → `copy-master` → `/legal-expert-usa`
- Cambio en motor $$ → `/velocity-domain` → `qa-tester` → `/code-review`
- Decisión grande → `/deep-research` → `/critical-evaluator` → `/executive-synthesis`

**Paso 8. Automatizar la vigilancia regulatoria (10 min)**
`/schedule` una tarea mensual con el prompt A3 (cambios FTC/CFPB/app stores → impacto en KoreX). Primera corrida: verificar los dos puntos marcados ⚠️ (Click-to-Cancel post-anulación; reglas Apple de external purchase links).

## Semana 2 — Refinamiento

**Paso 9. Iterar los skills con datos reales**
Cuando un skill se active de más, de menos, o responda flojo:
- Activación → editar su `description` (se recarga en vivo, sin reiniciar)
- Calidad → editar el cuerpo; para cambios serios, `/skill-creator` corre evals comparando versión vieja vs nueva con benchmark
- Anota fallos en un `docs/claude-optimization/skill-feedback.md` durante la semana y corrige en lote

**Paso 10. Decidir qué skills promover a personales**
`deep-research`, `critical-evaluator` y `executive-synthesis` no son específicos de KoreX. Si los quieres en TODOS tus proyectos, cópialos a `~/.claude/skills/` (o empaquétalos en tu plugin `fabian-skills`). `legal-expert-usa` y `velocity-domain` se quedan en el repo: son del proyecto.

**Paso 11. Conectar MCP de Supabase (opcional, 15 min)**
Instala el plugin oficial `supabase` del marketplace de Claude Code → potencia `schema-guard` y la depuración con datos reales del esquema.

**Paso 12. Preparar la consulta con abogado real (cuando toque)**
Antes de pagar horas de abogado, corre el prompt C4: memo ejecutivo con las 5 preguntas abiertas priorizadas + hechos relevantes, exportado a .docx. Reduce una consulta exploratoria de 3 horas a 1.

## Mantenimiento continuo

| Frecuencia | Acción |
|---|---|
| Cada copy público | `/legal-expert-usa` antes de publicar |
| Cada cambio al motor financiero | `/velocity-domain` + pytest |
| Mensual | Tarea programada de vigilancia regulatoria (paso 8) |
| Trimestral | Revisar `skill-feedback.md` y podar/mejorar skills; re-verificar los ⚠️ legales |
| Al añadir un skill nuevo | Regla de oro: ¿es un procedimiento repetido ≥3 veces? → skill. ¿Es un hecho? → CLAUDE.md. ¿Es una automatización de evento? → hook |

## Criterios de éxito (medibles)

1. Cero copy público sin pasar por revisión legal (evidencia: mención en PRs).
2. Auditoría ToS/Privacy completada con ❌ críticos resueltos antes del próximo release móvil.
3. Los 5 skills se activan solos en conversaciones normales (si tienes que invocarlos manualmente siempre, las descripciones necesitan iteración — paso 9).
4. Toda decisión técnica mayor del trimestre tiene su cadena investigación→crítica→síntesis documentada en `docs/`.
