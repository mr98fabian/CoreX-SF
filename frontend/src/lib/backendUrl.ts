/** The backend on Railway. Kept apart from lib/api so screens can show the MCP URL without the API client. */
export const RAILWAY_URL = 'https://corex-sf-production.up.railway.app';
/** The remote MCP (backend/mcp_remote.py): what a user pastes as a custom connector. Not a secret. */
export const MCP_REMOTE_URL = `${RAILWAY_URL}/mcp`;
