# Misión: Limpieza completa y optimización de rendimiento
- **ID:** 2026-11-22-limpieza-optimizacion
- **Estado:** en-auditoria
- **Rama:** feat/limpieza-optimizacion
- **Repo:** CoreX-SF
- **Prioridad:** ALTA — lentitud observada en producción (2026-11-22): login y carga del
  panel muy lentos en el teléfono de Fabian; medido por Mijo, `GET /api/dashboard`
  tardó ~2.9 s desde una conexión de datacenter.
## Objetivo
Que KoreX se sienta rápido: login ágil y panel principal usable en menos de ~1.5 s en
una conexión móvil normal, sin cambiar ninguna funcionalidad ni comportamiento visible.
## Regla de oro
**Medir antes de tocar.** Primero diagnóstico con números, luego correcciones en orden
de impacto, y al final la misma medición para probar la mejora (antes/después).
## Pasos
1. **Diagnóstico backend**: tiempos por endpoint (dashboard, cuentas, plan, calendario)
   en producción y local; consultas lentas, patrones N+1, índices faltantes en Supabase,
   costo de RLS por consulta; arranques en frío y recursos del servicio en Railway.
2. **Diagnóstico frontend**: peso del bundle, code-splitting por ruta, fuentes/imágenes,
   qué bloquea el primer pintado útil tras el login. Lighthouse móvil en korexf.com.
3. **Correcciones** en orden de impacto medido (solo lo que la medición señale):
   índices/caché en endpoints calientes, payloads más chicos, lazy-loading de rutas
   pesadas, prefetch tras login, keep-warm del backend, compresión de assets.
4. **Limpieza**: código muerto, dependencias sin uso, assets huérfanos — solo lo que se
   pueda PROBAR muerto (búsqueda en todo el repo); ante la duda, no se borra.
5. **Re-medición completa** con el mismo método y tabla antes/después.
## Criterios de aceptación
- [ ] Tabla antes/después: endpoints clave y carga del panel (Lighthouse móvil + navegación real).
- [ ] `GET /api/dashboard` por debajo de ~800 ms en la medición del Reporte.
- [ ] Cero cambios de funcionalidad o textos visibles (si algo debe cambiar, se anota y se pregunta).
- [ ] pytest + vitest + eslint + build en verde.
- [ ] Sin migraciones salvo índices justificados por la medición; si las hay, `alembic heads` == 1.
## No tocar
- Nada de rediseño visual ni de flujos. No cambiar proveedores, planes ni configuración
  de Railway/Supabase fuera del código: eso se anota como recomendación para Fabian.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-22
- **Rama y commit:** `feat/limpieza-optimizacion` — código en 1a2509f (backend), 84baf1f (precarga
  frontend), 8bbc302 (limpieza); este reporte va en el commit de cabeza de la rama. Base: main 0f9f5bf.
- **Método de medición:** producción medida con el token demo (cuenta sintética, solo GET), 5 corridas
  por endpoint (mediana), desde esta PC (Texas, edge Railway `iah1`). Se separa el tiempo de servidor
  (cabecera `X-Process-Time`) del de red. Local: la app real con ~55 ms inyectados por sentencia SQL
  (el viaje Railway↔Supabase inferido en prod), cuenta demo sembrada, rama vs main.
- **Diagnóstico (los 3–5 cuellos de botella reales, con números):**
  1. **El panel se atendía en fila.** 72 rutas eran `async def` sin ningún `await` y hacían DB síncrona
     dentro del event loop de un solo worker: la API atiende UNA petición a la vez. Prod: las 9 llamadas
     del panel en paralelo tardan **2.6–2.9 s** de pared (suma de sus tiempos sueltos ≈ 3.1 s), aunque
     `/api/dashboard` solo tarde 0.68 s en servidor. Es exactamente el ~2.9 s que midió Mijo.
  2. **Cada sentencia SQL es un viaje de red caro.** Un endpoint de 1 consulta tarda ~170 ms en servidor
     (≈ BEGIN + SELECT + ROLLBACK → ~55 ms por viaje). La DB está en `us-east-2` (Ohio); un viaje de
     55 ms indica que Railway corre en otra región (creído, no verificado en el panel).
  3. **`/api/dashboard` repetía consultas y tenía un N+1:** cashflow y suscripciones se cargaban 2 veces,
     el escudo 2 veces, y los pagos desde el corte se pedían con una consulta POR deuda.
     Local: 8 sentencias con la cuenta demo (más con más deudas con corte).
  4. **Tras el login, el código del panel llegaba en cadena:** layout (71 KB) y luego Inicio (18 KB),
     y solo después empezaban las peticiones de datos.
  5. Frontend inicial (no es el cuello principal): entrada 273 KB gzip (react-dom, traducciones ES/EN,
     react-query). Lighthouse móvil prod: landing 71 (FCP 4.7 s), /login 88 (FCP 3.0 s), TBT 0 ms.
- **Correcciones aplicadas y su impacto individual:**
  1. 72 rutas `async def` sin await → `def` (FastAPI las corre en threadpool) + auth de tokens `kx_`
     fuera del loop. Burst local del panel: **1398 → 467 ms** (antes de la corrección 2).
  2. Una sola consulta para los pagos desde el corte (antes N) y reutilizar cashflow/escudo ya cargados
     en el dashboard (y el escudo en command-center). Dashboard local: **8 → 5 sentencias, 459 → 291 ms**.
  3. `/login` precarga en reposo los chunks del panel (verificado en el build de producción: al abrir
     `/login` ya se descargan `DashboardLayout-*.js` y `HomePage-*.js`). Ahorra 2 viajes en cadena tras
     iniciar sesión; no se cuantificó en ms en móvil real.
  Guardas: `backend/tests/test_perf_queries.py` (consultas constantes con N deudas — falla en main —,
  pagos por cuenta idénticos, y ninguna ruta `async` sin await).
- **Tabla antes/después:**

  | Medición | Antes (main) | Después (rama) | Dónde |
  |---|---|---|---|
  | 9 llamadas del panel en paralelo (pared) | 2600–2900 ms | pendiente de deploy | prod |
  | `/api/dashboard` en servidor, sola | 678 ms | pendiente de deploy | prod |
  | 9 llamadas del panel en paralelo (pared) | 1398 ms | 331 ms | local, 55 ms/SQL |
  | `/api/dashboard` sola | 459 ms (8 SQL) | 291 ms (5 SQL) | local, 55 ms/SQL |
  | `/api/dashboard` dentro del burst | 528 ms | 297 ms | local, 55 ms/SQL |
  | Chunks del panel tras login | 2 en cadena | 0 (ya precargados) | build prod local |
  | Lighthouse móvil /login · landing | 88 · 71 | pendiente de deploy | prod |

  **Estimación (no medida) para prod tras el deploy:** dashboard ≈ 678 − 3×55 ≈ 0.5 s en servidor y el
  panel completo ≈ la llamada más lenta (~0.6–0.8 s) en vez de la suma (~2.9 s). El criterio
  "`/api/dashboard` < ~800 ms" está cumplido en local y debe re-medirse en prod tras el merge con
  el mismo método (token demo, mediana de 5, `X-Process-Time`); hasta entonces es una estimación.
- **Limpieza hecha (qué se borró y cómo se probó que estaba muerto):** `components/ui/chart.tsx`,
  `components/ui/progress.tsx`, `components/ui/tooltip.tsx`, `lib/database.types.ts` (cero referencias
  en `git grep` de ruta y nombre en todo el repo) y las dependencias `sonner`,
  `@radix-ui/react-tooltip`, `@radix-ui/react-progress` (ningún import). No se tocaron
  `@capacitor/haptics` (lo usa el proyecto Android), `react-is` (peer de recharts) ni las fuentes.
  El bundle de entrada no cambia: eso ya no se empaquetaba; es higiene, no velocidad.
- **Verificaciones corridas y resultado:** pytest **602 passed**; vitest **54 archivos / 328 tests
  passed**; `eslint src --max-warnings 0` sin errores; `npm run build` OK; `alembic heads` = 1
  (`c9a4f2e7b815`, sin migraciones nuevas).
- **Recomendaciones fuera de código (para Fabian):**
  1. **Mover el servicio de Railway a la región más cercana a Supabase `us-east-2`** (US East). Es la
     mayor ganancia que queda: cada sentencia SQL bajaría de ~55 ms a unos pocos ms. Antes, confirmar en
     el panel de Railway en qué región está hoy.
  2. Re-medir prod tras el deploy de esta rama (tabla de arriba) y Lighthouse móvil.
  3. Siguiente paso en código, si hace falta: partir las traducciones por idioma (~90 KB fuente en la
     entrada) y cargar framer-motion/gsap solo donde se usan. No se hizo porque toca muchas pantallas.
- **Desviaciones o dudas:** el "después" en producción no se pudo medir sin desplegar (el merge espera
  la auditoría). Durante la primera medición, prod devolvió 502 unos segundos: coincidió con el
  redeploy disparado por el push del commit de docs en main.
