# Widget de pantalla de inicio — spec (Fase 6 · 6B.4, sin código)

Para cuando KoreX se empaquete para Google Play como TWA (Trusted Web Activity).

## Qué muestra (una mirada, tres datos)
| Zona | Contenido | Fuente |
|---|---|---|
| Fondo | Color del mes según la deuda total proyectada (rojo → amarillo → verde en $0), mismo degradado que el calendario | `freedom-path` → `lib/calendarSeries.debtColor` |
| Línea 1 (frase) | Estado en lenguaje llano: "Vas bien: el rojo se aclara" / "Corte de la Visa en 3 días" | misma lógica que Inicio |
| Número héroe | Deuda total (Fraunces, tabular) | `/api/dashboard.total_debt` |
| Línea 2 | Próximo corte y cuánto falta para reportar $0 ("Visa · 8 nov · faltan $6,800") | `nextCut()` de `useKxSummary` |

- Tamaño 2×2: solo frase + número héroe sobre el color del mes.
- Tamaño 4×2: frase + número + próximo corte + mini barra del mes.
- Tocar el widget abre Inicio; tocar el próximo corte abre esa cuenta.
- Sin montos de cuentas individuales ni APRs (privacidad en pantalla bloqueada).

## Reglas
- Toda cifra marcada como estimación cuando es proyectada ("≈").
- Una sola señal: el próximo corte. Nada de urgencia falsa.
- Contraste WCAG 4.5:1 sobre cualquier color de fondo (texto oscuro sobre verde/amarillo, claro sobre rojo, como el calendario).
- Ámbar solo como acento del borde, nunca de fondo.

## Cómo se construiría
- TWA no ofrece widgets por sí solo: requiere un módulo nativo Android (App Widget) dentro del contenedor, que lea un endpoint de solo lectura con el token del usuario.
- Actualización: cada 6 h y al registrar un pago (WorkManager), no en tiempo real.
- Pendientes antes de construirlo: decidir TWA vs Capacitor para Play, y si el widget usa un token de solo lectura (`read:dashboard`) — que hoy exige plan de pago (candado de IA de la Fase 6).
