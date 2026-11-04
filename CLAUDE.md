# KoreX — contexto del proyecto

SaaS de eliminación de deudas con la estrategia **velocity banking**. Dominio de producción: korexf.com.
Este archivo son **hechos**. Los procedimientos viven en los skills de `.claude/skills/` (ver abajo).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript 5.9 + Vite 7, Tailwind + shadcn/ui (Radix) — deploy en Vercel |
| Backend | FastAPI (Python 3.11+), SQLModel — deploy en Railway |
| DB | Supabase (PostgreSQL) en prod · SQLite en local, con fallback automático |
| Auth | Supabase Auth (JWT) |
| Móvil | Capacitor (iOS + Android WebView) |
| Pagos | Lemon Squeezy (Merchant of Record) |

## Verificar antes de dar algo por terminado

Los tres comandos son los mismos que corre CI (`.github/workflows/ci.yml`) en cada push/PR a main:

```bash
cd frontend && npx eslint src --ext .ts,.tsx --max-warnings 0
cd frontend && npm run build
cd backend && ./venv/Scripts/python.exe -m pytest
```

Backend: 137 tests. Frontend: 3 archivos de test (Vitest) — cobertura baja, es deuda conocida.

## Quirks del entorno local (Windows)

- **Puerto 8000 está ocupado por un bot de MT5 con cuenta real — nunca matarlo.** El backend de KoreX va en **8001**.
- Arranque del backend: `PYTHONIOENCODING=utf-8 ENVIRONMENT=development DATABASE_URL=sqlite:///./korex.db ./venv/Scripts/python.exe -m uvicorn main:app --port 8001`
  (el `PYTHONIOENCODING` es obligatorio: `database.py` imprime emojis que revientan en consolas cp1252).
- **Pasa siempre `DATABASE_URL=sqlite:///./korex.db` explícito en local.** `backend/.env` contiene la URL de PRODUCCIÓN y `load_dotenv()` la carga si la variable no existe. En cmd, `set DATABASE_URL=` *borra* la variable (no la deja vacía) → el servidor "local" se conectaba a producción (incidente 2026-11-03). El log de arranque imprime a qué base se conectó: compruébalo.
- `.claude/launch.json` tiene configs de preview para `korex-frontend` (5173) y `korex-backend` (8001).
- Login local: botón **"Try Demo"** en `/login` (token `demo-stress-test-token`, ver `backend/auth.py`).

### Migraciones (Alembic)

Alembic apunta por defecto a `korex_local.db`, **no** a la DB real. Hay que pasar la URL a mano:

```bash
cd backend && DATABASE_URL="sqlite:///./korex.db" ./venv/Scripts/python.exe -m alembic upgrade head
```

Si la DB nunca fue estampada (sin tabla `alembic_version`): primero `alembic stamp bd322c6ada8b`, luego `upgrade head`.
Head actual: `a1f4c2e97b30`. Los tests pasan con SQLite en memoria creada desde los modelos, así que **un modelo con columna nueva puede dar 500 `no such column` en local aunque los tests estén verdes** — aplicar la migración.

## Reglas del dominio (no negociables)

- **Dinero y tasas siempre en `Decimal`, nunca `float`.** Cuantizar (`.quantize(Decimal("0.01"))`) solo al presentar, no en pasos intermedios.
- **Los routers no calculan.** La matemática vive en `backend/velocity_engine.py` y `core_engine/calculators.py`. Aritmética de dinero dentro de un router es code smell.
- **Toda cifra mostrada al usuario es una estimación** y debe etiquetarse como tal. Es requisito legal (FTC), no estético.
- **Para renderizar dinero en el frontend usa `<MoneyAmount>`** (`components/MoneyAmount.tsx`) o `<AnimatedCurrency>`, no `$` a mano. Ya envuelven el hook `useFormatMoney` (respeta la moneda del usuario) y aplican `font-mono tabular-nums` para que los dígitos no bailen al actualizarse. Si necesitas el string suelto (dentro de un template), usa el hook `useFormatMoney` directamente.
- **Fechas**: al parsear `YYYY-MM-DD` en el frontend, anclar siempre a mediodía añadiendo el sufijo `T12:00:00` antes de construir el `Date`. Sin eso, en timezones negativas el día cae en el mes anterior (ver `useFormatMoney.ts` como referencia).
- **Multi-tenant**: todo query debe filtrar por `user_id`. La tabla `users` es la única sin esa columna — no usarla para datos por usuario; usar `user_settings`.

## Rendimiento del bundle

Route-level code splitting en `App.tsx` (React.lazy en todas las páginas salvo LandingGate) y `manualChunks` en `vite.config.ts`. **No añadir imports eager de librerías pesadas** (`jspdf`, `xlsx`, `recharts`) en `App.tsx` ni en módulos compartidos — mantenerlos scoped por ruta o por interacción.
`three.js` y `@react-three` se desinstalaron por ser código muerto — no volver a añadirlos.

## Skills del proyecto (`.claude/skills/`)

Se activan solos por contexto; también con `/nombre`.

| Skill | Cuándo |
|---|---|
| `brand-design-system` | Cualquier trabajo de UI. Paleta, tipografía y las 8 reglas anti-"look IA" |
| `legal-expert-usa` | Copy público, claims, ToS/Privacy, features financieros, app stores |
| `velocity-domain` | Tocar el motor financiero o cualquier cifra monetaria |
| `deep-research` | Investigar/comparar con fuentes verificadas |
| `critical-evaluator` | Red team de un plan o decisión antes de ejecutarla |
| `executive-synthesis` | Resúmenes e informes para decidir |
| `frontend-design` | Ejecutar la dirección de marca con más audacia (plugin oficial) |

Notas de ideas sin procesar: `docs/raw/` (ver su README).
