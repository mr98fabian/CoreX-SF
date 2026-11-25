# Misión 18: Rediseño «Cobre a la vista» — A: Cimientos
- **ID:** 2026-11-25-rediseno-cimientos
- **Estado:** en-auditoria
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
- **Fecha:** 2026-11-25
- **Rama y commit:** `feat/rediseno-cimientos` (ver PR). Primer commit: criterios de aceptación.
- **Evidencia de los criterios de aceptación:**
  1. Tokens: `cimientos.test.tsx › 1 · tokens` passed. Los 4 tokens van en un bloque `:root` propio; el bloque «Noche con luz» sigue idéntico byte a byte (`noche.test.ts` en verde). `git diff origin/main -- frontend/src/styles/kx.css`: solo inserciones (54), 0 líneas borradas.
  2. Contraste (WCAG, calculado en el test), sobre `#020617 / #111C33 / #1A2742 / #22314F`:
     funda `#7482A0` 5.23 / 4.40 / 3.85 / 3.36 · cobre `#F59E0B` 9.39 / 7.90 / 6.92 / 6.03 · extremo oscuro del cobre `#D97706` 6.33 / 5.33 / 4.67 / 4.07 · línea de icono en reposo `#8C9AB0` 7.07 / 5.95 / 5.21 / 4.55 · rótulo activo `#F5F2EC` 18.05. Funda contra cobre < 3:1, por eso el corte lleva labio de 2 px (comprobado en el test). `› 2 · contraste` passed.
  3. Título: `› 3 · título de pantalla` passed (`BankHeader` usa `.kx-screen-title`: Fraunces, 22 px, 400, `font-style: normal`). `git diff origin/main -- frontend/index.html` vacío.
  4. Línea de cobre: `› 4 · línea de cobre` passed (geometría, solo `transform`, quieta al montar, 480 ms + destello al avanzar, 240 ms sin destello al retroceder, posición por meses con `lib/lineProgress.ts`). Captura: `apertura-hoja.png` (la línea abierta en 300–480 ms) y la hoja de iconos y líneas vista en el navegador durante la sesión.
  5. Iconos: `› 5 · iconos` passed. `icons.tsx` = 3816 bytes (límite 12 KB). `git diff origin/main -- frontend/package.json` vacío.
  6. Barra: `› 6 · barra inferior` passed. Medido en el navegador a 360 px: pestañas de 55 / 82 / 51 / 69 / 99 × 56 px, ningún rótulo truncado, 11 px; indicador 24 × 3 px en el borde superior. A 375 px, 74 × 56 cada una.
  7. Apertura: `› 7 · apertura` passed (línea de tiempo CSS ≤ 1000 ms, `OPENING_MS` = 1000, se quita a los 1000 ms exactos, un toque la termina al instante, una vez por sesión, nunca en la landing, portal sobre la app ya montada). Capa: 4911 bytes en bruto, **1883 bytes gzip** (límite 3 KB; lo mido comprimido). Hoja de contacto en `apertura-hoja.png` (0, 120, 300, 480, 540, 700, 850 y 1000 ms).
  8. **NO CUMPLIDO tal como está escrito.** Playwright + Chromium, CPU ×4, build de producción servido en local, 3 ejecuciones por build, primeros 3 s (`fotogramas-produccion-cpu4.json`, scripts `perf.mjs` y `opening.mjs`):
     - `main` (sin apertura): 9–10 fotogramas > 32 ms, máximo 233–267 ms.
     - Rama: 11 fotogramas > 32 ms, máximo 217–233 ms; dentro de la apertura, 7–8, máximo 217–233 ms.
     - Los picos (~130, ~230, ~170 ms) son el arranque de la propia app y ya están en `main`; la apertura añade 1–2 fotogramas de ~33 ms. Lo comprobé además con la apertura sin ninguna animación y con un fundido en lugar del iris: mismos picos. Con el CPU real de un Android de gama media no está medido.
  9. Movimiento: `› 9 · movimiento` passed (nada nuevo en bucle; fuera de la apertura nada pasa de 700 ms: el destello empieza a 460 ms y acaba a 700; nada escucha el scroll; el corte no recibe toques).
  10. Reducir movimiento: `› 10 · reducir movimiento` passed (sin transición de línea ni destello ni iris; la apertura es un fundido de 150 ms y se quita a los 150 ms).
  11. Peso: build de `origin/main` frente a la rama, suma gzip de lo que carga `dist/index.html`: 279 848 → 281 811 bytes (**+1963 bytes**, límite 20 KB). Todos los JS y CSS: +2557 bytes. Imágenes nuevas en `frontend/`: 0 (la única imagen nueva es la evidencia de esta misión, en `misiones/`).
  12. Metáfora: `› 12 · metáfora` passed (cero «cable», «pelar», «enchuf» o «Tadeo» en el código nuevo, sin contar comentarios).
  13. Arranque nativo: `res/drawable/kx_splash.xml` (capas: `#020617`, logo vectorial 64 dp, línea forrada de 10 dp 40 dp por debajo) y `kx_splash_logo.xml` (el isotipo como vector). `styles.xml` y `capacitor.config.ts` (`androidSplashResourceName: 'kx_splash'`) apuntan a él. XML validado con `xml.dom.minidom`. **Build de Android no ejecutado**: no hay JDK en el PATH de esta máquina.
  14. Puerta: `python scripts/verify.py` → `verify: OK` (pytest, alembic heads, vitest 60 archivos / 419 tests, eslint, build).
  15. CI: ver checks del PR.
- **Checklist de auto-verificación:**
  - [x] Diff auto-revisado → `git diff --stat origin/main...HEAD` en el PR.
  - [x] Fuera de alcance = 0: solo `frontend/src` (tokens, kx, nav, motion, App), `frontend/android/.../res`, `frontend/capacitor.config.ts`, un test existente (`depth.test.tsx`) y `misiones/`. Sin backend ni endpoints.
  - [x] Migraciones: ninguna.
  - [x] Sin `console.log`, secretos ni `any` nuevos.
  - [x] Puerta compartida → `verify: OK`.
- **Desviaciones o dudas:**
  - **La «K» es el isotipo.** El logo real de KoreX es el isotipo (mapache sobre una X); no existe una «K» suelta. Uso el isotipo tal cual en la apertura y en el arranque nativo. Si Fabian quiere otra marca ahí, es un cambio de un archivo.
  - **Precondición:** el PR del documento (#16) seguía abierto. Esta rama parte de `main` con el commit del documento añadido; el contenido es idéntico, así que no habrá conflicto cuando se fusione el #16.
  - **Iris:** con la curva «tirón» del documento, el iris cubre la pantalla en unos 80 ms de sus 320. Lo dejé como dice el documento, con radio 80vmax.
  - **Barra:** las pestañas toman el ancho de su rótulo (`flex-auto`) para que «Suscripciones» no se corte a 360 px.
  - **Android 12 o más nuevo:** la pantalla de arranque del sistema solo muestra el icono centrado; la línea forrada se ve en la pantalla de Capacitor y en Android 11 o anterior.
  - **Vibración:** no se implementa (apagada por defecto, sin ajuste que la active todavía).
  - `depth.test.tsx` buscaba «el último bloque de movimiento reducido» de `kx.css`; ahora lo busca dentro de su propia sección, porque esta misión añade otro bloque al final.
  - Incidente local, ya resuelto: al borrar el worktree temporal de medición se borró parte de `frontend/node_modules` a través de un enlace; se restauró con `npm ci` desde el `package-lock` (mismas versiones) y la puerta volvió a verde.
  - Fuera de alcance y anterior a esta misión: `kx-shimmer` (carga) va en bucle y `kx-breathe` dura 850 ms.
- **Fallos preexistentes:** ninguno.
