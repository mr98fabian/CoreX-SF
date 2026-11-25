# Misión 18: Rediseño «Cobre a la vista» — A: Cimientos
- **ID:** 2026-11-25-rediseno-cimientos
- **Estado:** en-curso
- **Rama:** feat/rediseno-cimientos
- **Repo:** CoreX-SF

## Objetivo
Construir los cimientos del rediseño aprobado: tokens nuevos, título de pantalla en Fraunces recta, componente de línea de cobre, los 18 iconos propios, la barra inferior nueva, la apertura de 1 s y la pantalla de arranque nativa a juego. Las 5 pantallas conservan su composición (eso es la misión 19).

## Contexto
- Fuente de verdad: `misiones/2026-11-25-direccion-de-arte.md` (iteración 2, aprobada por Fabian el 2026-11-25). Si algo de aquí lo contradice, manda el documento.
- Decisiones de Fabian (2026-11-25): el corte de cada línea se mide en **tiempo** (meses recorridos del plan), sin tocar backend; héroe de Inicio «Debes ≈» (misión 19); vibración **apagada por defecto**.
- Sin backend, sin endpoints, sin números ni rótulos nuevos, sin Tadeo, sin la metáfora en textos visibles.

## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | Los 4 tokens nuevos con su valor; la paleta base no cambia; sin `--kx-tinta` ni `--kx-goma` | `npx vitest run src/components/kx/cimientos.test.tsx -t "tokens"` + `git diff origin/main -- frontend/src/styles/kx.css` | passed; el diff solo añade líneas en kx.css |
| 2 | Contraste: texto ≥ 4.5:1 y objetos gráficos ≥ 3:1 en los pares nuevos en uso (funda y cobre sobre fondo y superficies, rótulos de la barra) | `cimientos.test.tsx -t "contraste"` (cálculo WCAG en el test) | passed, con la tabla de valores en el Reporte |
| 3 | Título de pantalla en Fraunces recta, 22 px, peso 400, sin cursiva; sin peticiones de fuentes nuevas | `cimientos.test.tsx -t "título"` + `git diff origin/main -- frontend/index.html` | passed; index.html sin cambios |
| 4 | Línea de cobre: funda 10 px + sombra 1 px, cobre 6 px, corte con labio de 2 px; solo `transform` (nunca `width`); posición por tiempo recorrido | `cimientos.test.tsx -t "línea"` (incluye la función de tiempo) + captura en el navegador | passed; captura en el Reporte |
| 5 | 18 iconos: 2 trazos cada uno (línea + punta de cobre), retícula 24, grosor 2, extremos redondos, sin relleno; juntos ≤ 12 KB sin comprimir; sin librería nueva | `cimientos.test.tsx -t "iconos"` + `git diff origin/main -- frontend/package.json` | passed; package.json sin cambios |
| 6 | Barra inferior: 5 pestañas, 56 px, rótulos 11 px siempre visibles, indicador de cobre 24×3 que se desliza, sin botón flotante ni pastilla; cada pestaña ≥ 44×44 px | `cimientos.test.tsx -t "barra"` + medición en el navegador a 375 px (`getBoundingClientRect`) | passed; medidas en el Reporte |
| 7 | Apertura: 1000 ms exactos; se salta al tocar con estado final en ≤ 120 ms; una vez por sesión; con «reducir movimiento», fundido de 150 ms; la app montada debajo desde el ms 0; capa ≤ 3 KB; cero bitmaps | `cimientos.test.tsx -t "apertura"` (tiempos de la CSS y del componente, temporizadores falsos) | passed |
| 8 | Apertura sin fotogramas de más de 32 ms en gama media | Playwright + Chromium con CPU ralentizada ×4 (aproximación estándar de gama media), registro de intervalos de `requestAnimationFrame` durante la apertura | fotograma máximo ≤ 32 ms; salida en el Reporte |
| 9 | Ninguna animación nueva fuera de la apertura dura > 700 ms, ni va en bucle, ni bloquea un toque, ni salta al desplazar | `cimientos.test.tsx -t "movimiento"` | passed |
| 10 | Con «reducir movimiento»: cero animaciones salvo fundidos ≤ 150 ms (en lo nuevo) | `cimientos.test.tsx -t "reducir"` | passed |
| 11 | Peso añadido al paquete inicial ≤ 20 KB comprimidos; cero imágenes nuevas | build de `origin/main` y de la rama; suma gzip de lo que carga `dist/index.html`; `git diff --name-only --diff-filter=A origin/main` sin .png/.jpg/.webp/.gif | diferencia ≤ 20 KB; lista vacía |
| 12 | Ningún texto visible con la metáfora ni con Tadeo | `cimientos.test.tsx -t "metáfora"` (cadenas de los archivos nuevos y tocados) | passed |
| 13 | Arranque nativo a juego: fondo #020617, logo 64 dp centrado, línea forrada al 70 % 40 dp debajo, sin bitmap nuevo | `drawable/kx_splash.xml` + `styles.xml` + `capacitor.config.ts`; build de Android si el SDK lo permite | XML válido; build o motivo por el que no se pudo |
| 14 | Puerta compartida en verde | `python scripts/verify.py` | `verify: OK` (exit 0) |
| 15 | CI en verde | checks `backend` y `frontend` del PR | success |

## Pasos
1. Tokens y título.
2. Línea de cobre y función de tiempo.
3. Iconos y barra inferior.
4. Apertura y arranque nativo.
5. Tests, medición de fotogramas y de peso, verify, PR.

## No tocar
- Ningún número, rótulo ni cálculo (misión 17). Ningún endpoint ni backend.
- La composición de las 5 pantallas (misión 19).
- Nada de Tadeo; ningún texto con «cable», «pelar», «enchufar» o «Tadeo».

## Reporte (lo llena Claude al ejecutar)
- **Fecha:**
- **Rama y commit:**
- **Evidencia de los criterios de aceptación:**
- **Checklist de auto-verificación:**
- **Desviaciones o dudas:**
- **Fallos preexistentes:**
