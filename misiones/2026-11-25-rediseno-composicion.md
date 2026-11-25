# Misión 19: Rediseño «Cobre a la vista» — B: Composición
- **ID:** 2026-11-25-rediseno-composicion
- **Estado:** en-auditoria
- **Rama:** feat/rediseno-composicion
- **Repo:** CoreX-SF

## Objetivo
Componer las 5 pantallas de la barra, el login, la ceremonia de $0 y los estados vacíos y de error con los cimientos de la misión 18 (tokens, línea de cobre, iconos, barra), según §4.6, §5 y §6 de `misiones/2026-11-25-direccion-de-arte.md`.

## Contexto
- Fuente de verdad: `misiones/2026-11-25-direccion-de-arte.md` (iteración 2, aprobada por Fabian el 2026-11-25). Si algo de aquí lo contradice, manda el documento.
- Precondición cumplida: misión 18 fusionada en `main` (PR #17, 2026-11-25).
- Decisiones de Fabian: el corte de cada línea se mide en tiempo, sin backend; héroe de Inicio «Debes ≈»; vibración apagada por defecto.
- Los cimientos de la misión 18 se usan tal cual. Sin números, rótulos ni cálculos nuevos (misión 17); sin backend ni endpoints; sin Tadeo.

## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | Inicio: héroe «Debes ≈» 56 px con la luz detrás; línea vertical del héroe a la misión, cuyo botón es la única superficie de cobre; «Disponible para tu plan» y «Efectivo en cuentas» en una línea de dos datos en Plex Mono, sin tarjeta; interés diario como línea de texto con el icono 11; comparación, casa y liga plegadas por defecto | `npx vitest run src/features/composicion.test.tsx -t "Inicio"` + captura a 375 px | passed; captura en el Reporte |
| 2 | Calendario: rejilla conservada; línea bajo cada semana (cobre en lo pasado, forrada en lo que falta, corte en hoy); marcas con icono (cobre = pago, icono 8 = corte, icono 10 = nómina en `--kx-pay`); máximo 2 por día y «+N» si hay más; el DaySheet no cambia de contenido | `composicion.test.tsx -t "Calendario"` + captura | passed |
| 3 | Plan: héroe = fecha libre en Fraunces; línea vertical a 16 px del borde, de hoy a la fecha libre; una marca por deuda que se termina, con su nombre y el mes en Plex Mono; icono 14 al final; la funda se retira 480 ms al entrar tras bajar la deuda | `composicion.test.tsx -t "Plan"` + captura | passed |
| 4 | Cuentas: héroe «Efectivo en cuentas»; cada deuda con su línea a todo el ancho (sin barra de progreso); etapa solo en la pastilla; objetivo del ataque arriba con el icono 6; pagadas al final, cobre entero + PAGADA, plegadas si son más de 3; el dinero propio aparte y sin línea | `composicion.test.tsx -t "Cuentas"` + captura | passed |
| 5 | Suscripciones: héroe = lo que te cobran al mes ≈; filas con icono 5, nombre, importe y próxima fecha; «Cancelar suscripción» baja la fila a «Canceladas» (240 ms) y el héroe cuenta hacia abajo; duplicadas y dudosas con nota de texto, sin color de alarma | `composicion.test.tsx -t "Suscripciones"` + captura | passed |
| 6 | Ceremonia de $0 dentro de la fila: funda retirada (480 ms), destello (480–700 ms), PAGADA a los 700 ms, saldo contando a $0; total ≤ 1.3 s; no bloquea; sin confeti, mascota ni sonido | `composicion.test.tsx -t "ceremonia"` (temporizadores falsos) | passed |
| 7 | Login: logo 48 px + nombre; línea de cobre abierta como horizonte; «Tu plan para salir de deudas.»; Entrar (cobre, 52 px) y Probar demo (contorno); sin número héroe | `composicion.test.tsx -t "Login"` + captura | passed |
| 8 | Estados vacíos y de error: icono 40 px en `--kx-ink-3` + una línea + un botón; error = icono 17 + qué pasó + Reintentar; corte cercano = aviso con icono 8 y fecha; todas en $0 = Plan con la línea entera en cobre y «Sin deudas.» | `composicion.test.tsx -t "estados"` | passed |
| 9 | Un solo héroe por pantalla; ninguna cadena visible con «cable», «pelar», «enchuf» o «Tadeo»; sin exclamaciones ni emojis en los textos nuevos | `composicion.test.tsx -t "héroe"` y `-t "tono"` | passed |
| 10 | Contraste AA (texto 4.5:1, gráficos 3:1) y objetivos táctiles ≥ 44×44 px | `composicion.test.tsx -t "contraste"` + medición en el navegador a 360 px | passed; medidas en el Reporte |
| 11 | Con «reducir movimiento»: cero animaciones salvo fundidos ≤ 150 ms | `composicion.test.tsx -t "reducir"` | passed |
| 12 | Prueba del papá (la corre Fabian): Cuentas 5 s a alguien que no ha visto la app; dice cuál deuda va más avanzada sin leer cifras | resultado anotado en el Reporte por Fabian | pendiente de Fabian |
| 13 | Prueba de identidad (la corre Fabian): captura con el logo tapado junto a 3 apps de finanzas; se distingue como «la de la línea de cobre» | resultado anotado en el Reporte por Fabian | pendiente de Fabian |
| 14 | Puerta compartida en verde | `python scripts/verify.py` | `verify: OK` (exit 0) |
| 15 | CI en verde | checks `backend` y `frontend` del PR | success |

## Pasos
1. Inicio y Calendario.
2. Plan y Cuentas, con la ceremonia de $0.
3. Suscripciones, login, estados vacíos y de error.
4. Tests, capturas, verify, PR.

## No tocar
- Ningún número, rótulo ni cálculo (misión 17). Ningún endpoint ni backend.
- Los cimientos de la misión 18, que se usan tal cual. Nada de Tadeo.
- Pantallas fuera de la barra (ajustes, ranking, juez, reloj de dinero, landing, precios).

## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-25
- **Rama y commit:** `feat/rediseno-composicion` (ver PR). Primer commit: criterios de aceptación.
- **Evidencia de los criterios de aceptación** (tests en `frontend/src/features/composicion.test.tsx`, 32 en verde; captura `pantallas-375.png` en la carpeta de esta misión):
  1. Inicio: `-t "Inicio"` passed. Héroe «Debes ≈» de 56 px con la luz detrás; conector color funda hasta la misión; «Ver cómo hacerlo» es la única superficie de cobre (`bg-kx-amber` aparece 1 vez en `HomePage.tsx`); los dos datos en una línea de Plex Mono; interés diario con el icono 11; comparación, etapas, casa y liga plegadas bajo «Tu avance en detalle».
  2. Calendario: `-t "Calendario"` + `calendarEvents.test.tsx` passed. Rejilla conservada; línea bajo cada semana (cobre lo pasado, funda lo que falta, corte en hoy); punto de cobre = cobro, icono 8 = corte, icono 10 = nómina en `--kx-pay`; máximo 2 marcas y «+N»; el DaySheet no cambia (mismo componente y props).
  3. Plan: `-t "Plan"` + `AttackPage.test.tsx` passed. Héroe = fecha libre («Mayo de 2029») en Fraunces; línea vertical a 16 px del borde, de hoy a la fecha libre; una marca por deuda con su mes en Plex Mono (del evento de la línea de tiempo del servidor) y su coste diario; icono 14 al final; la funda viaja desde la última posición al entrar.
  4. Cuentas: `-t "Cuentas"` passed. Héroe «Efectivo en cuentas»; cada deuda con su línea (sin barra de progreso ni banda de color); etapa solo en la pastilla; objetivo del ataque arriba con el icono 6; pagadas al final con cobre entero + PAGADA, plegadas si son más de 3; dinero propio aparte y sin línea.
  5. Suscripciones: `-t "Suscripciones"` passed. Héroe «Te cobran al mes ≈»; filas con el icono 5; «Cancelar suscripción»; grupo «Canceladas»; repetidas con nota de texto sin color de alarma.
  6. Ceremonia: `-t "ceremonia"` passed (temporizadores falsos): la funda se va en el fotograma siguiente (480 ms), PAGADA a los 700 ms exactos, sin confeti, mascota, sonido ni capa encima. Total 700 ms + la caída del sello, por debajo de 1.3 s. **No vista en vivo**: necesita que una deuda llegue a $0 durante la sesión.
  7. Login: `-t "Login"` passed. Logo de 48 px + nombre, línea de cobre abierta, «Tu plan para salir de deudas.», Entrar (cobre, 52 px) y Probar demo (contorno, 52 px); sin número héroe; sin los orbes decorativos en bucle.
  8. Estados: `-t "estados"` passed. Vacío = icono de 40 px en `--kx-ink-3` + una línea + un botón; error = icono 17 + qué pasó + Reintentar, en las 5 pantallas; todas en $0 = Plan con la línea entera en cobre y «Sin deudas.».
  9. Héroe y tono: `-t "héroe y tono"` passed. Un héroe por pantalla (0 en el login); cero «cable», «pelar», «enchuf» o «Tadeo»; cero «¡» en estos archivos (se quitaron 4 exclamaciones del login y del calendario).
  10. Contraste y objetivos táctiles: `-t "contraste"` passed (funda ≥ 3:1 en los tres fondos; tinta sobre cobre 8.59:1). Auditoría en el navegador de todos los botones y enlaces visibles de las 6 pantallas: **0 por debajo de 44 px** a 375 y a 360 px (`objetivos-tactiles-375.json`, `objetivos-tactiles-360.json`, script `sheet19.mjs`).
  11. Reducir movimiento: `-t "reducir"` passed (la ceremonia pinta el estado final, sin caída del sello).
  12. Prueba del papá: **pendiente de Fabian.**
  13. Prueba de identidad: **pendiente de Fabian.**
  14. Puerta: `python scripts/verify.py` → `verify: OK` (pytest, alembic heads, vitest 61 archivos / 451 tests, eslint, build).
  15. CI: ver checks del PR.
- **Checklist de auto-verificación:**
  - [x] Sin backend, endpoints ni migraciones. `ActionPlanPage.tsx` (simulación completa, fuera de la barra) sin cambios.
  - [x] Sin `console.log`, secretos ni `any` nuevos en el código de la app.
  - [x] Sin scroll horizontal en las 5 pantallas a 360 px (medido: 0 px en las cinco).
  - [x] Puerta compartida → `verify: OK`.
- **Desviaciones o dudas:**
  - **La pestaña Plan es `AttackPage`** (ruta `/dashboard/action-plan`); ahí va la composición del Plan. `ActionPlanPage` es la simulación completa (`/action-plan/full`) y queda fuera.
  - **Para decidir — avance de cada deuda en Cuentas:** cada fila usa la fracción pagada que ya mostraba la barra (`paidFraction`, sin cálculo nuevo), no el tiempo. Una línea por tiempo daría el mismo avance a todas las deudas y la prueba del papá no podría salir. El criterio por tiempo (decisión b) sí se aplica en el Plan y en el Calendario.
  - **Plan — lo recorrido:** no existe fecha de inicio del plan, así que la línea empieza hoy y lo recorrido es la parte del mes en curso. Sigue siendo tiempo, no dinero.
  - El botón de la misión en Inicio es nuevo («Ver cómo hacerlo», lleva al Plan), porque el documento le da un botón principal.
  - En Inicio la fecha libre pasa de la franja ámbar a una línea bajo el héroe; la franja desaparece.
  - En el Calendario se conservan el fondo de color por deuda y la barra roja → verde.
  - Las suscripciones «repetidas» se detectan por nombre igual (sin mayúsculas ni espacios), porque el servidor no marca duplicados.
  - La marca del mapache se quitó del aviso «llegó a $0» de Inicio. Sigue en el DaySheet (no se cambia su contenido) y en Análisis (fuera de alcance).
  - **Corrección de la misión 18:** `.kx-line` no tenía `overflow: hidden` y el envoltorio del corte creaba scroll horizontal (hasta 51 px en Cuentas). Se añade, con test de regresión.
  - Tests actualizados al diseño aprobado: `calendarEvents.test.tsx`, `noche.test.ts` (3), `SubscriptionsView.test.tsx`, `AttackPage.test.tsx`, `cimientos.test.tsx`.
- **Fallos preexistentes:** ninguno.
