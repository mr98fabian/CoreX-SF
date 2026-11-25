# Misión 19: Rediseño «Cobre a la vista» — B: Composición
- **ID:** 2026-11-25-rediseno-composicion
- **Estado:** en-curso
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
- **Fecha:**
- **Rama y commit:**
- **Evidencia de los criterios de aceptación:**
- **Checklist de auto-verificación:**
- **Desviaciones o dudas:**
- **Fallos preexistentes:**
