# KoreX Project Cleanup & Optimization Report

**Date:** 2026-08-10

---

## Summary

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| **Project size (excl. node_modules/.git/.venv)** | ~176 MB | ~8.9 MB | **-95%** |
| **Backend Python lines** | 2,466 | 1,430 | **-1,036 (-42%)** |
| **Files removed** | 140+ | — | **~168 MB freed** |
| **Syntax errors introduced** | — | 0 | **All clean** |

---

## 1. Files Removed (Disk Space)

### Root Directory — 11.1 MB
- 13 screenshot PNGs (debug artifacts)
- `debug_execution.py`, `korex.db.bak`
- `dashboard_snapshot.txt`, `seed_error.txt`, `seed_result*.txt`
- `snapshot_*.txt`, `v111_changes.txt`
- `verify_*.py` (4 verification scripts)

### Backend — 125.2 MB
- `uvicorn.log`, `uvicorn.log.err`, `uvicorn_out.log`
- `korex.db.bak`, `korex_test.db`
- `95` `__pycache__` / `.pytest_cache` folders
- `backend/venv/` (duplicated virtual env) — **108.2 MB**

### Frontend — 6.8 MB
- 4 `demo_*.png` screenshots
- `build-error.txt`, `build_errors.txt`, `build_log.txt`, `lint_errors.txt`
- `frontend/dist/` (old build output)

### Android Build Caches — 25.2 MB
- `frontend/android/app/build/`
- `frontend/android/.gradle/`
- `frontend/android/build/`
- `frontend/android/.idea/`

### `.agent/skills` Duplicates — 86.7 KB
Removed 25 duplicate skill folders from root that already existed in categorized subfolders (`Backend/`, `Brand/`, `Business/`, `DevOps/`, `Frontend/`, `Other/`, `QA/`).

---

## 2. Backend Code Compaction

All changes verified with `py_compile` — **zero syntax errors**.

| File | Before | After | Δ |
|------|--------|-------|---|
| `main.py` | 191 | 128 | -63 |
| `helpers.py` | 110 | 150 | +40 *(added reusable helpers)* |
| `routers/strategy.py` | 646 | 372 | -274 |
| `routers/subscriptions.py` | 588 | 292 | -296 |
| `routers/cashflow.py` | 523 | 242 | -281 |
| `routers/transactions.py` | 408 | 246 | -162 |
| **Total** | **2,466** | **1,430** | **-1,036** |

### Key Optimizations
- **`main.py`**: Collapsed 20 lines of router imports into a 3-line loop
- **`helpers.py`**: Added `update_account_balance()`, `find_account_by_name()`, `calc_attack_streak()`, `_insufficient_funds_error()` — eliminated duplicated logic across 3+ routers
- **`strategy.py`**: Compact command-center endpoint; used new helpers for `execute_movement`
- **`subscriptions.py`**: Extracted `PLAN_LIMITS`/`PLAN_COSTS` constants; collapsed repetitive webhook event handlers
- **`cashflow.py`**: Unified `_item_triggers_today()` and `item_triggers_on()` into single `_item_triggers()`
- **`transactions.py`**: Extracted `_create_tx_record()` helper; eliminated 3x duplicated balance-update logic

---

## 3. Current Project Structure (Clean)

```
KoreX/
├── .agent/          (0.2 MB — skills organized by category)
├── .claude/         (0.1 MB — Claude-specific skills)
├── backend/         (0.5 MB — Python FastAPI, verified syntax)
│   ├── main.py
│   ├── helpers.py      ← expanded with shared helpers
│   ├── models.py
│   ├── routers/        ← 6 routers compacted
│   └── ...
├── core_engine/     (0.0 MB)
├── docs/            (0.1 MB — API.md, ARCHITECTURE.md, README.md)
├── frontend/        (341 MB total)
│   ├── node_modules/   ← 333.9 MB (required deps)
│   ├── android/        ← 3.6 MB (Capacitor source, no build caches)
│   ├── public/         ← 2.0 MB (icons, manifest, landing assets)
│   └── src/            ← 1.4 MB (React/TS source — untouched, stable)
└── Branding/        (0.6 MB)
```

---

## 4. What Was NOT Changed (Intentionally)

| Area | Reason |
|------|--------|
| **Frontend React/TS source** | 136 files, ~26K lines. JSX refactoring is high-risk; no user-facing bugs to fix. |
| **`node_modules/`** | 333.9 MB of required dependencies. Managed by `package.json`. |
| **`.claude/skills/`** | 9 unique Claude-specific skills; not duplicates. |
| **`docs/claude-optimization/`** | Planning documentation; not temporary. |
| **`.git/`** | Repository history preserved. |

---

## 5. Recommendations for Further Optimization

1. **Frontend code splitting**: `SettingsPage.tsx` (1525 lines) and `AccountsPage.tsx` (1511 lines) could be split into sub-components.
2. **Tree-shaking**: Review `frontend/src/lib/` and `components/ui/` for unused shadcn components.
3. **Asset compression**: `public/landing-assets/` PNGs (~400KB each) could be converted to WebP.
4. **Dead code elimination**: Run `npx unimported` to find unused JS/TS files.

---

*Report generated automatically by cleanup script.*
