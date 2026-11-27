# Misión 14: Auditoría total de números — que todo concuerde
- **ID:** 2026-11-24-auditoria-numeros
- **Estado:** en-auditoria
- **Rama:** docs/auditoria-numeros
- **Repo:** CoreX-SF

## Objetivo
Revisar cada número que KoreX muestra o calcula, rastrearlo hasta su función y fórmula, dictaminar si
concuerda con el mismo concepto en todas las superficies y especificar la fuente única que debe
alimentarlas. **Solo auditoría y especificación**: la corrección la construye Opus en la misión siguiente.

## Contexto
Caso que dispara la misión (cuenta real, 2026-11-24, misma hora). **Cifras anonimizadas** en todo este
expediente: montos escalados por un factor no publicado y nombres genéricos; fechas, APR y reglas intactas,
así que cada mecanismo y cada proporción se conservan. El panel dice deuda
$35,410.63; la misión dice ataque $0 «reservando $6,014.24»; el Calendario dice «DEBES ≈ $27,743 al cierre
del mes · bajas ≈ $7,668». Los pagos reales programados del 24 al 30 suman $1,550.74.

## Criterios de aceptación ejecutables
| # | Criterio | Cómo se comprueba (test / comando / artefacto) | Resultado esperado |
|---|----------|-----------------------------------------------|--------------------|
| 1 | El caso del 2026-11-24 se reproduce con el motor real, al centavo | `cd backend && ./venv/Scripts/python.exe ../misiones/2026-11-24-auditoria-numeros/evidencia/sonda_concordancia.py` | `deuda_total 35410.63`, `mision.reserva 6014.24`, `mision.ataque 0`, `calendario.cierre_mes 27742.85`, `calendario.bajas 7667.78` |
| 2 | Cada uno de los tres números se explica línea por línea (función, fórmula, sumandos) | `misiones/2026-11-24-auditoria-numeros/2-discrepancias.md`, sección «Caso #1» | los sumandos de cada número suman el número, con archivo:línea |
| 3 | Tabla de concordancia: una fila por número, con superficie, valor, fuente, fórmula y dictamen | `misiones/2026-11-24-auditoria-numeros/1-tabla-concordancia.md` | cubre motores y pantallas de la lista de la misión; ninguna fila sin fuente salvo las marcadas como hallazgo |
| 4 | Lista de discrepancias ordenada por severidad, cada una con clase (a/b/c/d) y causa raíz en el código | `misiones/2026-11-24-auditoria-numeros/2-discrepancias.md` | cada discrepancia con archivo:línea y reproducción |
| 5 | Especificación de la fuente única + tests de concordancia para CI | `misiones/2026-11-24-auditoria-numeros/3-fuente-unica.md` | cada concepto con su función dueña, las pantallas que dejan de calcular y los tests con su aserción |
| 6 | Personas fijas + demo corridas con la misma sonda | `misiones/2026-11-24-auditoria-numeros/evidencia/salida_sonda.json` | 3 personas (Caso real (anon.) 24-nov, María demo, dueño de `test_invariantes_numeros`) + sensibilidad por día |
| 7 | No se tocó código de producción | `git diff --name-only origin/main...HEAD` | solo rutas bajo `misiones/` |
| 8 | Puerta compartida en verde | `python scripts/verify.py` | `verify: OK` (exit 0) |

## Pasos
1. Mapear motores y endpoints; mapear aritmética en el frontend.
2. Reproducir el caso real con una sonda que siembra SQLite en memoria y llama a las funciones reales.
3. Correr la sonda con las personas fijas y la demo.
4. Escribir los tres entregables.

## No tocar
- Lógica de negocio decidida por Fabian (avalancha, cortes, escudo) ni diseño visual.
- Código de producción (backend/ y frontend/).

## Reporte (lo llena Claude al ejecutar)
- **Fecha:** 2026-11-24
- **Rama y commit:** `docs/auditoria-numeros` (desde `origin/main` 868eae6)
- **Evidencia de los criterios de aceptación:**
  1. `cd backend && PYTHONIOENCODING=utf-8 ./venv/Scripts/python.exe ../misiones/2026-11-24-auditoria-numeros/evidencia/sonda_concordancia.py`
     → `"deuda_total": "35410.63"`, `"reserva": "6014.24"`, `"ataque": "0"`, `"cierre_mes": 27742.85`, `"bajas": 7667.78`
     (salida completa en `evidencia/salida_sonda.json`).
  2. `2-discrepancias.md` § «Caso #1»: deuda = 7 saldos; reserva = 6 obligaciones; cierre = 35,410.63 + 744.38 − 1,466.10 − 6,946.06;
     baja fantasma desglosada en 5 sumandos que dan 6,263.87 = 34,006.72 − 27,742.85.
  3. `1-tabla-concordancia.md`: 70 filas en 7 bloques (foto de hoy, flujo mensual, misión/GPS, proyecciones, avisos, demo, personas).
  4. `2-discrepancias.md`: 17 discrepancias (6 críticas, 8 molestas, 3 pulido), cada una con clase, archivo:línea y reproducción; 4 decisiones para Fabian (D1-D4).
  5. `3-fuente-unica.md`: dueño de cada concepto, `debt_path` como motor único, 7 archivos que dejan de calcular, 14 tests de concordancia con su aserción.
  6. `salida_sonda.json`: personas `caso_real_anon_2026-11-24`, `maria_demo`, `owner_invariantes` + `sensibilidad_caso_real_por_dia` (bajas = 7,667.78 los días 1, 15, 24 y 30).
  7. `git diff --name-only origin/main...HEAD` → solo `misiones/2026-11-24-auditoria-numeros*` y `misiones/cola.md`.
  8. `python scripts/verify.py` → `verify: OK` (pytest, alembic-heads, vitest, eslint, build).
- **Checklist de auto-verificación:**
  - [x] Diff auto-revisado → 7 archivos, todos bajo `misiones/` (1,361 líneas de entregables + misión y cola).
  - [x] Archivos fuera de alcance = 0 → la misión permite solo `misiones/`; ninguna ruta de `backend/` ni `frontend/`.
  - [x] Migraciones = 1 head → `alembic heads`: `a7d4e2c9f1b3 (head)`; sin migraciones en el diff.
  - [x] Sin `console.log`, secretos ni `any` nuevos → grep del diff vacío (solo Markdown, JSON y un script Python de evidencia).
  - [x] Puerta compartida → `verify: OK`.
  - [x] Criterios de aceptación uno a uno → ver arriba.
- **Desviaciones o dudas:**
  - La persona `caso_real_anon_2026-11-24` sale de una lectura (solo lectura) de producción, **anonimizada** antes de entrar
    al repo: montos escalados por un factor no publicado, nombres genéricos, sin ids. Los tres números del caso se
    reproducen igual con ella (mismo mecanismo); Opus usa esta persona en `test_concordancia.py`.
  - Las cifras públicas de la demo «plan $22,100 / $12,300» no tienen fuente en el código (N-13): pido a Fabian de dónde salen.
  - `CLAUDE.md` dice head de Alembic `c4e8a1f7d2b6`; el real es `a7d4e2c9f1b3` (dato de documentación desactualizado).
- **Fallos preexistentes:** ninguno.
