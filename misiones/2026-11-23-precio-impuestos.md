# Misión: Precio web «$100/año + impuestos»
- **ID:** 2026-11-23-precio-impuestos
- **Estado:** en-auditoria
- **Rama:** fix/precio-impuestos
- **Repo:** CoreX-SF
## Objetivo
Que todo precio web del plan pago diga «+ impuestos» / «+ tax», porque Stripe Managed Payments suma
el impuesto sobre la venta encima del precio base. Hija de la Misión 9
(`2026-11-22-prueba-pagos-stripe`): la web anunciaba $100/año y la próxima factura era $106.60.
## Contexto
Decisión de Fabian (2026-11-23): copy «+ impuestos». El cliente paga el impuesto según su estado y el
precio base se conserva. Solo copy: sin cambios de lógica ni de precios en Stripe. La ruta de Google
Play no se toca: Play muestra su propio precio localizado y gestiona el impuesto en su pantalla.
## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | Todo precio web visible lleva el calificador, en ES y en EN | `npx vitest run src/lib/priceTax.test.tsx` | 7 passed; falla si falta en tarjetas, modal o landing |
| 2 | La ruta de Play queda intacta | Mismo test, caso «Google Play route stays untouched», más `src/lib/playBilling/playBilling.test.tsx` | passed; el precio de Play no lleva calificador |
| 3 | Inventario clasificado | `grep` del paso 1 (tabla del Reporte) | Cada cadena: web → con calificador; Play → intacta; otras → no aplica |
| 4 | Puerta compartida en verde | `python scripts/verify.py` | `verify: OK` |
| 5 | Migraciones: un solo head | `cd backend && python -m alembic heads` | 1 `(head)`, sin migraciones nuevas |
## Pasos
1. Inventario de cadenas de precio (antes de tocar nada).
2. Calificador desde una sola fuente (`TAX_QUALIFIER` / `taxNote` en `lib/pricing.ts`).
3. Test de barrido ES/EN más el caso de Play.
## No tocar
- Ruta de Google Play, precios de Stripe, lógica de checkout y webhook.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-23
- **Rama y commit:** `fix/precio-impuestos` @ `a632774` (código) más este reporte. Sin merge.
- **Inventario (paso 1).** Búsqueda en `frontend/src` (sin tests), `frontend/index.html`, `public/` y
  `backend` (sin venv, tests ni alembic) de `ANNUAL_PRICE`, `p.annual`/`paid.annual`, `$100`,
  `100 USD`, `100 dólares|dollars`, `99.99`:

  | # | Archivo:línea | Cadena visible | Ruta | Acción |
  |---|---------------|----------------|------|--------|
  | 1 | `components/kx/PlanCards.tsx:43-44` | Héroe `$100.00` + `/año` · `/yr` | Web (sin `store`) | `/año + impuestos` · `/yr + tax`, pegado al número, en la misma tarjeta |
  | 2 | `components/kx/PlanCards.tsx:48` | «7 días gratis, luego $100.00/año» · «7-day free trial, then $100.00/yr» | Web | `… /año + impuestos` · `… /yr + tax` |
  | 3 | `components/kx/PlanCards.tsx:43` con `store` | `store.price` (precio localizado de Play) | Play | Intacta (el calificador solo se pinta sin `store`) |
  | 4 | `components/kx/PlanCards.tsx:43` tarjeta Gratis | `$0.00` | Web, plan gratuito | No aplica: no hay cobro ni impuesto |
  | 5 | `components/UpgradeModal.tsx:102` | Héroe `$100.00` + `/año` · `/yr` | Web (`!onPlay`) | `/año + impuestos` · `/yr + tax` |
  | 6 | `components/UpgradeModal.tsx:102` con `onPlay` | `play.priceText` | Play | Intacta |
  | 7 | `components/UpgradeModal.tsx:106` | Línea de prueba «…luego $100.00/año» | Web | `… + impuestos` · `… + tax` |
  | 8 | `components/UpgradeModal.tsx:105` | `play.trialLine` | Play | Intacta |
  | 9 | `features/landing/KxLanding.tsx:71` | «100 dólares al año» · «100 dollars a year» | Web | «100 dólares al año + impuestos» · «… a year + tax» |
  | 10 | `features/landing/KxLanding.tsx:211` | «KoreX: $100 al año, con 7 días gratis.» | Web | «$100 al año + impuestos, con 7 días gratis.» · EN «a year + tax» |
  | 11 | `features/landing/KxLanding.tsx:192` | `PlanCards` embebidas | Web | Cubiertas por #1–#2 |
  | 12 | `features/settings/PlansPage.tsx`, `SettingsPage.tsx` | Usan `PlanCards` | Web o Play según plataforma | Cubiertas por #1–#4 |
  | 13 | `features/legal/termsCopy.ts:77,169` | «ONE HUNDRED U.S. DOLLARS ($100.00)» / «US$100.00» | — | No aplica: es el tope de responsabilidad de los Términos, no el precio del plan |
  | 14 | `backend/routers/subscriptions.py:337,351` | `plan_cost_annual` (PLAN_COSTS) | — | No visible como precio: el modal actual no lo pinta (su estimado es solo de interés) |
  | 15 | `backend/routers/strategy.py:388` | «Every $100 to {cuenta}…» | — | No aplica: ejemplo de reparto de dinero, no precio |
  | 16 | `index.html`, `public/` | Sin precio (solo coincidencias en SVG) | — | No aplica |

  Las páginas legales no nombran el precio del plan. El checkout lo pinta Stripe, fuera del repo, y
  ya desglosa el impuesto.
- **Evidencia de los criterios de aceptación:**
  1. `npx vitest run src/lib/priceTax.test.tsx` → `Tests 7 passed (7)`. Hay 6 casos ES/EN (tarjetas,
     modal y landing), cada uno exige ≥2 o ≥3 apariciones del precio con el calificador en los 24
     caracteres siguientes, más el caso de Play.
  2. Caso Play → passed (`US$99.99` sin «+ impuestos»). `playBilling.test.tsx` → passed; se actualizó
     su expectativa web a «7 días gratis, luego $100.00/año + impuestos».
  3. Tabla de arriba.
  4. `python scripts/verify.py`:
     - `backend:alembic-heads OK`, `frontend:vitest OK` (58 archivos, 360 tests), `frontend:eslint
       OK`, `frontend:build OK`.
     - **pytest: 1 failed, 668 passed**. Falla
       `test_minimo_unico.py::test_a_single_minimum_formula_in_the_repo_and_no_root_core_engine`
       porque en este PC existe la carpeta raíz `core_engine/`, ignorada por git (`!! core_engine/`)
       y con solo `__pycache__/*.pyc` del módulo ya borrado (`git ls-files core_engine` = 0). Es del
       entorno local, no del código: en el CI no existe. No se añadió a `verify-known-failures.txt`
       porque taparía una guardia real. Claude no la borró: la acción quedó bloqueada y la decide
       Fabian (`rm -rf core_engine` en la raíz).
  5. Sin migraciones: `alembic heads` = 1 (verify OK). El diff no toca `backend/`.
- **Checklist de auto-verificación:**
  - [x] Diff → `git diff --stat origin/main...HEAD`: UpgradeModal.tsx 6, PlanCards.tsx 6,
        KxLanding.tsx 6, playBilling.test.tsx 2, priceTax.test.tsx +96, pricing.ts +8. Total: 6
        archivos, 114 inserciones y 10 borrados (más este reporte).
  - [x] Fuera de alcance = 0: solo copy de precio web, su fuente (`pricing.ts`) y tests, más el
        archivo de misión.
  - [x] Migraciones: ninguna (1 head).
  - [x] Sin `console.log`, secretos ni `any` nuevos: el grep de la plantilla sale vacío (exit 1).
  - [x] Puerta: ver criterio 4.
- **Desviaciones o dudas:**
  - El calificador va pegado al número héroe dentro del mismo `<small>` («$100.00/año + impuestos»),
    así que no hizo falta nota al pie. La tarjeta Gratis ($0) no lo lleva.
  - Local: `node_modules` no tenía `@capacitor/push-notifications` (añadida en main), así que 3
    archivos de vitest no cargaban. Se arregló con `npm install`, sin cambios en `package.json`.
- **Fallos preexistentes:** ninguno en `main`. La única falla de pytest es la carpeta local
  `core_engine/` descrita en el criterio 4.
