# Entregable 2 — Prompts Listos para Usar

> Copiables tal cual en Claude Code. Los que empiezan con `/` invocan un skill directamente; los demás activan skills por descripción. Sustituye los `[corchetes]`.

## A. Investigación

**A1. Investigación de decisión técnica**
```
/deep-research Necesito decidir entre [opción A] y [opción B] para [contexto en KoreX].
La decisión depende de: [criterio 1], [criterio 2], costo. Investiga con fuentes de 2025-2026,
etiqueta cada hallazgo por confianza y termina con recomendación.
```

**A2. Due diligence de vendor/API**
```
/deep-research Due diligence de [vendor]: pricing real a nuestra escala (~[N] usuarios),
límites de la API, historial de incidentes/brechas, qué dicen usuarios en producción,
y compliance (SOC2, GLBA si aplica). Marca qué no puedas verificar.
```

**A3. Vigilancia regulatoria (para correr mensualmente)**
```
/deep-research ¿Hubo cambios en los últimos 60 días en: FTC Negative Option Rule / click-to-cancel,
leyes estatales de auto-renewal, reglas de la CFPB sobre apps de finanzas personales,
o políticas de Apple/Google para apps financieras? Solo fuentes oficiales o prensa legal seria.
Luego pasa los hallazgos por /legal-expert-usa para evaluar impacto en KoreX.
```

## B. Análisis y evaluación

**B1. Red team de una decisión**
```
/critical-evaluator Evalúa esta propuesta: [pegar propuesta o ruta del doc].
Contexto: [por qué se propone]. Sé especialmente duro con los supuestos financieros
y los edge cases de usuario. Necesito veredicto para decidir esta semana.
```

**B2. Pre-mortem de feature**
```
/critical-evaluator Vamos a lanzar [feature]. Haz un pre-mortem: es [fecha+6 meses] y el feature
fracasó/causó un problema serio. ¿Cuáles son las 5 causas más probables, con qué severidad,
y qué mitigación barata elimina cada una hoy?
```

**B3. Auditoría del motor financiero**
```
/velocity-domain Audita [función o archivo] contra las reglas del dominio: precisión Decimal,
convención de tasas, edge cases de la lista obligatoria. Recalcula a mano un caso concreto
y compáralo con lo que devuelve el código.
```

## C. Legal y compliance

**C1. Revisión de copy antes de publicar**
```
/legal-expert-usa Revisa este copy para [landing/email/ad/App Store]:
"[pegar texto]"
Clasifica cada frase problemática (🔴🟡🟢), dame el texto alternativo exacto
y los disclaimers que falten, listos para pegar.
```

**C2. Auditoría completa de documentos legales**
```
/legal-expert-usa Audita TermsOfServicePage.tsx y PrivacyPolicyPage.tsx contra tus checklists.
Reporta cada punto como ✅/⚠️/❌ con la cita del texto actual, y redacta las cláusulas
faltantes más críticas. Prioriza lo que bloquearía el lanzamiento en App Store.
```

**C3. Análisis legal de feature nuevo**
```
/legal-expert-usa Queremos añadir [feature, ej. "auto-pago de la tarjeta desde la app"].
Corre el checklist de lanzamiento: ¿qué leyes se activan, qué riesgo tiene, qué versión
del feature logra el 80% del valor con riesgo 🟢?
```

**C4. Preparar consulta con abogado real (ahorra horas facturables)**
```
/legal-expert-usa Prepara un memo para un abogado licenciado: contexto de KoreX en 1 párrafo,
las 5 preguntas legales abiertas más importantes ordenadas por riesgo, y nuestros hechos
relevantes para cada una. Formato: /executive-synthesis. Luego genera el .docx.
```

## D. Creación de contenido

**D1. Contenido educativo con base verificada**
```
/deep-research Verifica estas afirmaciones para un artículo sobre velocity banking: [lista].
Después escribe el artículo con copy-master (tono: educativo, no promesas),
valida claims con /legal-expert-usa y entrégame la versión final + lista de fuentes.
```

**D2. Informe ejecutivo desde una sesión larga**
```
/executive-synthesis Cierra esta sesión: qué se hizo (verificado vs pendiente),
decisiones tomadas y por qué, y próximos pasos con el comando o archivo exacto para retomar.
```

**D3. Comparativa para decidir**
```
/executive-synthesis A partir de [investigación/doc], dame la tabla comparativa ponderada
de las opciones, la recomendación, y qué evidencia te haría cambiarla. Una página.
```

## E. Cadenas completas (los prompts más potentes)

**E1. Pipeline decisión mayor**
```
Vamos a decidir [decisión]. Ejecuta en secuencia:
1) /deep-research con los criterios: [criterios]
2) /critical-evaluator sobre la opción ganadora preliminar
3) /executive-synthesis con la recomendación final
Entrega solo el resultado de (3) con anexos de (1) y (2) al final.
```

**E2. Pipeline lanzamiento de feature con dinero**
```
Feature: [descripción]. Ejecuta:
1) /velocity-domain — reglas de dominio y edge cases que aplican
2) Implementación
3) /qa-tester — casos de prueba incluyendo los edge cases de (1)
4) /legal-expert-usa — checklist de lanzamiento + revisión del copy de la UI
5) /deployment-validator
No avances de paso si el anterior tiene un 🔴 sin resolver.
```

**E3. Pipeline contenido de marketing**
```
Pieza: [tipo] sobre [tema]. Ejecuta:
1) /deep-research — verifica los datos que usaremos
2) copy-master + neuromarketing — redacción persuasiva
3) /legal-expert-usa — revisión de claims (tabla roja/verde)
4) Versión final incorporando (3) sin perder la fuerza de (2)
```

## F. Plantilla de system prompt (para usar KoreX-Claude vía API)

Para scripts propios contra la API de Anthropic (ej. generación de contenido en batch), este system prompt condensa los modos:

```
Eres el asistente principal de KoreX, un SaaS de eliminación de deudas (velocity banking) en USA.
Reglas permanentes:
- Dinero y tasas siempre en Decimal; toda cifra mostrada es "estimate".
- Prohibido: "guaranteed", "eliminate your debt", cualquier mención de mejorar credit score,
  "financial advisor". El producto es una herramienta educativa de software.
- Afirmaciones de hecho llevan etiqueta: Verificado / Probable / No verificado.
- Todo output largo termina con TL;DR de 3 líneas y próximos pasos.
[+ pega aquí el SKILL.md del modo que corresponda]
```
