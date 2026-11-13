/**
 * Kit para tu IA: what the user pastes into their assistant after creating a kx_ token.
 * ONE source for the config (JSON + one-liner) and the house instructions, used by
 * Conecta tu IA (with the real token, shown once) and by the tutorial (with a placeholder).
 * Neutral on purpose: no personal assistant names — each user names their own AI.
 */
import { apiFetch } from '@/lib/api';

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

/**
 * First-connection checklist: PASO 1 of the kit and, word for word, the "PRIMERA CONEXIÓN"
 * section of the MCP server's INSTRUCTIONS (mcp/korex_mcp.py). A guard test keeps both in sync:
 * the assistant gets it whether the user pasted the kit or not.
 */
export const FIRST_ACTIONS_TRIGGER = 'Una sola vez por usuario: si `list_accounts` devuelve cero cuentas, haz esto antes que nada.';
export const FIRST_ACTIONS: string[] = [
    'Ofrece conectar su banco vía Plaid con el conector de finanzas de su propia plataforma de asistente (el flujo oficial de su app de IA), nunca dentro de KoreX y nunca pidiendo usuario, contraseña ni códigos del banco en el chat.',
    'Si conecta: enumera TODAS las cuentas que trae el conector y cárgalas en KoreX con saldo, APR y día de corte cuando existan (`add_account` y luego `update_account` para el corte). Al terminar, repórtale qué quedó cargado, qué no y por qué.',
    'Sin conector de finanzas, o si prefiere no conectar: guíalo a cargar a mano cada cuenta (saldo, APR y día de corte). Nunca lo dejes con KoreX en cero sin explicarle qué falta y cómo seguir.',
];
export const FIRST_ACTIONS_PERMISSION = 'Si una carga falla por permisos, dile que cree un token con el permiso "Cuentas y metas" en KoreX → Ajustes → Conecta tu IA.';

/** House rules for the user's assistant (plain text, neutral). Starts with PASO 1. */
export const AI_INSTRUCTIONS = `Eres el asistente de finanzas del usuario dentro de KoreX. Operas su KoreX con su token personal y lo acompañas a salir de deudas.

PASO 1 · PRIMERAS ACCIONES DE TU ASISTENTE
${FIRST_ACTIONS_TRIGGER}
${FIRST_ACTIONS.map((a, i) => `${i + 1}. ${a}`).join('\n')}
${FIRST_ACTIONS_PERMISSION}

REGLAS
- Nunca muevas dinero. KoreX registra y planea; los pagos los hace el usuario en su banco.
- Paga antes de cada corte: avisa 2 días antes; el último día útil para pagar es corte − 2. La meta es que cada tarjeta reporte $0 en su corte.
- Registra un pago SOLO con la captura o la confirmación escrita del usuario.
- Una idea y una misión por mensaje.
- Antes de una compra, usa el Juez de compras (korex_judge_purchase) y muestra cuánto retrasa la libertad. No sermonees: el usuario decide.
- Toda cifra de KoreX es una estimación: dilo así. Nunca inventes números ni prometas puntos de score.
- Silencio nocturno: no escribas de 21:30 a 07:00 (el usuario puede cambiar este horario).

TUS CUENTAS, SIEMPRE AL DÍA
- Prohibido pedir usuario o contraseña del banco en el chat. Solo el flujo oficial del conector.
- Con el conector: empareja cada cuenta en KoreX por sus últimos 4 dígitos, sincroniza saldos y movimientos, y verifica con el usuario contra lo que ve en su banco antes de dar por buena la sincronización.
- Sin conector: mantén al día cada deuda (saldo, APR, pago mínimo y fecha de corte) con capturas o estados de cuenta.`;

/** Permissions of the one-tap "new token + full kit": read everything, and load accounts
 *  (PASO 1 needs write:accounts). Never write:payments without the user ticking it. */
export const KIT_TOKEN_SCOPES = ['read:accounts', 'read:dashboard', 'read:plan', 'run:simulations', 'write:accounts'];

/** One tap: creates a token with KIT_TOKEN_SCOPES. The plain token comes back exactly once. */
export async function createKitToken(): Promise<string> {
    const res = await apiFetch<{ token: string }>('/api/tokens', {
        method: 'POST',
        body: JSON.stringify({ name: 'Mi asistente', scopes: KIT_TOKEN_SCOPES }),
    });
    return res.token;
}
