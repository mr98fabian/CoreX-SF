# MISIÓN — Panel de crédito total y utilización (en Cuentas)

Estado: diseño en revisión (2026-11-08). No implementado.

## Idea

Aprovechando que las tarjetas ya viven en Cuentas, que la app sume sus límites y diga cuánto crédito total tiene el usuario, cuánto ha usado, cuánto le queda disponible y su % de utilización — con barrita de color: 0–10% verde · >10–30% ámbar · >30% rojo, global y por tarjeta. Foco deuda. Frontend-only: los datos ya existen (`balance`, `credit_limit` en Account).

## Alcance

- Bloque "TU CRÉDITO" encabezando Cuentas (solo si hay ≥1 tarjeta con límite): número héroe = crédito disponible (Σ límites − Σ saldos de tarjetas con límite), y la fila técnica: límite total · usado · utilización global % con su barra de color según la escala. Nota tenue: "Utilización actual; al corte, esto es lo que ve el buró."
- Por tarjeta: en su fila/etapa, utilización % + barrita con la misma escala (solo tarjetas con límite; préstamos y tarjetas sin límite no muestran barrita). La Amex Gold (sin límite preestablecido) lleva la nota "sin límite preestablecido" y queda FUERA de los totales — nunca un límite inventado.
- Utilización por tarjeta = saldo / límite; si saldo > límite, >100% y barra llena en rojo (sin romper el layout).
- Colores con los tokens de etapa existentes (verde=paid, ámbar, rojo=debt) — sin colores nuevos.
- El % pagado de las etapas NO cambia en esta misión; la barrita de utilización es un elemento aparte.

## Tests

Totales con datos demo (suma solo tarjetas con límite; la sin-límite excluida y anotada) · escala de color en los bordes (10% verde, 10.01% ámbar, 30% ámbar, 30.01% rojo) · sobreuso >100% sin romper · sin tarjetas con límite no hay bloque · suites verdes.
