# Entregable 3 — Informe: Cómo Maximizar Claude para Investigación, Análisis y Contenido Complejo

> Fecha: 2026-07-02 · Proyecto: KoreX · Fuentes verificadas contra documentación oficial de Anthropic (enlaces al final).
> Convención: **[OFICIAL]** = documentación de Anthropic verificada hoy · **[COMUNIDAD]** = práctica extendida no oficial · **⚠️** = no verificado con certeza.

## 1. Qué significa "añadir skills a Claude" (y qué elegimos para KoreX)

**[OFICIAL]** Un *Agent Skill* es una carpeta con un `SKILL.md` (frontmatter YAML + instrucciones markdown) y recursos opcionales (`references/`, `scripts/`, `assets/`). Funciona por **divulgación progresiva** en 3 niveles: (1) nombre+descripción siempre en contexto (~100 tokens por skill), (2) el cuerpo del SKILL.md se carga solo al activarse (<5k tokens), (3) los archivos de referencia se leen solo si hacen falta — por eso se puede instalar una biblioteca grande sin penalizar el contexto.

**[OFICIAL]** Ubicaciones en Claude Code: personales (`~/.claude/skills/`, todos tus proyectos), de proyecto (`.claude/skills/`, versionadas en git — **la opción elegida para KoreX**), y plugins. Los cambios a un SKILL.md se recargan en vivo dentro de la sesión.

**[OFICIAL]** Frontmatter útil más allá de `name`/`description`: `disable-model-invocation: true` (solo invocación manual — para acciones con efectos como deploys), `allowed-tools` (herramientas pre-aprobadas mientras el skill está activo), `disallowed-tools`, `context: fork` + `agent` (ejecutar el skill en un subagente aislado), `$ARGUMENTS` y variables como `${CLAUDE_PROJECT_DIR}`.

**[OFICIAL]** Límites del formato: `name` ≤64 caracteres (minúsculas/números/guiones), `description` ≤1024 caracteres y debe decir **qué hace + cuándo usarse** — es el mecanismo primario de activación automática. Recomendación oficial: SKILL.md corto y material extenso en archivos referenciados.

Las otras tres interpretaciones de "añadir skills" también aplican y están cubiertas: **prompts especializados** (entregable 2), **roles/personas** (los 5 skills SON personas persistentes), e **integraciones externas** (sección 4).

## 2. Capacidades nativas infrautilizadas (y cómo activarlas)

| Capacidad | Cómo se activa | Qué optimiza |
|---|---|---|
| **Razonamiento adaptativo** [OFICIAL] | En la API: `thinking: {type: "adaptive"}` + parámetro `effort`. El viejo `budget_tokens` está deprecado (da error 400 en modelos actuales). En Claude Code se gestiona solo; se puede pedir "piensa a fondo antes de actuar" | Problemas multi-paso, matemática, arquitectura |
| **Subagentes** [OFICIAL] | Claude Code: agentes `Explore`/`Plan`/`general-purpose` o skills con `context: fork`. Investigan en paralelo sin contaminar tu contexto | Investigación amplia, revisión independiente |
| **Búsqueda web** [OFICIAL] | Herramientas WebSearch/WebFetch en Claude Code/Cowork. El skill `deep-research` la disciplina con triangulación | Todo lo que cambia con el tiempo (precios, leyes, APIs) |
| **Análisis de documentos largos** [OFICIAL] | Documentos AL INICIO del prompt, instrucciones al final; pedir citas textuales antes del análisis ("ground responses in quotes"); envolver docs en tags XML con metadatos | Contratos, papers, codebases, transcripts |
| **Memoria persistente** [OFICIAL] | `CLAUDE.md` (hechos del proyecto, siempre en contexto) + auto-memoria del asistente. Regla: hechos → CLAUDE.md; procedimientos → skills | Continuidad entre sesiones |
| **Hooks** [OFICIAL] | `settings.json` de Claude Code: comandos que se ejecutan en eventos (pre/post tool, stop). Deterministas — no dependen de que el modelo "se acuerde" | Guardias automáticos (lint, tests, validaciones) |
| **MCP (Model Context Protocol)** [OFICIAL] | Servidores que exponen herramientas externas (Supabase, GitHub, navegador, Zapier…) | Conectar Claude a tus sistemas reales |
| **Generación de documentos** [OFICIAL] | Skills empaquetados docx/xlsx/pptx/pdf | Entregables profesionales directos |
| **Llamadas paralelas a herramientas** [OFICIAL] | Pedirlo explícitamente ("busca X, Y y Z en paralelo") | Velocidad en investigación |

## 3. Técnicas de prompting con mejor evidencia (específicas de Claude)

Todas **[OFICIAL]** salvo indicación (fuente: guía de prompting de Anthropic para los modelos actuales):

1. **Claridad + motivo**: instrucciones explícitas Y el *porqué* del constraint — Claude generaliza mejor cuando entiende la intención. Los modelos actuales siguen instrucciones más literalmente que generaciones previas: revisa prompts heredados con reglas que ya no quieres.
2. **Ejemplos (multishot)**: 2–5 ejemplos relevantes y diversos, envueltos en `<example>`/`<examples>`. La técnica con mejor relación esfuerzo/resultado para formato y tono.
3. **Estructura XML**: separar `<instructions>`, `<context>`, `<input>` elimina ambigüedad en prompts complejos.
4. **Rol en system prompt**: una sola frase de rol ya cambia el comportamiento; un perfil completo (como nuestros skills) lo cambia más. En la API va en `system`; en Claude Code, el skill activo cumple esa función.
5. **Contexto largo**: datos arriba, pregunta abajo; citas textuales antes del análisis.
6. **Encadenamiento de prompts**: descomponer tareas complejas en pasos con outputs verificables (nuestras "cadenas" del entregable 2, sección E).
7. **Prefill deprecado**: la técnica clásica de pre-llenar la respuesta del asistente se migró a instrucciones directas de formato/estructura en el system prompt.
8. **Calibrar el pensamiento, no forzarlo**: guiar cuándo pensar ("reflexiona sobre el resultado de la herramienta antes de continuar") supera a exigir pensamiento siempre; el exceso de "if in doubt, use X" causa sobre-activación en los modelos actuales.

**[COMUNIDAD]** con adopción amplia pero sin métrica oficial: pedir auto-crítica en dos pasadas (draft → review), "pre-mortem" para planes, y descripciones de skills deliberadamente "insistentes" para combatir la sub-activación (esta última sí aparece en material de Anthropic del skill-creator).

## 4. Integraciones externas recomendadas para KoreX

| Integración | Para qué | Estado |
|---|---|---|
| **MCP de Supabase** | Consultar el esquema/datos reales al depurar (complementa `schema-guard`) | Plugin oficial disponible en el marketplace de Claude Code |
| **GitHub (`gh` CLI / plugin)** | PRs, issues, CI desde la conversación | Ya operativo en este entorno |
| **Claude in Chrome / Preview** | Verificación visual del frontend tras cambios | Ya operativo |
| **Zapier MCP** | Automatizaciones sin código (ej. alta en email list al publicar contenido) | Conectado en este entorno |
| **API de Anthropic directa** | Batch de contenido, features de IA dentro de KoreX | Usar `claude-sonnet-5` para volumen; skill `claude-api` como referencia |
| **Scheduled tasks / `/schedule`** | Vigilancia regulatoria mensual (prompt A3) automática | Disponible en este entorno |

## 5. Riesgos y límites (honestidad ante todo)

- **Los skills no son magia**: si la `description` no coincide con cómo hablas, no se activan (sub-activación documentada). Mitigación: invocación manual con `/nombre` y descripciones "insistentes".
- **El skill legal no es un abogado** ⚠️: es orientación de alta calidad para detectar riesgos y preparar consultas — la validación final de documentos vinculantes requiere abogado licenciado. El propio skill lo declara en cada análisis.
- **Puntos marcados ⚠️ en las referencias legales** (verificar al usarlas): estado vigente de la FTC Click-to-Cancel Rule tras su anulación judicial (2025), y reglas actuales de Apple sobre external purchase links en USA. El prompt A3 del entregable 2 existe exactamente para esto.
- **Skills de terceros = software**: [OFICIAL] auditar cualquier skill externo antes de instalarlo (pueden dirigir herramientas y ejecutar código).
- **Costo de contexto**: ~100 tokens por skill instalado es barato, pero docenas de skills con descripciones largas compiten entre sí por activarse. Curar > acumular.

## 6. Recomendaciones finales

1. **Adoptar el flujo de cadenas** (entregable 2E) como hábito: investigación → crítica → síntesis es el pipeline que más calidad añade por esfuerzo.
2. **Pasar TODO copy público por `legal-expert-usa`** — es la mitigación de mayor ROI del proyecto dado el sector.
3. **Crear `CLAUDE.md` en la raíz del repo** (hoy no existe): comandos de verificación, convenciones, y punteros a los skills. Los skills cargan procedimientos; CLAUDE.md carga hechos.
4. **Iterar los skills con `skill-creator`** cuando un skill falle o se active mal: tiene evals y benchmark integrados.
5. **Programar la vigilancia regulatoria mensual** con `/schedule` + prompt A3.

## Fuentes

**Oficiales (verificadas 2026-07-02):**
- [Agent Skills — Overview (Claude Platform Docs)](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — estructura, 3 niveles de carga, límites de frontmatter, seguridad
- [Skills en Claude Code (code.claude.com)](https://code.claude.com/docs/en/skills) — ubicaciones, frontmatter extendido, `context: fork`, live reload
- [Prompting best practices (Claude Platform Docs)](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) — técnicas §3, adaptive thinking, migración de prefill
- [Agent Skills best practices (Claude Platform Docs)](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) — autoría de skills
- [Equipping agents for the real world with Agent Skills (Anthropic Engineering)](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Extended thinking (Claude Platform Docs)](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
- [Repositorio open-source de skills de Anthropic](https://github.com/anthropics/skills)

**Comunidad/terceros (consultadas como contexto, no como autoridad):**
- [Agent Skills — estándar abierto](https://agentskills.io/home) · [Curso DeepLearning.AI](https://www.deeplearning.ai/courses/agent-skills-with-anthropic) · [Análisis de progressive disclosure (SwirlAI)](https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure)

**Legales**: las citas normativas del skill (`.claude/skills/legal-expert-usa/references/`) provienen del conocimiento del modelo con corte enero 2026 — cada referencia crítica indica cuándo re-verificar contra la fuente primaria (ftc.gov, consumerfinance.gov, developer.apple.com).
