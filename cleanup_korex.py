#!/usr/bin/env python3
"""
KoreX Project Cleanup & Optimization Script
"""
import os, shutil, sys
from pathlib import Path

ROOT = Path(os.getcwd())
REPORT = []

log = lambda msg: (REPORT.append(msg), print(msg))

# ── 1. TAMAÑOS INICIALES ──────────────────────────────────────
def get_size(path):
    if path.is_file():
        return path.stat().st_size
    total = 0
    for item in path.rglob('*'):
        if item.is_file():
            total += item.stat().st_size
    return total

def fmt(n):
    for unit in ['B','KB','MB','GB']:
        if n < 1024:
            return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"

log("=" * 60)
log("KoreX Cleanup Report")
log("=" * 60)
log("")

# ── 2. ARCHIVOS TEMPORALES DE RAÍZ ────────────────────────────
log("## PASO 1: Eliminando archivos temporales de raíz")

to_remove_root = [
    # Screenshots debug
    'action_plan_after_deploy.png', 'action_plan_confirm.png',
    'action_plan_debug.png', 'action_plan_fixed.png',
    'action_plan_screenshot.png', 'action_plan_verify.png',
    'dashboard_fixed.png', 'dashboard_velocity_check.png',
    'landing_hero_3d.png', 'landing_hero_3d_v2.png',
    'screenshot_accounts.png', 'screenshot_accounts_uil.png',
    'screenshot_arsenal_velocity.png',
    # Debug files
    'debug_execution.py', 'korex.db.bak',
    'dashboard_snapshot.txt',
    'seed_error.txt', 'seed_result.txt', 'seed_result2.txt', 'seed_result3.txt',
    'snapshot_accounts.txt', 'snapshot_landing.txt', 'snapshot_velocity.txt',
    'v111_changes.txt',
    'verify_dashboard_update.py', 'verify_manual_adjustment.py',
    'verify_min_payment.py', 'verify_smart_advice.py',
]

saved = 0
for f in to_remove_root:
    p = ROOT / f
    if p.exists():
        sz = get_size(p)
        saved += sz
        if p.is_dir():
            shutil.rmtree(p)
        else:
            p.unlink()
        log(f"  [DELETE] {f}  ({fmt(sz)})")
    else:
        log(f"  [SKIP]   {f}  (not found)")

log(f"  TOTAL AHORRADO (raíz): {fmt(saved)}")
log("")

# ── 3. LIMPIAR BACKEND ────────────────────────────────────────
log("## PASO 2: Limpiando backend")
be_saved = 0
be = ROOT / 'backend'

# Logs
for logf in ['uvicorn.log', 'uvicorn.log.err', 'uvicorn_out.log']:
    p = be / logf
    if p.exists():
        sz = get_size(p)
        be_saved += sz
        p.unlink()
        log(f"  [DELETE] backend/{logf}  ({fmt(sz)})")

# DB backups
for dbf in ['korex.db.bak', 'korex_test.db']:
    p = be / dbf
    if p.exists():
        sz = get_size(p)
        be_saved += sz
        p.unlink()
        log(f"  [DELETE] backend/{dbf}  ({fmt(sz)})")

# __pycache__ y .pytest_cache
count = 0
for pattern in ['**/__pycache__', '**/.pytest_cache']:
    for p in be.glob(pattern):
        sz = get_size(p)
        be_saved += sz
        shutil.rmtree(p)
        count += 1
log(f"  [DELETE] {count} carpetas __pycache__/.pytest_cache  ({fmt(be_saved)})")

# venv interno del backend
venv_be = be / 'venv'
if venv_be.exists():
    sz = get_size(venv_be)
    be_saved += sz
    shutil.rmtree(venv_be)
    log(f"  [DELETE] backend/venv  ({fmt(sz)})")

log(f"  TOTAL AHORRADO (backend): {fmt(be_saved)}")
log("")

# ── 4. LIMPIAR FRONTEND ───────────────────────────────────────
log("## PASO 3: Limpiando frontend")
fe_saved = 0
fe = ROOT / 'frontend'

# Screenshots demo
for png in ['demo_btn_check.png', 'demo_popup_test.png', 'demo_welcome_modal.png', 'demo_welcome_popup.png']:
    p = fe / png
    if p.exists():
        sz = get_size(p)
        fe_saved += sz
        p.unlink()
        log(f"  [DELETE] frontend/{png}  ({fmt(sz)})")

# Build error logs
for logf in ['build-error.txt', 'build_errors.txt', 'build_log.txt', 'lint_errors.txt']:
    p = fe / logf
    if p.exists():
        sz = get_size(p)
        fe_saved += sz
        p.unlink()
        log(f"  [DELETE] frontend/{logf}  ({fmt(sz)})")

# dist (si existe)
dist = fe / 'dist'
if dist.exists():
    sz = get_size(dist)
    fe_saved += sz
    shutil.rmtree(dist)
    log(f"  [DELETE] frontend/dist  ({fmt(sz)})")

log(f"  TOTAL AHORRADO (frontend): {fmt(fe_saved)}")
log("")

# ── 5. ELIMINAR SKILLS DUPLICADOS EN RAÍZ ────────────────────
log("## PASO 4: Eliminando skills duplicados en .agent/skills (raíz)")
skills_root = ROOT / '.agent' / 'skills'

categories = ['Backend', 'Brand', 'Business', 'DevOps', 'Frontend', 'Other', 'QA']
duplicate_names = []

for cat in categories:
    cat_dir = skills_root / cat
    if not cat_dir.exists():
        continue
    for sub in cat_dir.iterdir():
        if sub.is_dir():
            root_dup = skills_root / sub.name
            if root_dup.exists() and root_dup.is_dir():
                duplicate_names.append((sub.name, cat))

skills_saved = 0
for name, cat in duplicate_names:
    root_dup = skills_root / name
    sz = get_size(root_dup)
    skills_saved += sz
    shutil.rmtree(root_dup)
    log(f"  [DELETE] .agent/skills/{name}  (duplicado de .agent/skills/{cat}/{name})  ({fmt(sz)})")

# También quitar deployment_validator e hook-destructure-guard de raíz si están en subcarpetas
for name in ['deployment_validator', 'hook-destructure-guard']:
    p = skills_root / name
    if p.exists() and p.is_dir():
        sz = get_size(p)
        skills_saved += sz
        shutil.rmtree(p)
        log(f"  [DELETE] .agent/skills/{name}  (duplicado en subcarpetas)  ({fmt(sz)})")

log(f"  TOTAL AHORRADO (skills): {fmt(skills_saved)}")
log("")

# ── 6. RESUMEN ────────────────────────────────────────────────
total_saved = saved + be_saved + fe_saved + skills_saved
log("=" * 60)
log("RESUMEN")
log("=" * 60)
log(f"Ahorro total: {fmt(total_saved)}")
log(f"  - Raíz (screenshots/debug): {fmt(saved)}")
log(f"  - Backend (logs/cache/venv): {fmt(be_saved)}")
log(f"  - Frontend (screenshots/logs): {fmt(fe_saved)}")
log(f"  - Skills duplicados: {fmt(skills_saved)}")

# Guardar reporte
report_path = ROOT / 'cleanup_report.md'
report_path.write_text('\n'.join(REPORT), encoding='utf-8')
log(f"\nReporte guardado en: {report_path}")
