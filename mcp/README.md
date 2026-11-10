# KoreX MCP server

Lets an AI assistant (Claude Desktop, Claude Code, any MCP client) work with **your** KoreX:
read your accounts and plan, record payments, run simulations. It only sees your data, only
with the permissions you gave the token, and stops working the moment you revoke it.

## 1. Create a token
KoreX → **Configuración → Conecta tu IA** → name it, tick the permissions, **Crear**.
Copy the token right away: it is shown only once (KoreX stores only its hash).

## 2. Install
Requires Python 3.10+.

```bash
cd mcp
python -m venv .venv
.venv/bin/pip install -r requirements.txt        # Windows: .venv\Scripts\pip install -r requirements.txt
```

## 3. Connect your client

**Claude Desktop** — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "korex": {
      "command": "/ABSOLUTE/PATH/KoreX/mcp/.venv/bin/python",
      "args": ["/ABSOLUTE/PATH/KoreX/mcp/korex_mcp.py"],
      "env": { "KOREX_API_TOKEN": "kx_PASTE_YOUR_TOKEN" }
    }
  }
}
```
On Windows use `...\\mcp\\.venv\\Scripts\\python.exe`.

**Claude Code**:

```bash
claude mcp add korex --env KOREX_API_TOKEN=kx_PASTE_YOUR_TOKEN -- /ABSOLUTE/PATH/KoreX/mcp/.venv/bin/python /ABSOLUTE/PATH/KoreX/mcp/korex_mcp.py
```

Optional: `KOREX_API_URL` (default `https://corex-sf-production.up.railway.app`; use
`http://localhost:8001` against a local backend).

## Tools

| Tool | What it does | Scope needed |
|---|---|---|
| `list_accounts` | Your accounts with balance, APR, minimum payment | `read:accounts` |
| `get_dashboard_summary` | Dashboard totals and projections (estimates) | `read:dashboard` |
| `get_action_plan` | Which debt to attack next, freedom dates (estimates) | `read:plan` |
| `register_payment` | Record a payment `{account (id or name), amount, date?}` | `write:payments` |
| `add_account` | Add `{name, type, balance, interest_rate, min_payment}` | `write:accounts` |
| `update_account` | Correct an account: only the fields you pass `{account, name?, balance?, interest_rate?, min_payment?, ...}` | `write:accounts` |
| `delete_account` | Delete an account and its transactions `{account, confirm}`; asks for confirmation first | `write:accounts` |
| `korex_judge_purchase` | Juez de compras: months/days a purchase `{amount}` delays your freedom, freedom date before → after | `run:simulations` |
| `get_settings` | Your app settings | `read:dashboard` |

## Security
- The token acts only on its owner's data; the server derives the user from the token.
- Missing permission → 403; revoked token → 401; limit 60 requests/minute per token.
- Every write made with a token is recorded in an audit log (token, action, date).
- Keep the token out of repos and chats. If it leaks, revoke it in KoreX and create a new one.
- All figures returned are estimates, not financial advice.
