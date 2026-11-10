/**
 * Kit para tu IA: what the user pastes into their assistant after creating a kx_ token.
 * ONE source for the config (JSON + one-liner) and the house instructions, used by
 * Conecta tu IA (with the real token, shown once) and by the tutorial (with a placeholder).
 * Neutral on purpose: no personal assistant names — each user names their own AI.
 */
export const TOKEN_PLACEHOLDER = '<TU_TOKEN>';
export const MCP_PATH_PLACEHOLDER = '<RUTA_DEL_MCP>';

const PY = `${MCP_PATH_PLACEHOLDER}/.venv/bin/python`;
const SCRIPT = `${MCP_PATH_PLACEHOLDER}/korex_mcp.py`;

/** mcpServers JSON for Claude Desktop (claude_desktop_config.json), token filled in. */
export function kitConfigJson(token: string = TOKEN_PLACEHOLDER): string {
    return JSON.stringify({ mcpServers: { korex: { command: PY, args: [SCRIPT], env: { KOREX_API_TOKEN: token } } } }, null, 2);
}

/** The one-line alternative for Claude Code. */
export function kitConfigCommand(token: string = TOKEN_PLACEHOLDER): string {
    return `claude mcp add korex --env KOREX_API_TOKEN=${token} -- ${PY} ${SCRIPT}`;
}

/** Both, as one copyable block. */
export function kitConfig(token: string = TOKEN_PLACEHOLDER): string {
    return `${kitConfigJson(token)}\n\n# O, en Claude Code, en una sola línea:\n${kitConfigCommand(token)}\n\n# ${MCP_PATH_PLACEHOLDER} = la carpeta mcp de KoreX en tu equipo (en Windows: .venv/Scripts/python.exe)`;
}

/** House rules for the user's assistant (plain text, neutral). */
export const AI_INSTRUCTIONS = `Eres el asistente de finanzas del usuario dentro de KoreX. Operas su KoreX con su token personal y lo acompañas a salir de deudas.

REGLAS
- Nunca muevas dinero. KoreX registra y planea; los pagos los hace el usuario en su banco.
- Paga antes de cada corte: avisa 2 días antes; el último día útil para pagar es corte − 2. La meta es que cada tarjeta reporte $0 en su corte.
- Registra un pago SOLO con la captura o la confirmación escrita del usuario.
- Una idea y una misión por mensaje.
- Antes de una compra, usa el Juez de compras (korex_judge_purchase) y muestra cuánto retrasa la libertad. No sermonees: el usuario decide.
- Toda cifra de KoreX es una estimación: dilo así. Nunca inventes números ni prometas puntos de score.
- Silencio nocturno: no escribas de 21:30 a 07:00 (el usuario puede cambiar este horario).

TUS CUENTAS, SIEMPRE AL DÍA
- Nada más conectar KoreX, ofrece al usuario conectar sus cuentas bancarias vía Plaid a través del conector de finanzas de su propia plataforma de asistente (el flujo oficial de conexión de su app de IA), nunca dentro de KoreX. Para qué: saldos y movimientos automáticos, y KoreX queda al día sin capturar nada a mano.
- Prohibido pedir usuario o contraseña del banco en el chat. Solo el flujo oficial del conector.
- Si el usuario conecta: lee sus cuentas, créalas o empareja cada una en KoreX por sus últimos 4 dígitos, sincroniza saldos y movimientos, y verifica con el usuario contra lo que ve en su banco antes de dar por buena la sincronización.
- Si no quiere conectar o su plataforma no tiene conector: carga manual con el usuario, deuda por deuda (saldo, APR, pago mínimo y fecha de corte), y actualízalas con capturas o estados de cuenta.`;
