# Misión: Kit de IA neutro (ningún asistente con nombre en las superficies)
- **ID:** 2026-11-22-kit-ia-neutro
- **Estado:** en-auditoria
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
- **Fecha:** 2026-11-22
- **Rama y commit:** `chore/kit-ia-neutro`. Criterios en el primer commit (263ca65), código en
  23185ca, Reporte en la cabeza. Base: main 2da3256.
- **Qué se hizo:**
  - `lib/aiKit.ts`:
    - `kitConfigJson` se documenta como el JSON estándar `mcpServers` (objeto idéntico).
    - `kitConfig` lleva ahora 3 pasos neutros: abrir los ajustes MCP de tu asistente, pegar en
      `mcpServers` y cambiar `<RUTA_DEL_MCP>`.
    - Se eliminó `kitConfigCommand` (el one-liner `claude mcp add`), que solo usaba `kitConfig`; no
      tenía tests propios.
  - `AIKit.tsx`: la pista del bloque de configuración dice «Pégalo en los ajustes MCP de tu
    asistente» en ES y EN.
  - `IAGuidePage.tsx:30-31`: «a tu asistente (cualquier asistente que hable MCP)», sin nombres.
  - `AIKit.test.tsx`: el test que afirmaba el one-liner ahora afirma el JSON completo (`command`,
    `args`, `env` con el token), el paso neutro y que no aparece ningún asistente ni `mcp add`.
- **Evidencia de los criterios de aceptación:**
  1. El grep del criterio sobre `aiKit.ts`, `AIKit.tsx`, `ConnectAI.tsx`, `IAGuidePage.tsx` y
     `features/oauth` da **cero menciones en texto visible**. Quedan dos restos, justificados:
     - `features/oauth/ConsentPage.tsx:2`: comentario interno («the screen an assistant (Claude…)
       sends the user to»). No se ve en pantalla.
     - `features/oauth/oauth.test.tsx:30,60-99`: datos de prueba. La pantalla de consentimiento
       muestra el `client_name` que **el propio cliente OAuth declara al registrarse**; el test usa
       «Claude» como ejemplo de ese dato. KoreX no escribe el nombre, lo muestra.
     - Fuera de la conexión y sin tocar: `AssumptionsBreakdown.tsx:38`, comentario que cita la ruta
       `.claude/skills/…`.
  2. Mismo JSON y mismo token: `AIKit.test.tsx` («copies the config with the real token…») hace
     `JSON.parse` del bloque copiado y comprueba `env.KOREX_API_TOKEN` = token,
     `command` = `<RUTA_DEL_MCP>/.venv/bin/python` y `args` = `['<RUTA_DEL_MCP>/korex_mcp.py']`.
     **passed**. `kitConfigJson` no cambió ni una línea de código.
  3. Pasos neutros: el mismo test afirma «Abre los ajustes MCP de tu asistente» y
     `not.toMatch(/claude|chatgpt|gemini|copilot|mcp add/i)`. **passed**.
  4. El guardián de sincronía kit↔servidor (`AIKit.test.tsx:132`, «the MCP INSTRUCTIONS carry the
     PRIMERA CONEXIÓN checklist word for word», que lee `mcp/korex_mcp.py`) pasa **sin modificarlo**.
     `vitest AIKit + connectByLink`: 2 archivos, 20 tests passed.
  5. `python scripts/verify.py`: `pytest OK (24s) · alembic-heads OK · vitest OK (57s) · eslint OK ·
     build OK · verify: OK` (exit 0).
  6. CI del PR: es el estado de los checks del PR (Auto-fix lo vigila y avisa si sale en rojo).
- **Checklist de auto-verificación:**
  - [x] Diff auto-revisado → `git diff --stat` (código): `AIKit.test.tsx +4/-1`, `AIKit.tsx 2/2`,
        `IAGuidePage.tsx 2/2`, `aiKit.ts +5/-9`. Son 4 archivos, 13 líneas añadidas y 14 quitadas.
  - [x] Archivos fuera de alcance = 0 → los 4 son del kit o de sus superficies, más `misiones/`.
  - [x] Migraciones = 1 head → sin migraciones; `alembic heads` OK en verify.
  - [x] Sin `console.log`, secretos ni `any` nuevos → el grep de la plantilla solo marca la línea 38
        del diff: el comentario «token filled in: any assistant…», un falso positivo de `: any` en
        prosa. No hay ningún tipo `any`.
  - [x] Puerta compartida → `verify: OK`.
  - [x] Criterios uno a uno → arriba.
- **Desviaciones o dudas:** ninguna. El comportamiento de la conexión no cambia: el JSON, el token y
  la ruta son los mismos. Solo desaparece el one-liner de un cliente concreto.
