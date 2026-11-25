# Corrida QA — 2026-11-24 10:04 UTC · 🔴 ROJO

- Destino: https://korexf.com · main en `43c1e06` · **CANARIO en «calendario»** (corrida de prueba de la guardia, no oficial)
- Resultado: 6/8 flujos pasan · limpieza: sin usuario de borrado · korexqa31def083ab@euploading.com queda de relevo para la próxima corrida

| Flujo | Veredicto | Tiempo | Detalle |
|---|---|---|---|
| registro | ✅ PASA | 14.1 s | HTTP 500 /api/settings |
| login | ✅ PASA | 4.6 s | — |
| agregar-deuda | ✅ PASA | 4.2 s | — |
| plan | ✅ PASA | 2.3 s | — |
| calendario | ❌ FALLA | 21.1 s | (canario) no apareció: encabezado «Tu calendario de deuda» |
| suscripciones | ✅ PASA | 4.1 s | — |
| conectar-ia | ✅ PASA | 2.7 s | — |
| borrar-cuenta | ➖ OMITIDO | 0.0 s | el canario no borra cuentas |

## Dónde mirar
- **calendario**: capturas/08-calendario-fallo.png

Capturas en `capturas/`, todas juntas en `hoja-contacto.png`. Datos crudos en `resultado.json`.
