# Equipo QA de KoreX

Tres agentes que **leen, prueban y reportan** contra producción (korexf.com). No publican, no compran,
no pagan, no contactan a nadie y no arreglan nada: sus hallazgos pasan a la cola de misiones.
Esta carpeta NO forma parte de las suites de la app: `scripts/verify.py` y el CI no la tocan.

| Agente | Qué hace | Cómo se lanza | Deja |
|---|---|---|---|
| **Probador** | Recorre 8 flujos reales con cuentas desechables | `cd qa && npm run probador` | `corridas/<fecha>/` |
| **Regresión** | El Probador + comparación con la última corrida verde | `cd qa && npm run regresion` | lo mismo + bloque «Regresión» |
| **Revisor UX** | Lee la hoja de contacto y escribe la reseña priorizada | `cd qa && npm run resena` | `resenas/<fecha>.md` |

Primera vez en una PC: `cd qa && npm install && npx playwright install chromium`.

## Probador
Flujos, en orden: **registro** (formulario + enlace real del correo de confirmación), **login**
(sesión limpia), **agregar-deuda**, **plan**, **calendario**, **suscripciones**, **conectar-ia**,
**borrar-cuenta**. Cada uno sale con veredicto PASA / FALLA / NO CORRIÓ (si dependía de uno que falló).

- **Cuentas desechables**: cada corrida crea un buzón en mail.tm (decisión de Fabian, 2026-11-24),
  registra con él una cuenta `korexqa…`, la confirma con el enlace real del correo y la usa.
  Jamás se usa la cuenta de Fabian ni datos reales.
- **Borrar cuenta usa su propio usuario**: la cuenta principal de cada corrida queda «de relevo»
  (`.estado/relevo.json`, fuera de git) y es la que borra la corrida siguiente por la UI; así cada
  corrida envía un solo correo (Supabase limita los correos de confirmación por hora).
- **Conectar IA**: con el plan gratis la conexión real exige pagar, y el equipo QA no paga. Se prueba
  la guía y la puerta hasta la página de planes con precios.
- Una corrida a la vez (candado en `.estado/corriendo.lock`).

Salida en `corridas/<AAAA-MM-DD_HHMM>/`: `reporte.md` (una página), `resultado.json`,
`capturas/` y `hoja-contacto.png` (todas las capturas en una imagen, con el borde del color del
veredicto). En git solo quedan `reporte.md` y `resultado.json`; las imágenes viven en la PC.
Código de salida: 0 verde, 1 rojo.

### Canario (prueba de que la guardia caza)
`npm run canario` rompe a propósito una expectativa del flujo `calendario` (o el que pases con
`node run.mjs --canario=<flujo>`). El reporte debe salir en 🔴 nombrando ese flujo. Va a
`corridas/canario-<fecha>/` y nunca toca `ultima-verde.json`.

## Regresión
Tras cada corrida oficial en verde se guarda `ultima-verde.json` (fecha, commit de main, flujos).
`npm run regresion` marca en el reporte qué flujos que pasaban en esa verde fallan ahora, y entre
qué commit y cuál.

## Revisor UX
Instrucción permanente en `revisor-ux.md`. `npm run resena` lanza Claude Code sin interfaz
(`claude -p`) sobre la última corrida oficial, con permiso solo para leer y escribir en `resenas/`.
También se puede abrir una sesión de Claude y pedirle: «sigue `qa/revisor-ux.md` sobre la corrida X».

## Disparadores programados (Programador de tareas de Windows)
Instalar o actualizar: `powershell -ExecutionPolicy Bypass -File qa\tareas.ps1`
(quitar: añadir `-Quitar`). Crea dos tareas del usuario actual:

| Tarea | Cuándo | Qué corre |
|---|---|---|
| `KoreX-QA-diario` | todos los días a las 09:00 (si la PC estaba apagada, al encenderla) | `node run.mjs --regresion` → `.estado/diario.log` |
| `KoreX-QA-vigia` | cada 15 min | `node vigia.mjs` → `.estado/vigia.log` |

El **vigía** mira `main` en GitHub; al ver un commit nuevo espera 12 min (`QA_ESPERA_DEPLOY_MIN`) a
que Railway y Vercel desplieguen y corre la Regresión. Ver estado: `schtasks /Query /TN KoreX-QA-diario`.

Las tareas corren `qa/` del checkout actual: hasta que esta carpeta esté en `main`, solo funcionan
con la rama `chore/equipo-qa` activa.

## Límites conocidos
- Supabase envía los correos de confirmación con su SMTP integrado, limitado por hora a todo el
  proyecto: si usuarios reales se registran a la vez, el registro del Probador puede fallar con
  «email rate limit exceeded» (y el de ellos también; ver el Reporte de la misión 12).
- Variables: `QA_BASE_URL` (por defecto `https://korexf.com`), `QA_ESPERA_DEPLOY_MIN`.
