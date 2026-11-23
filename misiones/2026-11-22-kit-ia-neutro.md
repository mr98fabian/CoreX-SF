# Misión: Kit de IA neutro (ningún asistente con nombre en las superficies)
- **ID:** 2026-11-22-kit-ia-neutro
- **Estado:** en-curso
- **Rama:** chore/kit-ia-neutro
- **Repo:** CoreX-SF
## Objetivo
Que ninguna superficie de conexión de KoreX nombre un asistente concreto: el kit manual por token se
presenta como el JSON estándar `mcpServers`, válido para cualquier asistente que hable MCP.
## Contexto
Dirección de Fabian (2026-11-21): KoreX funciona con el asistente que cada usuario ya tenga; ninguno
es requisito ni se nombra. La ruta principal ya es el enlace OAuth (S-02b). Quedan `lib/aiKit.ts`
(«para Claude Desktop» y el one-liner `claude mcp add`) y la Guía IA («Claude Desktop, Claude Code
o cualquier cliente MCP»). Barrido previo (`grep -rniE "claude|chatgpt|gemini|copilot"` en
`frontend/src` sin tests): `lib/aiKit.ts`, `IAGuidePage.tsx:30-31` (visible), `ConsentPage.tsx:2`
(comentario) y `AssumptionsBreakdown.tsx:38` (comentario, no es de conexión). Servidor MCP
(`mcp/korex_mcp.py`), `ConnectAI.tsx`, `AIKit.tsx` y `/conecta`: sin menciones.
## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba | Resultado esperado |
|---|----------|-------------------|--------------------|
| 1 | Cero asistentes con nombre en el kit y sus superficies | `grep -rniE "claude\|chatgpt\|gemini\|copilot" frontend/src/lib/aiKit.ts frontend/src/components/AIKit.tsx frontend/src/components/ConnectAI.tsx frontend/src/features/settings/IAGuidePage.tsx frontend/src/features/oauth` | vacío (o solo comentarios listados y justificados) |
| 2 | El kit genera el mismo JSON con el token | test de `AIKit.test.tsx`: `JSON.parse` del bloque copiado → `mcpServers.korex` con `command`/`args`/`env.KOREX_API_TOKEN` = token | passed; mismo objeto que hoy |
| 3 | Pasos neutros | el bloque de configuración dice «los ajustes MCP de tu asistente»; test lo afirma y que no hay `claude mcp add` | passed |
| 4 | Guardián de sincronía kit↔servidor MCP | test existente de FIRST_ACTIONS | passed sin modificarlo |
| 5 | Puerta compartida | `python scripts/verify.py` | `verify: OK` (exit 0) |
| 6 | CI del PR | checks `backend` y `frontend` | success |
## Pasos
1. `lib/aiKit.ts`: JSON `mcpServers` estándar y pasos neutros; quitar el one-liner y su función.
2. Guía IA: «a tu asistente (cualquier cliente MCP)».
3. Tests: los que afirman el copy viejo pasan a afirmar el neutro.
## No tocar
- Comportamiento de la conexión (mismo JSON, token y pasos). Superficies ajenas a la conexión.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:**
