"""H-06 (mission 21): korexf.com can't be framed and runs under a CSP (vercel.json headers).

Guard: the CSP allows the one inline <script> of index.html by hash, so editing that script
without updating the hash would silently stop it (service worker registration). This test
recomputes the hash from index.html (LF, as Vercel checks it out) and fails if they diverge.
"""
import base64
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _all_routes_headers():
    conf = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    rule = next(h for h in conf["headers"] if h["source"] == "/(.*)")
    return {h["key"]: h["value"] for h in rule["headers"]}


def _directives(csp):
    return {d.split()[0]: d.split()[1:] for d in (x.strip() for x in csp.split(";")) if d}


def test_every_route_denies_framing():
    headers = _all_routes_headers()
    assert headers["X-Frame-Options"] == "DENY"
    assert _directives(headers["Content-Security-Policy"])["frame-ancestors"] == ["'none'"]


def test_csp_has_no_script_escape_hatches():
    d = _directives(_all_routes_headers()["Content-Security-Policy"])
    assert d["default-src"] == ["'self'"]
    assert d["object-src"] == ["'none'"] and d["base-uri"] == ["'self'"]
    for bad in ("'unsafe-inline'", "'unsafe-eval'", "*", "https:", "data:"):
        assert bad not in d["script-src"], bad


def test_inline_script_hash_matches_index_html():
    html = (ROOT / "frontend" / "index.html").read_bytes().replace(b"\r\n", b"\n")
    inline = re.findall(rb"<script>(.*?)</script>", html, re.S)
    allowed = set(_directives(_all_routes_headers()["Content-Security-Policy"])["script-src"])
    for body in inline:
        digest = "'sha256-" + base64.b64encode(hashlib.sha256(body).digest()).decode() + "'"
        assert digest in allowed, "inline <script> in index.html changed: update its hash in vercel.json"
