# Corrida QA — 2026-11-24 09:06 UTC · 🔴 ROJO

- Destino: https://korexf.com · main en `43c1e06` · **CANARIO en «calendario»** (corrida de prueba de la guardia, no oficial)
- Resultado: 1/8 flujos pasan · limpieza: usuario de borrado eliminado (korexqa71af7522cd@euploading.com)

| Flujo | Veredicto | Tiempo | Detalle |
|---|---|---|---|
| registro | ❌ FALLA | 6.3 s | el registro mostró: email rate limit exceeded |
| login | ⏸ NO CORRIÓ | 0.0 s | dependía de un flujo que falló |
| agregar-deuda | ⏸ NO CORRIÓ | 0.0 s | dependía de un flujo que falló |
| plan | ⏸ NO CORRIÓ | 0.0 s | dependía de un flujo que falló |
| calendario | ⏸ NO CORRIÓ | 0.0 s | dependía de un flujo que falló |
| suscripciones | ⏸ NO CORRIÓ | 0.0 s | dependía de un flujo que falló |
| conectar-ia | ⏸ NO CORRIÓ | 0.0 s | dependía de un flujo que falló |
| borrar-cuenta | ✅ PASA | 9.9 s | — |

## Dónde mirar
- **registro**: capturas/02-registro-fallo.png

Capturas en `capturas/`, todas juntas en `hoja-contacto.png`. Datos crudos en `resultado.json`.
