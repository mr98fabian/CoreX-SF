# KoreX MCP server

Lets the AI assistant you already use (any MCP client) work with **your** KoreX: read your
accounts and plan, run simulations, load your accounts and goals. It only sees your data,
only with the permissions you approved, and stops working the moment you revoke it.

There are two ways to connect. Both expose the same tools and the same instructions.

## Recommended: connect by link (remote)

Works from your phone. You don't need a computer, Python or a token to copy.

1. **Open your assistant.** Any AI assistant you already use works: look for where to add a
   connector or an MCP server.
2. **Paste this URL:**

   ```
   https://corex-sf-production.up.railway.app/mcp
   ```

3. **Sign in to KoreX and tap Autorizar.**

Your assistant never sees your password and can't record payments or move money.

How it works (OAuth 2.1, KoreX's own authorization server, `backend/routers/oauth.py`):
- The assistant discovers KoreX's endpoints (`/.well-known/oauth-protected-resource`,
  `/.well-known/oauth-authorization-server`), registers itself (dynamic client registration)
  and sends you to KoreX's consent screen with PKCE (S256).
- When you approve, it gets an access token (1 hour, renewed with a rotating refresh token).
  That token is a normal KoreX API token: stored hashed, rate limited (60/min), every write
  audited, and checked against your paid plan on every call.
- It can only get these permissions: see your accounts, dashboard and plan, run simulations,
  and load accounts and goals. **Recording payments is never granted by link.**
- The connection shows up in KoreX → **Ajustes → Conecta tu IA** as *Conectado por enlace*;
  revoking it there ends it immediately.

## Advanced: local kit with a token (computer)

The same server running on your computer over stdio, authorized with a personal token.

### 1. Create a token
KoreX → **Ajustes → Conecta tu IA → Opciones avanzadas** → name it, tick the permissions,
**Crear token**. Copy it right away: it is shown only once (KoreX stores only its hash).

### 2. Install
Requires Python 3.10+ and a copy of the KoreX repository.

```bash
cd mcp
python -m venv .venv
.venv/bin/pip install -r requirements.txt        # Windows: .venv\Scripts\pip install -r requirements.txt
```

### 3. Connect your client

Clients configured with a JSON file use this entry:

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
On Windows use `...\\mcp\\.venv\\Scripts\\python.exe`. Clients configured from the command
line take the same command, arguments and `KOREX_API_TOKEN` variable.

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
| `korex_goals` | Your own savings goals with progress and estimated date (house goal excluded) | `read:dashboard` |
| `korex_set_goal` | Create or edit a goal `{name, target_amount, saved_amount?, monthly_saving?, deadline?, goal?}` | `write:accounts` |
| `korex_add_goal_savings` | Record money put aside for a goal `{goal, amount}` | `write:accounts` |
| `get_settings` | Your app settings | `read:dashboard` |

## Security
- Access acts only on its owner's data; the server derives the user from the token.
- Missing permission → 403; revoked or expired → 401; limit 60 requests/minute per token.
- Every write is recorded in an audit log (connection, action, date).
- Keep tokens out of repos and chats. If one leaks, revoke it in KoreX and create a new one.
- All figures returned are estimates, not financial advice.
