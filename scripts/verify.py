#!/usr/bin/env python3
"""
La puerta compartida de verificación de KoreX (misión 2026-11-22-verificacion-origen).

Corre lo mismo que el CI y que el auditor:
  backend   pytest (desde backend/) y `alembic heads` == 1
  frontend  vitest, eslint --max-warnings 0 y build

Salidas:
  0  todo en verde, o el árbol de trabajo está limpio (no corre nada), o este mismo estado del árbol
     ya pasó en verde antes (caché por worktree en .git/…/verify-last-green)
  2  algo falló: imprime qué en stderr. Como hook `Stop` de Claude Code, el exit 2 impide cerrar el
     turno y le devuelve el motivo al ejecutor.

Fallos preexistentes: un check que ya fallaba en main se lista en scripts/verify-known-failures.txt
(«<check>  # misión-id: evidencia en su Reporte»). Se avisa pero no bloquea. Nunca se arregla en
silencio ni se lista sin la evidencia en el Reporte.

Uso:
  python scripts/verify.py          # lo que corre el auditor
  python scripts/verify.py --hook   # hook Stop (lee el JSON de Claude Code por stdin)
  python scripts/verify.py --force  # ignora la caché
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND, FRONTEND = ROOT / "backend", ROOT / "frontend"
KNOWN_FAILURES = ROOT / "scripts" / "verify-known-failures.txt"
TAIL = 25  # output lines shown for each failed check


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, encoding="utf-8",
                          errors="replace").stdout


def tree_state() -> str:
    """Empty when the working tree is clean; otherwise a hash of every pending change."""
    status = git("status", "--porcelain")
    if not status.strip():
        return ""
    h = hashlib.sha256()
    h.update(git("rev-parse", "HEAD").encode())
    h.update(status.encode())
    h.update(subprocess.run(["git", "diff", "HEAD", "--binary"], cwd=ROOT, capture_output=True).stdout)
    for line in git("ls-files", "--others", "--exclude-standard", "-z").split("\0"):
        f = ROOT / line
        if line and f.is_file():
            h.update(line.encode())
            h.update(f.read_bytes())
    return h.hexdigest()


def cache_file() -> Path:
    return (ROOT / git("rev-parse", "--git-path", "verify-last-green").strip()).resolve()


def backend_python() -> str:
    """The backend venv: this checkout's, else the main checkout's (worktrees share it), else ours."""
    roots = [ROOT]
    common = git("rev-parse", "--path-format=absolute", "--git-common-dir").strip()
    if common:
        roots.append(Path(common).parent)
    for r in roots:
        for rel in ("backend/venv/Scripts/python.exe", "backend/venv/bin/python", "backend/.venv/Scripts/python.exe",
                    "backend/.venv/bin/python"):
            if (r / rel).is_file():
                return str(r / rel)
    return sys.executable


def npx() -> str:
    return shutil.which("npx") or shutil.which("npx.cmd") or "npx"


def checks() -> list[tuple[str, list[str], Path]]:
    py = backend_python()
    return [
        ("backend:pytest", [py, "-m", "pytest", "-q", "-p", "no:cacheprovider"], BACKEND),
        ("backend:alembic-heads", [py, "-m", "alembic", "heads"], BACKEND),
        ("frontend:vitest", [npx(), "vitest", "run"], FRONTEND),
        ("frontend:eslint", [npx(), "eslint", "src", "--ext", ".ts,.tsx", "--max-warnings", "0"], FRONTEND),
        ("frontend:build", [shutil.which("npm") or shutil.which("npm.cmd") or "npm", "run", "build"], FRONTEND),
    ]


def known_failures() -> set[str]:
    if not KNOWN_FAILURES.is_file():
        return set()
    return {ln.split("#")[0].strip() for ln in KNOWN_FAILURES.read_text(encoding="utf-8").splitlines()
            if ln.split("#")[0].strip()}


def run(name: str, cmd: list[str], cwd: Path) -> tuple[bool, str, float]:
    env = dict(os.environ, PYTHONIOENCODING="utf-8", ENVIRONMENT="development",
               # never the production URL that backend/.env holds: tests use in-memory SQLite
               DATABASE_URL="sqlite://", CI=os.environ.get("CI", "1"))
    t0 = time.monotonic()
    try:
        p = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, encoding="utf-8", errors="replace")
        out, ok = (p.stdout or "") + (p.stderr or ""), p.returncode == 0
    except FileNotFoundError as e:
        out, ok = f"no se pudo ejecutar {cmd[0]}: {e}", False
    if ok and name == "backend:alembic-heads":
        heads = out.count("(head)")
        ok = heads == 1
        if not ok:
            out += f"\nalembic heads = {heads} (debe ser exactamente 1)"
    return ok, out, time.monotonic() - t0


def main() -> int:
    for stream in (sys.stdout, sys.stderr):  # Windows consoles default to cp1252
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    hook = "--hook" in sys.argv
    if hook:
        try:
            json.load(sys.stdin)  # Claude Code's Stop payload: nothing in it changes the verdict
        except Exception:
            pass
    state = tree_state()
    if not state:
        print("verify: árbol limpio, nada que verificar")
        return 0
    cache = cache_file()
    if "--force" not in sys.argv and cache.is_file() and cache.read_text().strip() == state:
        print("verify: este estado del árbol ya pasó en verde")
        return 0

    allowed = known_failures()
    failed, tolerated = [], []
    for name, cmd, cwd in checks():
        ok, out, secs = run(name, cmd, cwd)
        print(f"verify: {name} {'OK' if ok else 'FALLA'} ({secs:.0f}s)", file=sys.stderr if not ok else sys.stdout)
        if not ok:
            lines = out.strip().splitlines()
            key = [ln for ln in lines if ln.startswith(("FAILED", "ERROR", "×", "✗", "error"))][:15]
            tail = "\n".join(key + ["…"] + lines[-TAIL:] if key else lines[-TAIL:])
            (tolerated if name in allowed else failed).append((name, tail))

    for name, _ in tolerated:
        print(f"verify: AVISO {name} falla, pero está en verify-known-failures.txt (preexistente)", file=sys.stderr)
    if failed:
        print("\nverify: BLOQUEADO. Falló:", ", ".join(n for n, _ in failed), file=sys.stderr)
        for name, tail in failed:
            print(f"\n── {name} (últimas líneas) ──\n{tail}", file=sys.stderr)
        print("\nArregla lo que rompiste. Si el fallo ya existía en main, repórtalo con evidencia en el Reporte "
              "y añádelo a scripts/verify-known-failures.txt (ver misiones/INSTRUCCIONES.md).", file=sys.stderr)
        return 2
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(state)
    print("verify: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
