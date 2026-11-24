# Corrida QA — 2026-11-24 11:03 UTC · 🔴 ROJO

- Destino: https://korexf.com · main en `43c1e06` · **CANARIO en «calendario»** (corrida de prueba de la guardia, no oficial)
- Resultado: 4/8 flujos pasan · limpieza: sin usuario de borrado
- Regresión contra la última verde 43c1e06 (2026-11-24T11:00:37.348Z): **se rompió calendario** entre esa verde y `43c1e06`

| Flujo | Veredicto | Tiempo | Detalle |
|---|---|---|---|
| registro | ➖ OMITIDO | 0.0 s | el canario entra con el usuario de relevo |
| login | ✅ PASA | 3.8 s | — |
| agregar-deuda | ➖ OMITIDO | 0.0 s | el canario usa la deuda del usuario de relevo |
| plan | ✅ PASA | 2.3 s | — |
| calendario | ❌ FALLA | 21.0 s | (canario) no apareció: encabezado «Tu calendario de deuda» |
| suscripciones | ✅ PASA | 4.1 s | — |
| conectar-ia | ✅ PASA | 2.5 s | — |
| borrar-cuenta | ➖ OMITIDO | 0.0 s | el canario no borra cuentas |

## Dónde mirar
- **calendario**: capturas/03-calendario-fallo.png

Capturas en `capturas/`, todas juntas en `hoja-contacto.png`. Datos crudos en `resultado.json`.
