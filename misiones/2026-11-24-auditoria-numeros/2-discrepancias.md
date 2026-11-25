# Misión 14 · Entregable 2 — Lista de discrepancias

Reproducción: `evidencia/sonda_concordancia.py` (siembra SQLite en memoria y llama a las funciones reales
del motor, `today = 2026-11-24`). Salida completa: `evidencia/salida_sonda.json`. Los datos de la persona
«caso_real_anon_2026-11-24» salen de producción el 2026-11-24, **anonimizados** (montos escalados por un
factor no publicado, nombres genéricos; fechas, APR y reglas intactas).

Clases: **(a)** mismo nombre, distinta definición · **(b)** proyección sin reservar obligaciones ·
**(c)** redondeo o formato · **(d)** dato viejo o caché.

## Diagnóstico en una frase

KoreX tiene **dos motores de proyección que no se conocen**: el de **caja diaria** (misión + GPS:
`get_daily_mission` / `generate_action_plan`), que respeta obligaciones, escudo y fechas, y el **mensual**
(`simulate_freedom_path`), que trata el mes en curso como un mes entero sin importar qué día es y reparte
el excedente promedio completo sin mirar la caja. El Calendario, la fecha de libertad y «pagarás/ahorrarás»
leen del segundo; la misión y el GPS, del primero. Ningún test los compara entre sí.

---

## Caso #1 — 2026-11-24, explicado línea por línea

### Número 1 · Panel: deuda total **$35,410.63** — correcto
`routers/dashboard.py:50` → `sum(acc.balance for acc in active_debts)`.

| Deuda | Saldo |
|---|---|
| Auto | 19,156.25 |
| Préstamo personal | 11,416.12 |
| Tarjeta A | 2,883.81 |
| Tarjeta B | 1,476.88 |
| Tarjeta C | 364.49 |
| Tarjeta D | 73.86 |
| Tarjeta G | 39.22 |
| **Total** | **35,410.63** |

Concuerda con `/api/accounts`, `compare.deuda_hoy`, `projections.total_debt` y el día 1 del Calendario.

### Número 2 · Misión: ataque **$0**, «reservando **$6,014.24**»
`velocity_engine.py:2151` → `reserve = Σ obligaciones` de los próximos **35 días** (`MISSION_WINDOW_DAYS`,
hasta el 28-dic), calculadas en `mission_obligations` (`velocity_engine.py:2065`).

| Tipo | Cuenta | Monto | Pagar el | Regla (línea) |
|---|---|---|---|---|
| corte a $0 | Tarjeta B | 1,476.88 | 29-nov | saldo completo antes del corte del 1-dic (2110-2113) |
| corte a $0 | Tarjeta D | 73.86 | 29-nov | ídem |
| estado | Tarjeta A | 2,883.81 | 6-dic | tras el corte del 12-nov sin registro de corte: saldo completo (2096-2103) |
| corte a $0 | Tarjeta C | 364.49 | 6-dic | saldo completo antes del corte del 8-dic |
| préstamo | Auto | 801.40 | 11-dic | pago contractual (2085-2089) |
| préstamo | Préstamo personal | 413.80 | 20-dic | pago contractual |
| **Reserva** | | **6,014.24** | | |

- **Ataque $0**: `velocity_engine.py:2172` solo ataca si `liquid_cash > reserve`; 4,803.20 < 6,014.24.
- **De esos $6,014.24, solo $1,550.74 vencen en noviembre.** Los otros $4,463.50 son de diciembre.
- **El texto es de otra época**: «Reservando $6,014.24 para **pagos mínimos** próximos. La prioridad es
  sobrevivir **este mes**» (`routers/dashboard.py:138-143`). No son mínimos (son saldos completos y pagos
  contractuales) ni son de este mes.
- **Faltante que la misma respuesta entrega**: «Te faltan $797.24 para cubrir el pago del Auto del 11 de
  diciembre» = 5,600.44 acumulado − 4,803.20 de caja (`velocity_engine.py:2181-2190`). No cuenta los 3
  cheques de nómina ($8,437.50) que entran antes del 11-dic. El GPS, que es la misma misión proyectada día a
  día, no registra **ningún** faltante y su caja mínima es $1,413.80.

### Número 3 · Calendario: «DEBES ≈ **$27,743** · bajas ≈ **$7,668**»
`routers/strategy.py:118-121` → `daily_series(debts, velocity)` → `simulate_freedom_path`
(`velocity_engine.py:1309`). `velocity` = excedente mensual promedio = **$6,946.06**:

| Concepto | Monto | Fuente |
|---|---|---|
| Ingreso mensual promedio (2,812.50 × 52/12 + 625 + 430) | 13,242.50 | `monthly_surplus` (`velocity_engine.py:44`) |
| − Gastos recurrentes (sin duplicados de suscripción) | 3,062.50 | |
| − Suscripciones activas | 1,767.84 | |
| − Pagos de deuda (`plan_minimum`) | 1,466.10 | |
| **Excedente = aporte mensual del plan** | **6,946.06** | |

El simulador hace el «mes 0» = noviembre **completo** (`current_date = start.replace(day=1)`,
`velocity_engine.py:1346`):

| Deuda | + Interés del mes (1377) | − Mínimo (1382) | − Ataque (1397-1416) |
|---|---|---|---|
| Préstamo personal (32.30 %, objetivo) | 307.28 | 413.80 | **6,946.06** |
| Auto | 323.90 | 801.40 | 0 |
| Tarjeta A | 69.07 | 97.91 | 0 |
| Tarjeta B | 33.22 | 47.99 | 0 |
| Tarjeta C | 8.43 | 35.00 | 0 |
| Tarjeta D | 1.57 | 35.00 | 0 |
| Tarjeta G | 0.91 | 35.00 | 0 |
| **Totales** | **744.38** | **1,466.10** | **6,946.06** |

`35,410.63 + 744.38 − 1,466.10 − 6,946.06 = ` **`27,742.85`** · bajas `= 1,466.10 + 6,946.06 − 744.38 = ` **`7,667.78`**.
`DebtCalendar.tsx:118` pinta `mo.start − mo.end`.

**De dónde sale la baja fantasma (~$6,264):**

| Sumando fantasma | Monto | Por qué no existe |
|---|---|---|
| Excedente de los 4 días de pago ya pasados (1, 6, 13 y 20-nov) | 5,556.85 | Ese dinero ya se gastó o ya está en los $4,803.20; `daily_series` lo «aterriza» hoy (`velocity_engine.py:1494`) |
| Mínimos ya pagados este mes (Préstamo personal 20-nov, Auto 11-nov, Tarjeta A 6-nov, Tarjeta C 4-nov) | 1,348.11 | Los saldos de hoy ya los traen descontados; se cobran otra vez |
| Excedente del 27-nov atacando Préstamo personal | 1,389.21 | La misión dice ataque $0: ese dinero está reservado |
| Mínimos restantes (Tarjeta B, Tarjeta D, Tarjeta G) | 117.99 | El plan real no paga el mínimo: liquida Tarjeta B y Tarjeta D completas el 29 |
| Interés del mes completo | −744.38 | 23 días de interés ya están dentro del saldo |
| Lo real que sí baja (Tarjeta B 1,476.88 + Tarjeta D 73.86) | −1,550.74 | |
| Interés real de los 6 días restantes (24.47/día) | +146.83 | |
| **Diferencia: 34,006.72 (realista) − 27,742.85** | **6,263.87** | |

**Prueba de que el día no importa**: la sonda corre el mismo usuario con `today` = 1, 15, 24 y 30 de
noviembre y el Calendario dice «bajas ≈ $7,667.78» los cuatro días. El 30-nov promete bajar $7,668 en un día.

**El GPS ya tiene la respuesta correcta**: `generate_action_plan` con los mismos datos programa en
noviembre exactamente $1,550.74 (Tarjeta B y Tarjeta D el 29) y el primer ataque el 12-dic ($1,777.78 a
Préstamo personal). Cierre de noviembre por el GPS: **$33,859.89** (+ interés ≈ $34,007).

---

## Discrepancias — críticas

### N-01 · (b) El cierre de mes y las «bajas» del Calendario ignoran qué día es
- **Síntoma**: «bajas ≈ $7,668» igual el día 1 que el día 30. Baja fantasma de ~$6,264 el 24-nov.
- **Causa raíz**: `velocity_engine.py:1346` (mes 0 = mes calendario entero), `:1377` (interés de mes
  completo), `:1382` (mínimo de todas las deudas, pagadas o no), `:1397` (excedente promedio completo, sin
  mirar caja, escudo ni obligaciones). `daily_series` (`:1488-1495`) mueve a «hoy» todo lo fechado antes.
- **Superficies**: Calendario (héroe, banda de color, día en verde), hoja del día («Proyección»).
- **También en**: María demo (bajas $1,039.40 vs $2,300.00 que programa el GPS), dueño de invariantes
  (bajas $4,821.60 vs $0 programados).

### N-02 · (a) «Deuda de hoy» en el Calendario ≠ deuda total de Inicio
- **Síntoma**: la celda de hoy (24-nov) vale **$29,249.15**; Inicio dice **$35,410.63**. Los días 1-23
  muestran $35,410.63 (el saldo de hoy, no el histórico).
- **Causa raíz**: `velocity_engine.py:1494` (`day = max(day, floor)`) descuenta hoy $6,161.48 de eventos
  «pasados»; `lib/calendarSeries.ts:63` arrastra el punto del día 1 hasta hoy.
- **Regla violada**: deuda total en Inicio = Calendario-hoy (tolerancia $0.01).

### N-03 · (b) Fecha de libertad, «pagarás» y «ahorrarás» salen del motor que no reserva
- **Síntoma**: Plan dice libre el **2027-03-01** (5 «meses»), interés del plan $1,893.18, ahorro
  $20,378.05. Esa ruta paga solo el mínimo en las tarjetas (nunca corte a $0), no reserva nada, no respeta
  el escudo y asume `# We assume we have enough cash for minimums` (`velocity_engine.py:1369`).
- **Causa raíz**: la misma de N-01; `compare_paths` (`:274`) y `get_projections` (`:771`) heredan.
- **Superficies**: Inicio (gráfica y frase), Plan/GPS (`freedom_date_velocity`, `interest_saved`),
  command-center (`freedom_counter`), logros (`routers/coach.py:126-128`), modal de mejora y Ajustes
  (`usePlanSavings`), landing.
- **Contradicción interna**: `/api/strategy/tactical-gps` devuelve en una sola respuesta movimientos del
  motor de caja (dic: $9,897.33 a deuda) y fechas del motor mensual (dic: $8,417.41)
  (`routers/strategy.py:183-198`).

### N-04 · (a) «Reserva»: tres definiciones, dos en la misma respuesta
| Dónde | Valor (caso #1) | Qué es en realidad |
|---|---|---|
| `mision.reserva`, `reserved_for_bills` | 6,014.24 | obligaciones de 35 días a saldo completo |
| `safety_breakdown[0].amount` | 1,339.93 | punto más bajo de caja con mínimos **almacenados** (`calculate_safe_attack_equity`, `routers/dashboard.py:74`) |
| texto `justification` | «pagos mínimos próximos… este mes» | ninguna de las dos |
- **Causa raíz**: `routers/dashboard.py:74-77` conserva el cálculo viejo junto al nuevo (`:82-85`); el copy
  (`:132-145`) no se actualizó cuando la reserva cambió de definición.

### N-05 · (b, invertida) Inicio anuncia un faltante que el GPS desmiente → **decisión D1**
- **Síntoma**: Inicio: «Te faltan $797.24 para el Auto del 11-dic». GPS: cero faltantes, caja mínima
  $1,413.80. Dueño de invariantes: «Te faltan $405.07» y el GPS tampoco registra ninguno.
- **Causa raíz**: `velocity_engine.py:2172` y `:2181-2190` comparan la reserva de 35 días contra la caja
  **de hoy**, sin los ingresos fechados que entran antes de cada obligación. El GPS sí los cuenta porque
  avanza día a día.
- **Efecto**: ataque $0 y alarma aunque el plan sea viable; y a la inversa, la app no distingue «no me
  alcanza» de «todavía no me pagan».

### N-06 · (a) «Disponible para tu plan» no está disponible
- **Síntoma**: Inicio muestra «Disponible para tu plan: **$4,803.20**» (`features/home/HomePage.tsx:105`)
  mientras la misión dice ataque $0.
- **Tres «disponible»**: efectivo total 4,803.20 (`liquid_cash`, incluye el escudo de $1,000 y lo
  reservado) · sobrante seguro viejo 2,463.27 · ataque 0.00.

---

## Discrepancias — molestas

### N-07 · (a) «Mínimo»: el almacenado y el del motor conviven
- Tarjeta A: almacenado $71.26, `plan_minimum` $97.91. Tarjeta B: $31.25 vs $47.99.
- Usan el **almacenado**: brecha de interés de la misión (`velocity_engine.py:2158`), sobrante seguro
  (`:2165`, `:941`), `velocity_target.min_payment` (`routers/dashboard.py:128`, `:266`).
- Usan `plan_minimum`: Calendario (`helpers.py:451`), `/api/cashflow` (`routers/cashflow.py:49`), resumen
  mensual, simulador.

### N-08 · (a) «Lo que sale / entra al mes»: mes calendario vs promedio
| Concepto | Calendario | Reloj de dinero / Cuentas |
|---|---|---|
| Sale | «Te cobran este mes» **6,226.44** (`helpers.py:463`) | `outflow_monthly` **6,296.44** |
| Entra | **12,305.00** | `income_monthly` **13,242.50** |
- El Calendario suma eventos fechados del mes (4 viernes), excluye deudas sin fecha ($70.00) e incluye
  $4,751.36 que ya pasaron; el resumen promedia (52/12). Ambos válidos, pero se llaman igual.

### N-09 · (a/c) Interés por mes y por año: tres fórmulas
| Superficie | Mes | Año | Fórmula |
|---|---|---|---|
| Inicio | 744.30 | 8,931.55 | día redondeado × 365/12 · × 365 (`interest_periods`) |
| Simulador / Calendario | 744.38 | — | Σ saldo × APR/12 redondeado por deuda |
| Ajustes → Suscripción | 734.10 | 8,931.55 | día × **30** y × 365 **en el frontend** (`SettingsPage.tsx:933,938`) |
- El interés **diario** sí concuerda: motor 24.4724 = suma manual 24.4724.

### N-10 · (a) Pantallas que calculan por su cuenta
- `features/accounts/AccountsPage.tsx:269-271, 820`: interés diario por cuenta (`balance × APR / 100 / 365`).
- `features/actionplan/ActionPlanPage.tsx:397-402`: «ahorro diario», «mensual» (× 30) y «días acortados»
  (`pago / interés diario`) — métrica sin fuente en el motor. `:307-310`: totales del mes sumados en cliente.
- `features/attack/AttackPage.tsx:74`: recorta el monto recomendado con `Math.min` propio.
- `features/settings/SettingsPage.tsx:933,938`: ver N-09.

### N-11 · (a) «Meses» del plan cuenta el mes en curso
- María: `plan.meses = 15`; landing y `test_demo_persona.py` dicen 14 (diferencia de meses calendario).
  Caso real: 5 «meses» para marzo 2027, que está a 4.

### N-12 · (decisión D2) Corte a $0 sobre tarjetas con deuda que no se puede liquidar
- María (demo pública): la misión reserva **$18,400** (el 100 % de su deuda), anuncia «Te faltan $2,450»,
  el GPS lleva la caja a **−$685** y nunca ataca; el Plan dice 15 meses con $852.45/mes. La demo que ve el
  público se contradice a sí misma.
- **Origen**: regla de la casa «las tarjetas se matan completas / cortes a $0» aplicada a toda tarjeta con
  día de corte (`velocity_engine.py:2110-2113`). No se toca: se reporta.

### N-13 · Cifras públicas de la demo sin fuente
- La misión cita «plan $22,100 / $12,300» para la demo. Ninguna función produce esos valores con los datos
  de María: el motor da pagarás **$21,632.86** y ahorro **$30,176.05** (la landing fija 30,176). No hay
  rastro de 22,100 ni 12,300 en el repo. Deuda $18,400 y disponible $3,350 sí concuerdan.

### N-14 · (a) Aviso de corte (push/correo) vs corte de la misión
- Push: monto = saldo completo de toda tarjeta que corta en 2 días (`push_engine.py:176-180`). Misión: el
  corte reserva `saldo − mínimo de estado` y no existe si la tarjeta está en estado «estado»
  (`velocity_engine.py:2105-2113`). El push «misión» sí usa el monto de la misión.

---

## Discrepancias — pulido

### N-15 · Endpoints vivos con definiciones propias (ninguna pantalla los usa; sí quedan expuestos)
- `/api/cashflow/projection` (`routers/cashflow.py:137`): ingreso solo si `category == "income"`; los
  ingresos del caso tienen categoría «Ingreso» y se restan como gasto.
- `/api/notifications/summary` (`routers/notifications.py:92`): usa `account_type`, atributo inexistente.
- `/api/notifications/upcoming`: mes de 30 días, solo `day_of_month`.
- `/api/cashflow/summary` definido dos veces (`routers/cashflow.py:26` y `routers/strategy.py:313`); el
  segundo nunca responde.
- `/api/dashboard`: `next_payday` solo mira `day_of_month` (nómina semanal → 1-dic en vez del viernes 27,
  `routers/dashboard.py:101-116`); `chase_balance` exige tipo `checking` (la cuenta del caso es `cash` → 0).

### N-16 · (c) Año de interés derivado del día redondeado
- 24.47 × 365 = 8,931.55 vs 8,932.44 sin redondear. Decisión documentada («día × 7 = semana en pantalla»).

### N-17 · (d) Instantes distintos entre pantallas
- `useKxSummary`, comparación y calendario: `staleTime` 45 s; resumen mensual 30 s; memo del simulador 60 s
  (`velocity_engine.py:1267`). Todo se invalida junto tras un pago (`lib/planSync`). Sin incidencia en el
  caso #1: los tres números contradictorios se reproducen con datos del mismo instante.
- `lib/startingDebt.ts`: «deuda inicial» vive en `localStorage` por dispositivo; dos dispositivos pueden
  mostrar progresos distintos.

---

## Decisiones para Fabian (reglas de la casa; no se cambiaron)

- **D1 — ¿La reserva cuenta los ingresos fechados?** Hoy la misión reserva 35 días de obligaciones contra
  la caja de hoy (N-05). Opción recomendada: la obligación «falta» solo si la caja proyectada **en su
  fecha** (con ingresos y gastos fechados, escudo intacto) no la cubre — que es lo que ya hace el GPS.
- **D2 — ¿Corte a $0 para tarjetas que cargan deuda?** Para un usuario que no puede liquidar la tarjeta
  (María), la regla vuelve imposible toda misión (N-12). Opción recomendada: corte a $0 solo cuando la caja
  proyectada lo cubre; si no, mínimo + avalancha, y decirlo.
- **D3 — ¿Qué es «Disponible para tu plan»?** Efectivo total, o lo que la misión deja atacar (N-06).
- **D4 — ¿El plan a largo plazo ataca con el excedente promedio o con la caja real?** Hoy la fecha de
  libertad asume $6,946.06/mes desde el día 1 del mes en curso (N-03).
