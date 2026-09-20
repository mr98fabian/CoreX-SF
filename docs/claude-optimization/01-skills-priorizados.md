# Entregable 1 — Listado Priorizado de Skills

> Para KoreX (SaaS fintech de velocity banking) + proyectos de investigación, análisis y creación de contenido complejo.
> **Cómo se activa** cada skill: automáticamente cuando la conversación coincide con su `description`, o manualmente escribiendo `/nombre-del-skill`.

## Tier 1 — Creados hoy en `.claude/skills/` (nuevos, específicos del proyecto)

### 1. `legal-expert-usa` ⭐ prioridad máxima
- **Qué es:** abogado experto en derecho fintech de USA, calibrado al perfil regulatorio exacto de KoreX (herramienta educativa de software; NO credit repair, NO debt adjusting, NO advisor).
- **Se activa:** automático ante cualquier tema legal/compliance/marketing con claims; manual con `/legal-expert-usa`.
- **Optimiza:** revisión de ToS/Privacy, claims de marketing, lanzamientos de features financieros, app stores, suscripciones, datos Plaid, formación de LLC.
- **Por qué es valiosa:** KoreX opera en la categoría más vigilada por la FTC/CFPB (finanzas de consumo + deudas). Un claim mal redactado ("improve your credit") activa CROA y habilita demandas colectivas. El skill codifica los triggers para detectarlos ANTES de publicar. Incluye 3 archivos de referencia (mapa regulatorio, claims de marketing, checklists operativos) que se cargan solo cuando se necesitan.

### 2. `velocity-domain`
- **Qué es:** el dominio financiero del proyecto: matemática de velocity banking, reglas de precisión `Decimal`, edge cases obligatorios, mapa de dónde vive cada cálculo.
- **Se activa:** automático al tocar `core_engine/`, `velocity_engine.py` o cualquier cifra monetaria; manual con `/velocity-domain`.
- **Optimiza:** cambios al motor financiero sin regresiones; contenido de marketing técnicamente exacto.
- **Por qué es valiosa:** conecta código con negocio y con lo legal — una proyección incorrecta es a la vez bug, mal producto y claim engañoso. Codifica el conocimiento que hoy solo existe en la cabeza del founder.

### 3. `deep-research`
- **Qué es:** modo investigador con jerarquía de fuentes, triangulación (2+ fuentes independientes por afirmación clave), etiquetas de confianza (✅ Verificado / 🟡 Probable / ⚠️ No verificado) y pase contrario obligatorio.
- **Se activa:** automático ante "investiga", "compara", "cuál es mejor", "es cierto que"; manual con `/deep-research`.
- **Optimiza:** decisiones de stack, due diligence de vendors, research regulatorio y de mercado, contenido basado en datos.
- **Por qué es valiosa:** convierte la debilidad clásica de los LLM (afirmar de memoria con confianza) en disciplina explícita de verificación. Es la base de los otros modos: el evaluador y el sintetizador trabajan sobre lo que este produce.

### 4. `critical-evaluator`
- **Qué es:** red team interno: steelman → tabla de supuestos → análisis de fallos (corrección, edge cases, incentivos, segundo orden) → veredicto con severidades 🔴🟡🔵.
- **Se activa:** automático ante "evalúa", "critica", "qué puede salir mal", "challenge this"; manual con `/critical-evaluator`.
- **Optimiza:** revisión de planes, arquitectura, pricing, copy y decisiones antes de ejecutarlas.
- **Por qué es valiosa:** neutraliza el sesgo de complacencia del asistente (aprobar por defecto) con reglas anti-crítica-teatral: cada objeción debe citar el elemento concreto que la provoca. Para un founder solo, es el "segundo par de ojos" que no tiene.

### 5. `executive-synthesis`
- **Qué es:** síntesis con principio de pirámide: BLUF, test del "so what", números sobre adjetivos, recomendación explícita, una página.
- **Se activa:** automático ante "resume", "TLDR", "prepara un brief", cierres de sesión; manual con `/executive-synthesis`.
- **Optimiza:** informes de decisión, comunicación técnica→negocio, cierre de sesiones largas de trabajo.
- **Por qué es valiosa:** la investigación sin síntesis no produce decisiones. Obliga a que cada análisis termine en recomendación accionable con próximos pasos y responsables.

## Tier 2 — Ya instalados (plugin `fabian-skills`) más relevantes para este objetivo

| Skill | Úsalo para | Sinergia con los nuevos |
|---|---|---|
| `prompt-craft` | Optimizar prompts y descripciones de skills | Mantenimiento de esta biblioteca |
| `meta-cognition` | Planificación y refactors arquitectónicos | Antes de `critical-evaluator` en decisiones grandes |
| `qa-tester` | Testing exhaustivo, edge cases | Ejecuta lo que `velocity-domain` exige |
| `copy-master` + `neuromarketing` | Copy de conversión | **Siempre pasar su output por `legal-expert-usa`** — la tensión persuasión vs compliance es deliberada |
| `backend-core` / `frontend-master` / `supabase-expert` | Implementación | Contexto técnico de base |
| `schema-guard` / `hook-destructure-guard` | Prevención de errores conocidos | Guardias automáticos |
| `deployment-validator` | Pre-deploy | Última puerta antes de producción |

## Tier 3 — Skills empaquetados de Anthropic (ya disponibles)

- `docx` / `pdf` / `xlsx` / `pptx` — generar entregables profesionales (ej. el informe legal como Word para un abogado externo, modelos financieros como Excel).
- `skill-creator` — crear/iterar/evaluar skills con benchmarks. Es la herramienta para mantener viva esta biblioteca.
- `code-review`, `security-review`, `verify`, `simplify` — calidad de código integrada al flujo git.

## Matriz de flujo recomendada

```
Investigar algo        → deep-research → executive-synthesis
Decidir algo grande    → deep-research → critical-evaluator → executive-synthesis
Publicar copy/feature  → copy-master/neuromarketing → legal-expert-usa → deployment-validator
Tocar el motor $$      → velocity-domain → qa-tester → code-review
Entregar a terceros    → executive-synthesis → docx/pdf
```
