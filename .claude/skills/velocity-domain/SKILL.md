---
name: velocity-domain
description: Dominio financiero de KoreX — velocity banking, matemática de deudas y reglas de precisión. Úsalo SIEMPRE que se toque código en core_engine/, backend/velocity_engine.py, cálculos de intereses/amortización/payoff, el Attack Engine, Peace Shield, proyecciones del dashboard, o cuando se diseñe/revise cualquier feature que muestre cifras de dinero al usuario. También para explicar la estrategia velocity banking en contenido de marketing con precisión.
---

# Velocity Domain — Matemática Financiera de KoreX

KoreX calcula dinero real de usuarios reales. Un error de redondeo en una proyección de 30 años no es un bug menor: es un claim de marketing falso (ver skill legal-expert-usa) y una pérdida de confianza. Este skill define las reglas del dominio.

## La estrategia (para razonar y para escribir sobre ella)

**Velocity banking**: usar una línea de crédito (LOC) como cuenta operativa para hacer pagos grandes ("chunks") a deudas amortizadas, aprovechando que el interés de tarjetas/LOC se calcula sobre **average daily balance** mientras que el de préstamos amortizados se calcula sobre el principal restante. El income del usuario "aparca" en la LOC reduciendo el balance diario promedio.

**Condiciones sin las cuales la estrategia NO funciona** (el producto debe verificarlas, no asumirlas):
1. Cashflow mensual positivo — sin excedente, los chunks solo mueven deuda de un bolsillo a otro
2. Disciplina de gasto — la LOC liberada no se puede re-gastar
3. Spread de tasas favorable o neutro — chunk desde LOC al 22% para pagar préstamo al 6% pierde dinero salvo efecto cashflow específico; el motor debe calcularlo, no suponerlo

## Reglas de precisión (no negociables)

1. **`Decimal` siempre, `float` nunca** para dinero y tasas. Los módulos ya lo hacen (`from decimal import Decimal`); cualquier código nuevo que introduzca `float` en un cálculo monetario es un bug aunque los tests pasen.
2. **Cuantizar solo al presentar**: `.quantize(Decimal("0.01"))` al final de la cadena de cálculo, no en pasos intermedios (el error de redondeo se acumula en proyecciones multi-año).
3. **Tasas**: APR anual en porcentaje (`22.99`) → tasa mensual = `apr / 100 / 12`. Documentar en docstring qué convención usa cada función; mezclar convenciones es la fuente #1 de errores del dominio.
4. **Toda cifra mostrada al usuario es una estimación** y el frontend debe etiquetarla como tal (requisito legal, no estético).

## Dónde vive la matemática

- `core_engine/calculators.py` — funciones puras sin dependencias de DB (ej. `calculate_minimum_payment`). Aquí va la matemática nueva reutilizable.
- `backend/velocity_engine.py` — motor principal: `calculate_chunk_benefit`, `calculate_months_to_payoff`, `calculate_debt_free_date`, `calculate_total_interest`, `get_velocity_target`, `generate_action_plan`, `get_projections`, `get_peace_shield_status`, `simulate_freedom_path`, `detect_interest_rate_arbitrage`, `get_closing_day_intelligence`, entre otras.
- Regla de capas: routers HTTP no calculan; llaman al motor. Si un router tiene aritmética de dinero, es code smell.

## Edge cases que TODO cálculo nuevo debe manejar (y testear)

- Balance `0` o negativo (cuenta pagada / sobrepago)
- APR `0` (promos 0%) — divide-by-zero clásico en fórmulas de amortización
- `min_payment > balance` → pagar exactamente el balance
- `due_day`/`closing_day` 29–31 en meses cortos y febrero bisiesto
- Cashflow negativo → el Attack Engine debe degradar a modo defensivo (Peace Shield primero), nunca recomendar chunks
- Deudas sin fecha de vencimiento o datos incompletos de Plaid
- Proyecciones que nunca convergen (pago mínimo < interés mensual → deuda infinita): detectar y comunicar, no iterar para siempre — usar límite de iteraciones (patrón existente: cap de meses en `calculate_months_to_payoff`)

## Protocolo para cambios en el motor

1. Escribe primero el caso a mano: una deuda concreta con números redondos, resultado esperado calculado con calculadora. Ese caso se convierte en test.
2. Corre `cd backend && ./venv/Scripts/python.exe -m pytest` — los ~134 tests existentes son la red de seguridad; un cambio de fórmula que rompe tests viejos requiere justificar POR QUÉ el valor anterior era incorrecto (no ajustar el test al código).
3. Añade tests para los edge cases de la lista de arriba que apliquen.
4. Si el cambio altera cifras que el usuario ya ve (proyecciones, ahorros), anótalo en el PR: es un cambio de producto y de claim, no solo de código.
