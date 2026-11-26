"""Misión 15 — matriz IDOR + OAuth/MCP + webhooks, contra la app REAL en proceso (TestClient).

Sin overrides de auth: A y B se autentican con JWT HS256 firmados con un secreto de prueba local
(la misma ruta _verify_locally de producción, con la llave simétrica en vez de la JWKS).
SQLite en memoria: ningún dato de producción ni de korex.db se toca; todo muere al salir.

Uso (desde backend/):  ./venv/Scripts/python.exe ../misiones/evidencia/15/idor_matrix.py
"""
import base64, hashlib, hmac, json, os, secrets, sys, time
from datetime import datetime, timedelta
from urllib.parse import parse_qs, urlparse

TEST_SECRET = secrets.token_urlsafe(32)
os.environ.update({"ENVIRONMENT": "development", "DATABASE_URL": "sqlite://", "SUPABASE_URL": "",
                   "SUPABASE_JWT_SECRET": TEST_SECRET, "MCP_REMOTE_ENABLED": "1",
                   "OAUTH_ISSUER_URL": "http://testserver", "FRONTEND_URL": "https://korexf.com",
                   "STRIPE_WEBHOOK_SECRET": "whsec_local_" + secrets.token_hex(8), "OWNER_USER_ID": "",
                   "SUPABASE_SERVICE_ROLE_KEY": ""})
for k in ("GOOGLE_RTDN_AUDIENCE", "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"):
    os.environ.pop(k, None)
sys.path.insert(0, os.getcwd())

import jwt  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402
from sqlmodel import Session, SQLModel, create_engine, select  # noqa: E402
import database  # noqa: E402
database.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
import auth  # noqa: E402
from models import (Account, ApiToken, CashflowItem, Goal, PushDevice, Subscription)  # noqa: E402

auth.SUPABASE_JWT_SECRET = TEST_SECRET
SQLModel.metadata.create_all(database.engine)

A = "aaaaaaaa-0015-4aaa-8aaa-aaaaaaaaaaaa"
B = "bbbbbbbb-0015-4bbb-8bbb-bbbbbbbbbbbb"
rows, fails = [], []


def jwt_for(uid, exp_s=3600, secret=TEST_SECRET):
    now = int(time.time())
    return jwt.encode({"sub": uid, "aud": "authenticated", "exp": now + exp_s, "iat": now}, secret, algorithm="HS256")


HA = {"Authorization": f"Bearer {jwt_for(A)}"}
HB = {"Authorization": f"Bearer {jwt_for(B)}"}
H0 = {}


def check(area, label, resp, ok, expect):
    good = ok(resp)
    rows.append(f"{'PASS' if good else 'FAIL'}  {area:<14} {label:<62} → {resp.status_code}  (esperado: {expect})")
    if not good:
        fails.append(f"{area} {label}: {resp.status_code} {resp.text[:200]}")


def denied(r):
    return r.status_code in (401, 403, 404)


def unauth(r):
    return r.status_code == 401


with Session(database.engine) as s:  # both on a paid plan so tokens / OAuth are reachable
    for uid in (A, B):
        s.add(Subscription(user_id=uid, plan="freedom", status="active"))
    s.commit()

c = TestClient(app)

# ── A crea sus recursos ───────────────────────────────────────────────────────────────
acc = c.post("/api/accounts", headers=HA, json={"name": "A-Visa", "type": "debt", "balance": 1000, "interest_rate": 20,
                                                "min_payment": 30, "payment_frequency": "monthly"}).json()
chk = c.post("/api/accounts", headers=HA, json={"name": "A-Nomina", "type": "checking", "balance": 500, "interest_rate": 0,
                                                "min_payment": 0, "payment_frequency": "monthly"}).json()
AID, CHK = acc["id"], chk["id"]
cf = c.post("/api/cashflow", headers=HA, json={"name": "A-Sueldo", "amount": 100, "category": "income",
                                               "frequency": "monthly", "day_of_month": 1, "account_id": CHK}).json()
CFID = cf["id"]
goal = c.post("/api/goals", headers=HA, json={"name": "A-Meta", "target_amount": 900}).json()
GID = goal["id"]
sub = c.post("/api/subscriptions", headers=HA, json={"name": "A-Netflix", "amount": 15}).json()
SID = sub["id"]
TOK_A = "fcmA_" + secrets.token_hex(12)
c.post("/api/push/devices", headers=HA, json={"token": TOK_A})
tok = c.post("/api/tokens", headers=HA, json={"name": "A-kit", "scopes": ["read:accounts", "write:accounts"]}).json()
TID, KX_A = tok["id"], tok["token"]
c.patch("/api/settings", headers=HA, json={"onboarding_complete": True})
assert all(isinstance(x, int) for x in (AID, CHK, CFID, GID, SID, TID)), "setup de A falló"

# ── 1) Sin token: 401 en todo endpoint protegido ──────────────────────────────────────
protected = [("GET", "/api/accounts"), ("POST", "/api/accounts"), ("PUT", f"/api/accounts/{AID}"),
             ("PATCH", f"/api/accounts/{AID}/balance"), ("DELETE", f"/api/accounts/{AID}"), ("DELETE", "/api/accounts"),
             ("GET", f"/api/accounts/{AID}/transactions"), ("POST", "/api/transactions"), ("GET", "/api/transactions/all"),
             ("GET", "/api/cashflow"), ("PUT", f"/api/cashflow/{CFID}"), ("DELETE", f"/api/cashflow/{CFID}"),
             ("POST", f"/api/cashflow/{CFID}/confirm"), ("GET", "/api/goals"), ("DELETE", f"/api/goals/{GID}"),
             ("GET", "/api/subscriptions"), ("DELETE", f"/api/subscriptions/{SID}"), ("GET", "/api/subscriptions/status"),
             ("POST", "/api/subscriptions/checkout"), ("POST", "/api/subscriptions/portal"), ("GET", "/api/settings"),
             ("PATCH", "/api/settings"), ("GET", "/api/push/preferences"), ("POST", "/api/push/devices"),
             ("DELETE", "/api/push/devices"), ("GET", "/api/push/email"), ("POST", "/api/codes/redeem"),
             ("GET", "/api/admin/codes"), ("GET", "/api/tokens"), ("POST", "/api/tokens"), ("DELETE", f"/api/tokens/{TID}"),
             ("GET", "/api/tokens/audit"), ("DELETE", "/api/user/me"), ("GET", "/api/dashboard"), ("GET", "/api/calendar/events"),
             ("POST", "/api/sync/mark"), ("GET", "/api/cuts"), ("GET", "/api/house-goal"), ("GET", "/api/coach-profile"),
             ("GET", "/api/strategy/command-center"), ("POST", "/api/oauth/consent/approve"), ("GET", "/api/webauthn/status"),
             ("POST", "/api/subscriptions/google/verify"), ("GET", "/api/ranking"), ("POST", "/api/engagement/checkin")]
for m, p in protected:
    check("sin-token", f"{m} {p}", c.request(m, p, json={}), unauth, "401")
# JWT caducado / firma ajena / alg none
check("sin-token", "GET /api/accounts con JWT caducado", c.get("/api/accounts", headers={"Authorization": f"Bearer {jwt_for(A, -60)}"}), unauth, "401")
check("sin-token", "GET /api/accounts con JWT de otra llave", c.get("/api/accounts", headers={"Authorization": f"Bearer {jwt_for(A, secret='otra')}"}), unauth, "401")
none_tok = base64.urlsafe_b64encode(b'{"alg":"none"}').rstrip(b"=").decode() + "." + base64.urlsafe_b64encode(
    json.dumps({"sub": A, "aud": "authenticated", "exp": int(time.time()) + 600}).encode()).rstrip(b"=").decode() + "."
check("sin-token", "GET /api/accounts con alg=none", c.get("/api/accounts", headers={"Authorization": f"Bearer {none_tok}"}), lambda r: r.status_code in (401, 500), "401 (o 500 sin SUPABASE_URL: nunca 200)")

# ── 2) B contra lo de A ───────────────────────────────────────────────────────────────
ids = lambda r: {x.get("id") for x in (r.json() if isinstance(r.json(), list) else r.json().get("accounts", r.json().get("items", [])))}
r = c.get("/api/accounts", headers=HB); check("cuentas", "B GET /api/accounts no ve las de A", r, lambda r: r.status_code == 200 and not ({AID, CHK} & ids(r)), "200 sin ids de A")
check("cuentas", f"B PUT /api/accounts/{AID}", c.put(f"/api/accounts/{AID}", headers=HB, json={"name": "pwn"}), denied, "404")
check("cuentas", f"B PATCH /api/accounts/{AID}/balance", c.patch(f"/api/accounts/{AID}/balance", headers=HB, json={"balance": 1}), denied, "404")
check("cuentas", f"B DELETE /api/accounts/{AID}", c.delete(f"/api/accounts/{AID}", headers=HB), denied, "404")
check("cuentas", f"B GET /api/accounts/{AID}/transactions", c.get(f"/api/accounts/{AID}/transactions", headers=HB), denied, "404")
r = c.delete("/api/accounts", headers=HB); check("cuentas", "B DELETE /api/accounts (borrado masivo) no toca a A", r, lambda r: r.status_code < 500, "2xx solo de B")
check("deudas", "B POST /api/transactions sobre la cuenta de A", c.post("/api/transactions", headers=HB, json={"account_id": AID, "amount": 50, "description": "x", "category": "payment"}), denied, "404")
check("deudas", "B POST /api/transactions con funding_account_id de A", c.post("/api/transactions", headers=HB, json={"account_id": AID, "amount": 5, "description": "x", "category": "payment", "funding_account_id": CHK}), denied, "404")
r = c.get(f"/api/transactions/all?account_id={AID}", headers=HB); check("deudas", "B GET /api/transactions/all?account_id=A", r, lambda r: r.status_code == 200 and "A-" not in r.text, "200 vacío")
check("deudas", "B POST /api/cuts sobre la cuenta de A", c.post("/api/cuts", headers=HB, json={"account_id": AID, "cut_date": "2026-11-01", "reported_balance": 1}), denied, "404")
r = c.get(f"/api/cuts?account_id={AID}", headers=HB); check("deudas", "B GET /api/cuts?account_id=A", r, lambda r: r.status_code in (200, 404) and "A-" not in r.text, "vacío/404")
check("cashflow", f"B PUT /api/cashflow/{CFID}", c.put(f"/api/cashflow/{CFID}", headers=HB, json={"amount": 1}), denied, "404")
check("cashflow", f"B DELETE /api/cashflow/{CFID}", c.delete(f"/api/cashflow/{CFID}", headers=HB), denied, "404")
check("cashflow", f"B POST /api/cashflow/{CFID}/confirm", c.post(f"/api/cashflow/{CFID}/confirm", headers=HB, json={"actual_amount": 1}), denied, "404")
check("cashflow", f"B POST /api/cashflow/{CFID}/snooze", c.post(f"/api/cashflow/{CFID}/snooze", headers=HB, json={"hours": 1}), lambda r: r.status_code in (403, 404, 422), "404")
check("cashflow", "B POST /api/cashflow con account_id de A", c.post("/api/cashflow", headers=HB, json={"name": "x", "amount": 1, "category": "income", "frequency": "monthly", "day_of_month": 1, "account_id": CHK}), denied, "404/403")
check("metas", f"B PATCH /api/goals/{GID}", c.patch(f"/api/goals/{GID}", headers=HB, json={"name": "pwn"}), denied, "404")
check("metas", f"B DELETE /api/goals/{GID}", c.delete(f"/api/goals/{GID}", headers=HB), denied, "404")
check("metas", f"B POST /api/goals/{GID}/add-savings", c.post(f"/api/goals/{GID}/add-savings", headers=HB, json={"amount": 1}), denied, "404")
r = c.get("/api/subscriptions", headers=HB); check("suscripciones", "B GET /api/subscriptions no ve las de A", r, lambda r: r.status_code == 200 and "A-Netflix" not in r.text, "200 sin A")
check("suscripciones", f"B PATCH /api/subscriptions/{SID}", c.patch(f"/api/subscriptions/{SID}", headers=HB, json={"name": "pwn"}), denied, "404")
check("suscripciones", f"B DELETE /api/subscriptions/{SID}", c.delete(f"/api/subscriptions/{SID}", headers=HB), denied, "404")
check("suscripciones", "B POST /api/subscriptions con account_id de A", c.post("/api/subscriptions", headers=HB, json={"name": "x", "amount": 1, "account_id": CHK}), denied, "404/403")
r = c.get("/api/settings", headers=HB); check("ajustes", "B GET /api/settings es el suyo (onboarding de A no filtra)", r, lambda r: r.status_code == 200 and r.json().get("onboarding_complete") in (False, None), "200, onboarding false")
check("push", "B DELETE /api/push/devices con el token FCM de A", c.request("DELETE", "/api/push/devices", headers=HB, json={"token": TOK_A}), lambda r: r.status_code < 500, "2xx sin efecto")
with Session(database.engine) as s:
    owner = s.exec(select(PushDevice).where(PushDevice.fcm_token == TOK_A)).first()
check("push", "…el dispositivo de A sigue siendo de A", type("R", (), {"status_code": 200 if owner and owner.user_id == A else 409, "text": ""})(), lambda r: r.status_code == 200, "dueño A")
r = c.post("/api/push/devices", headers=HB, json={"token": TOK_A})
with Session(database.engine) as s:
    owner = s.exec(select(PushDevice).where(PushDevice.fcm_token == TOK_A)).first()
rows.append(f"INFO  push           B POST /api/push/devices con el token FCM de A → {r.status_code}; dueño final: {'B (reasignado)' if owner and owner.user_id == B else 'A'}")
r = c.get("/api/tokens", headers=HB); check("tokens", "B GET /api/tokens no lista el de A", r, lambda r: r.status_code == 200 and TID not in {t['id'] for t in r.json()}, "200 sin A")
check("tokens", f"B DELETE /api/tokens/{TID}", c.delete(f"/api/tokens/{TID}", headers=HB), denied, "404")
r = c.get("/api/tokens/audit", headers=HB); check("tokens", "B GET /api/tokens/audit vacío", r, lambda r: r.status_code == 200 and r.json() == [], "200 []")
KA = {"Authorization": f"Bearer {KX_A}"}
r = c.get("/api/accounts", headers=KA); check("tokens", "token kx_ de A lee SOLO las cuentas de A", r, lambda r: r.status_code == 200 and {AID, CHK} <= ids(r), "200 con A")
check("tokens", "token kx_ en endpoint sin opt-in (GET /api/tokens)", c.get("/api/tokens", headers=KA), lambda r: r.status_code == 403, "403")
check("tokens", "token kx_ no puede borrar la cuenta (DELETE /api/user/me)", c.request("DELETE", "/api/user/me", headers=KA, json={}), lambda r: r.status_code == 403, "403")
check("tokens", "token kx_ sin scope write:payments (POST /api/transactions)", c.post("/api/transactions", headers=KA, json={"account_id": AID, "amount": 1, "description": "x", "category": "payment"}), lambda r: r.status_code == 403, "403")
c.delete(f"/api/tokens/{TID}", headers=HA)
check("tokens", "token kx_ revocado → 401 de verdad", c.get("/api/accounts", headers=KA), unauth, "401")
check("codigos", "B GET /api/admin/codes (no dueño)", c.get("/api/admin/codes", headers=HB), lambda r: r.status_code in (403, 404, 503), "403")
check("codigos", "B POST /api/admin/codes (no dueño)", c.post("/api/admin/codes", headers=HB, json={"kind": "founder"}), lambda r: r.status_code in (403, 404, 422, 503), "403")
codes = [c.post("/api/codes/redeem", headers=HB, json={"code": f"KX-{secrets.token_hex(6).upper()}"}).status_code for _ in range(7)]
rows.append(f"{'PASS' if 429 in codes else 'FAIL'}  codigos        B canjea 7 códigos inventados seguidos → {codes}  (esperado: 400/503… y 429 al 6.º)")
if 429 not in codes:
    fails.append(f"codigos rate limit: {codes}")
check("cuenta", "B DELETE /api/user/me sin admin de Supabase → no borra nada", c.request("DELETE", "/api/user/me", headers=HB, json={"password": "x"}), lambda r: r.status_code in (403, 503), "503 (fail-closed)")

# Integridad final de A
with Session(database.engine) as s:
    a_acc = s.get(Account, AID); a_cf = s.get(CashflowItem, CFID); a_goal = s.get(Goal, GID)
    intact = a_acc and a_acc.name == "A-Visa" and float(a_acc.balance) == 1000 and a_cf and float(a_cf.amount) == 100 \
        and a_goal and a_goal.name == "A-Meta" and s.get(Account, CHK) is not None
rows.append(f"{'PASS' if intact else 'FAIL'}  integridad     Datos de A intactos tras todos los intentos de B")
if not intact:
    fails.append("integridad de A rota")

# ── 3) OAuth / MCP ────────────────────────────────────────────────────────────────────
from routers import oauth  # noqa: E402
oauth.limiter.reset()
REDIRECT = "https://claude.ai/api/mcp/auth_callback"
q = lambda loc: {k: v[0] for k, v in parse_qs(urlparse(loc).query).items()}
cid = c.post("/oauth/register", json={"client_name": "M15", "redirect_uris": [REDIRECT], "token_endpoint_auth_method": "none"}).json()["client_id"]
ver = secrets.token_urlsafe(48)
chal = base64.urlsafe_b64encode(hashlib.sha256(ver.encode()).digest()).rstrip(b"=").decode()
auth_q = lambda **kw: c.get("/oauth/authorize", params={k: v for k, v in {"client_id": cid, "redirect_uri": REDIRECT, "response_type": "code", "code_challenge": chal, "code_challenge_method": "S256", "state": "s", **kw}.items() if v is not None}, follow_redirects=False)
r = auth_q(code_challenge=None, code_challenge_method=None); check("oauth", "authorize sin PKCE", r, lambda r: r.status_code == 302 and q(r.headers["location"]).get("error") == "invalid_request", "error invalid_request")
r = auth_q(code_challenge_method="plain"); check("oauth", "authorize con PKCE plain", r, lambda r: r.status_code == 302 and q(r.headers["location"]).get("error") == "invalid_request", "error invalid_request")
r = auth_q(scope="read:accounts write:payments"); check("oauth", "authorize pidiendo write:payments", r, lambda r: r.status_code == 302 and q(r.headers["location"]).get("error") == "invalid_scope", "invalid_scope")
r = auth_q(redirect_uri="https://evil.example/cb"); check("oauth", "authorize con redirect_uri no registrado", r, lambda r: r.status_code == 400, "400 sin redirigir")
r = c.post("/oauth/register", json={"redirect_uris": ["http://evil.example/cb"]}); check("oauth", "register con redirect http no-loopback", r, lambda r: r.status_code == 400, "400")
r = auth_q(); handle = q(r.headers["location"])["request"]
c.post("/api/oauth/consent/details", headers=HA, json={"request": handle})  # A owns it
check("oauth", "B aprueba el consentimiento de A", c.post("/api/oauth/consent/approve", headers=HB, json={"request": handle}), lambda r: r.status_code == 404, "404")
code = q(c.post("/api/oauth/consent/approve", headers=HA, json={"request": handle}).json()["redirect_to"])["code"]
tk = lambda **f: c.post("/oauth/token", data={"client_id": cid, **f})
r = tk(grant_type="authorization_code", code=code, redirect_uri=REDIRECT, code_verifier=secrets.token_urlsafe(48)); check("oauth", "token con code_verifier equivocado", r, lambda r: r.status_code == 400 and r.json()["error"] == "invalid_grant", "invalid_grant")
r = tk(grant_type="authorization_code", code=code, redirect_uri=REDIRECT, code_verifier=ver); check("oauth", "el code quemado tras un intento fallido no se reusa", r, lambda r: r.json().get("error") == "invalid_grant", "invalid_grant (un solo uso)")
# flujo limpio
r = auth_q(); handle = q(r.headers["location"])["request"]
c.post("/api/oauth/consent/details", headers=HA, json={"request": handle})
code = q(c.post("/api/oauth/consent/approve", headers=HA, json={"request": handle}).json()["redirect_to"])["code"]
t1 = tk(grant_type="authorization_code", code=code, redirect_uri=REDIRECT, code_verifier=ver).json()
check("oauth", "token emitido: scopes = kit, sin write:payments, expira 1 h", type("R", (), {"status_code": 200, "text": ""})(), lambda r: "write:payments" not in t1["scope"] and t1["expires_in"] == 3600, "kit, 3600")
MA = {"Authorization": f"Bearer {t1['access_token']}"}
check("oauth", "access OAuth no sirve en endpoint sin opt-in", c.get("/api/tokens", headers=MA), lambda r: r.status_code == 403, "403")
check("oauth", "access OAuth no puede registrar pagos", c.post("/api/transactions", headers=MA, json={"account_id": AID, "amount": 1, "description": "x", "category": "payment"}), lambda r: r.status_code == 403, "403")
t2 = tk(grant_type="refresh_token", refresh_token=t1["refresh_token"]).json()
check("oauth", "rotación: el access viejo muere al rotar", c.get("/api/accounts", headers=MA), unauth, "401")
r = tk(grant_type="refresh_token", refresh_token=t1["refresh_token"]); check("oauth", "reuso del refresh viejo", r, lambda r: r.json().get("error") == "invalid_grant", "invalid_grant")
check("oauth", "…y el reuso revoca la familia (access nuevo muerto)", c.get("/api/accounts", headers={"Authorization": f"Bearer {t2['access_token']}"}), unauth, "401")
r = tk(grant_type="refresh_token", refresh_token=t2["refresh_token"]); check("oauth", "…y el refresh nuevo también", r, lambda r: r.json().get("error") == "invalid_grant", "invalid_grant")
r = tk(grant_type="refresh_token", refresh_token=t2["refresh_token"], scope="read:accounts write:payments"); check("oauth", "refresh no puede ampliar scopes", r, lambda r: r.status_code == 400, "400")
mcp_body = {"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
mh = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json", "Host": "testserver"}
check("mcp", "POST /mcp sin token", c.post("/mcp", json=mcp_body, headers=mh), unauth, "401")
check("mcp", "POST /mcp con token en query string", c.post(f"/mcp?access_token={t2['access_token']}", json=mcp_body, headers=mh), unauth, "401")
check("mcp", "POST /mcp con token revocado", c.post("/mcp", json=mcp_body, headers={**mh, "Authorization": f"Bearer {t2['access_token']}"}), unauth, "401")
check("mcp", "POST /mcp con JWT de sesión (no kx_)", c.post("/mcp", json=mcp_body, headers={**mh, **HA}), unauth, "401")
with Session(database.engine) as s:  # an expired OAuth access token
    r0 = ApiToken(user_id=A, name="exp", token_hash=hashlib.sha256(b"kx_expired_m15_token_value_000000000000000000").hexdigest(),
                  scopes=["read:accounts"], source="oauth", expires_at=datetime.utcnow() - timedelta(minutes=1))
    s.add(r0); s.commit()
check("mcp", "token OAuth caducado en /api/accounts", c.get("/api/accounts", headers={"Authorization": "Bearer kx_expired_m15_token_value_000000000000000000"}), unauth, "401")

# ── 4) Webhooks ───────────────────────────────────────────────────────────────────────
secret = os.environ["STRIPE_WEBHOOK_SECRET"]
def sig(body, ts=None):
    ts = ts or int(time.time())
    return f"t={ts},v1=" + hmac.new(secret.encode(), f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
ev = json.dumps({"id": "evt_m15", "type": "customer.subscription.updated", "created": int(time.time()),
                 "data": {"object": {"id": "sub_m15", "customer": "cus_m15", "status": "active", "metadata": {"user_id": B},
                                     "items": {"data": [{"current_period_end": int(time.time()) + 86400}]}}}}).encode()
W = "/api/subscriptions/webhook"
check("stripe", "webhook sin firma", c.post(W, content=ev), lambda r: r.status_code == 401, "401")
check("stripe", "webhook con firma inventada", c.post(W, content=ev, headers={"Stripe-Signature": "t=1,v1=00"}), lambda r: r.status_code == 401, "401")
check("stripe", "webhook firmado hace 10 min (replay fuera de tolerancia)", c.post(W, content=ev, headers={"Stripe-Signature": sig(ev, int(time.time()) - 600)}), lambda r: r.status_code == 401, "401")
check("stripe", "webhook con cuerpo alterado tras firmar", c.post(W, content=ev.replace(b"active", b"canceled"), headers={"Stripe-Signature": sig(ev)}), lambda r: r.status_code == 401, "401")
r1 = c.post(W, content=ev, headers={"Stripe-Signature": sig(ev)}); r2 = c.post(W, content=ev, headers={"Stripe-Signature": sig(ev)})
with Session(database.engine) as s:
    n = len(s.exec(select(Subscription).where(Subscription.user_id == B)).all())
rows.append(f"{'PASS' if n == 1 and r1.status_code == 200 else 'FAIL'}  stripe         mismo evento entregado 2 veces → {r1.status_code}/{r2.status_code}; filas de B = {n}  (esperado: 1, sin duplicar)")
old = json.dumps({**json.loads(ev), "created": int(time.time()) - 3600, "data": {"object": {**json.loads(ev)["data"]["object"], "status": "canceled"}}}).encode()
r3 = c.post(W, content=old, headers={"Stripe-Signature": sig(old)})
with Session(database.engine) as s:
    st = s.exec(select(Subscription).where(Subscription.user_id == B)).first().status
rows.append(f"{'PASS' if st != 'expired' and 'stale' in r3.text else 'FAIL'}  stripe         evento viejo (1 h antes) re-firmado llega tarde → {r3.json().get('result')}; estado = {st}  (esperado: stale, no degrada)")
check("play-rtdn", "RTDN sin configurar → fail-closed", c.post("/api/subscriptions/google/rtdn", json={}), lambda r: r.status_code == 503, "503")

print("Misión 15 — matriz IDOR / OAuth / webhooks (app real en proceso, SQLite en memoria)")
print(f"Fecha: {datetime.utcnow():%Y-%m-%d %H:%M} UTC · actores: sin token, A={A[:8]}…, B={B[:8]}… (sintéticos)\n")
print("\n".join(rows))
print(f"\nTotal: {sum(r.startswith('PASS') for r in rows)} PASS · {len(fails)} FAIL · {sum(r.startswith('INFO') for r in rows)} INFO")
for f in fails:
    print("  FAIL →", f)
