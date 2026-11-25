# Corrida QA — 2026-11-24 08:07 UTC · 🔴 ROJO

- Destino: https://korexf.com · main en `43c1e06`
- Resultado: 6/8 flujos pasan · limpieza: cuenta principal borrada por la UI

| Flujo | Veredicto | Tiempo | Detalle |
|---|---|---|---|
| registro | ✅ PASA | 11.2 s | — |
| login | ✅ PASA | 3.7 s | — |
| agregar-deuda | ✅ PASA | 4.2 s | — |
| plan | ✅ PASA | 2.3 s | — |
| calendario | ❌ FALLA | 21.3 s | no apareció: la deuda «QA Tarjeta Prueba» en el calendario |
| suscripciones | ✅ PASA | 4.6 s | — |
| conectar-ia | ✅ PASA | 2.5 s | — |
| borrar-cuenta | ❌ FALLA | 6.0 s | no se pudo crear el usuario desechable: el registro mostró: email rate limit exceeded |

## Dónde mirar
- **calendario**: capturas/08-calendario-fallo.png
- **borrar-cuenta**: capturas/13-borrar-cuenta-fallo.png

Capturas en `capturas/`, todas juntas en `hoja-contacto.png`. Datos crudos en `resultado.json`.
