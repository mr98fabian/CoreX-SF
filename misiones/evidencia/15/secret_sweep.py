"""Misión 15 — barrido de secretos. Imprime SOLO ruta/commit + tipo de patrón, nunca el valor.
Uso: python secret_sweep.py  (desde la raíz del repo)."""
import re, subprocess, sys
PATTERNS = {
    "stripe_live_secret": r"sk_live_[0-9A-Za-z]{16,}",
    "stripe_test_secret": r"sk_test_[0-9A-Za-z]{16,}",
    "stripe_restricted": r"rk_(live|test)_[0-9A-Za-z]{16,}",
    "stripe_webhook_secret": r"whsec_[0-9A-Za-z]{16,}",
    "private_key_block": r"-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----",
    "gcp_service_account": r"\"type\":\s*\"service_account\"",
    "google_api_key": r"AIza[0-9A-Za-z\-_]{35}",
    "aws_access_key": r"AKIA[0-9A-Z]{16}",
    "github_token": r"gh[pousr]_[0-9A-Za-z]{36,}",
    "slack_token": r"xox[abpr]-[0-9A-Za-z-]{10,}",
    "jwt_like": r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}",
    "postgres_url_with_password": r"postgres(ql)?://[^:\s/]+:[^@\s]{6,}@",
    "supabase_secret_key": r"sb_secret_[0-9A-Za-z_-]{20,}",
    "korex_api_token": r"\bkx[_ar]?_[A-Za-z0-9_-]{40,}",
    "plaid_secret_assign": r"PLAID_SECRET\s*[=:]\s*['\"]?[0-9a-f]{20,}",
    "resend_key": r"\bre_[A-Za-z0-9]{20,}",
    "lemon_api_key": r"LEMON[A-Z_]*KEY\s*[=:]\s*['\"]?eyJ",
}
RX = {k: re.compile(v) for k, v in PATTERNS.items()}
ALLOW = re.compile(r"(demo-stress-test-token|example|placeholder|xxxx|<[^>]+>)", re.I)

def scan_lines(lines, where):
    hits = []
    for i, line in enumerate(lines, 1):
        for name, rx in RX.items():
            m = rx.search(line)
            if m and not ALLOW.search(m.group(0)):
                hits.append(f"{where(i)}  [{name}]")
    return hits

def tree():
    files = subprocess.run(["git", "-c", "core.quotepath=off", "ls-files"], capture_output=True, text=True).stdout.split("\n")
    out = []
    for f in filter(None, files):
        try:
            with open(f, encoding="utf-8", errors="ignore") as fh:
                out += scan_lines(fh.read().split("\n"), lambda i, f=f: f"{f}:{i}")
        except OSError:
            pass
    return out

def history():
    p = subprocess.Popen(["git", "-c", "core.quotepath=off", "log", "-p", "--all", "--no-color", "--format=COMMIT %h"], env={**__import__("os").environ},
                         stdout=subprocess.PIPE, text=True, encoding="utf-8", errors="ignore")
    commit, path, out, seen = "?", "?", [], set()
    for line in p.stdout:
        if line.startswith("COMMIT "):
            commit = line.split()[1]; continue
        if line.startswith("+++ b/"):
            path = line[6:].strip(); continue
        if not line.startswith("+") or line.startswith("+++"):
            continue
        for name, rx in RX.items():
            m = rx.search(line)
            if m and not ALLOW.search(m.group(0)):
                key = (path, name)
                if key not in seen:
                    seen.add(key); out.append(f"{commit} {path}  [{name}] (primera aparición vista)")
    return out

if __name__ == "__main__":
    t, h = tree(), history()
    n = subprocess.run(["git", "rev-list", "--all", "--count"], capture_output=True, text=True).stdout.strip()
    print(f"== Árbol (git ls-files): {len(t)} coincidencias"); print("\n".join(t) or "(limpio)")
    print(f"\n== Historial (git log -p --all, {n} commits): {len(h)} coincidencias únicas (ruta, tipo)")
    print("\n".join(h) or "(limpio)")
