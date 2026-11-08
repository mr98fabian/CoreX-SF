# MISIÓN — El interés diario: el número que cobra como renta

Estado: diseño en revisión (2026-11-08). No implementado.

## Idea

El motor ya calcula cuánto interés cobra la deuda del usuario CADA DÍA (`total_daily_interest` en el dashboard; `daily_cost` por deuda en el command center). Hoy ese número vive escondido. Esta misión lo vuelve protagonista: "tu deuda te cobra $X al día, como una renta".

## Alcance

- Inicio: bajo el héroe, una línea-bloque: "Hoy tu deuda te cobra $18.47" + en tenue "baja cada vez que una deuda muere". El número cuenta (MoneyCount) como los demás héroes. Selector de periodo: Día · Semana · Mes · Año en el mismo bloque; el valor se deriva del diario (×7 · ×365/12 · ×365) SIEMPRE etiquetado "al ritmo de hoy". El periodo elegido se recuerda (localStorage). Si no hay deudas o el interés diario es $0, el bloque no aparece (o celebra: "Tu deuda ya no te cobra nada al día" si tuvo deudas y llegó a $0).
- Plan de Ataque: sumar el costo diario por deuda en la misma línea técnica del APR ("32.30% · te cobra $8.37/día") usando el `daily_cost` que el command center ya devuelve — sin cálculos nuevos en el front.
- Landing: la persona María gana su línea de interés diario calculada por el motor con sus cuentas demo (fijada en el test de la persona): "Su deuda le cobraba $X cada día. Hoy: $Y." — inicio del plan vs hoy con el plan, etiquetados como ejemplo.
- Logros (backend): `GET /api/logros` suma `interes_diario` (valor de hoy, etiqueta "Interés que tu deuda te cobra cada día"), calculado de la misma fuente que el dashboard.

## Tests

El bloque aparece con interés > 0 y no aparece sin deudas · la línea del Plan muestra el daily_cost del command center (mock) · landing: la cifra de María coincide con el motor · logros incluye interes_diario coherente con el dashboard · suites verdes.
