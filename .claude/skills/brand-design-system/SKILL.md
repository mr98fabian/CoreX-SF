---
name: brand-design-system
description: Sistema de diseño y dirección de marca de KoreX (definido 2026-07-03). Úsalo SIEMPRE que se toque UI/UX — landing, dashboard, componentes, tailwind.config.js, estilos, animaciones, copy visual, o cuando se diseñe una pantalla/feature nueva. También cuando se pregunte "qué color/fuente/estilo usar" o se pida mantener consistencia visual. Contiene la paleta, tipografía, reglas de jerarquía y los principios de energía+confianza+lujo+calma+innovación que debe transmitir toda la app.
---

# Brand Design System — KoreX

Dirección de diseño definitiva acordada con el founder el 2026-07-03. No es una propuesta más: es la referencia única para cualquier decisión visual futura. Si una decisión de UI contradice esto, o se actualiza este skill primero, o se justifica explícitamente el porqué del cambio.

## Perfil de marca (el porqué detrás de cada regla)

- **Audiencia prioritaria**: profesionales de 20-35 años (sin excluir el rango 13-40+). Ante cualquier tensión de diseño, la decisión favorece a este segmento.
- **Ancla emocional**: energía/dinamismo. Los otros cuatro sentimientos (confianza, calma, lujo, innovación) son capas que sirven a la energía sin contradecirla — la confianza en particular es un **piso no-negociable**, no una capa más: sin ella no hay adopción en fintech, sin importar cuánta energía tenga el diseño.
- **Usuario**: ambos — principiante y sofisticado — mediante densidad progresiva (simple por defecto, detalle bajo demanda). Nunca dos apps distintas.

## Paleta (disciplina semántica estricta — cada color tiene UN trabajo)

| Token | Hex | Uso exclusivo |
|---|---|---|
| `canvas` | `#0A0E16` | Fondo base de toda la app. Negro-carbón frío, nunca `#000000` puro (se ve barato) |
| `surface-1` | `#141924` | Cards, paneles |
| `surface-2` | `#1C2230` | Modales, popovers, hover state |
| `text-primary` | `#F4F5F7` | Texto principal (nunca blanco puro) |
| `text-secondary` | `#9BA3B4` | Texto secundario |
| `ignition` (ANCLA) | `#FF5B3D` | CTA primario, estados activos, progreso de "ataque", streaks, contador de interés en vivo. Es el color que más aparece — así se siente la energía |
| `gold` | `#F5B942` / `#D4A017` | SOLO milestones, rank badges, tier Freedom. Prohibido usarlo en botones normales o UI cotidiana — su escasez es lo que lo hace sentir premium |
| `emerald` | `#10B981` | Dinero ahorrado, deuda reducida, deltas positivos |
| `rose/destructive` | (token `destructive` existente) | Alertas, deuda de alto interés, vencimientos — nunca confundir con `ignition` |

**Regla de oro literal**: si `gold` aparece más de una vez por pantalla, se está sobreusando y hay que reemplazarlo por `ignition` o `emerald` según corresponda.

## Tipografía

- **Hero/titulares/números grandes**: display grotesk confiada (Clash Display / General Sans) — reemplaza a Rajdhani como protagonista. Transmite energía + lujo + innovación a la vez.
- **Rajdhani**: no se elimina, baja de rango — úsala solo en chips técnicos, badges, etiquetas de datos (condimento, no base).
- **Cuerpo/UI**: Montserrat — legible de 13 a 40+ años, cálida, no intimida. Es la capa de calma/claridad.
- **Cifras de dinero**: JetBrains Mono con tabular figures — los números nunca cambian de ancho al actualizarse (señal de precisión = confianza).

## Jerarquía y espaciado

- Regla de 3: máximo 3 acciones visibles por sección, máximo 3 métricas hero por defecto en cualquier dashboard (ver [[velocity-domain]] para cuáles son las métricas correctas: fecha libre de deudas, total ahorrado, health score).
- Sistema de espaciado de 8px.
- Glassmorphism con moderación: blur sutil + borde 1px en superficies flotantes (modales, breakdown de cálculo) — nunca en toda la interfaz.
- Iconografía outline, un solo grosor de trazo, sin mezclar estilos.

## Motion — dos velocidades con significado

- Interacciones rutinarias (botones, toggles, navegación): <300ms — se sienten vivas y responsivas (energía).
- Celebraciones de milestone (deuda pagada, rank up, freedom alcanzada): 600-900ms con easing con rebote — deliberadamente más lentas, se sienten ceremoniales (lujo). Nunca uses la velocidad rápida para un logro real: lo devalúa.
- Contadores en vivo (interés acumulándose, ahorro proyectado): ticking continuo — es simultáneamente energía e innovación, y es el corazón del efecto "wow".

## UX — densidad progresiva

- Vista por defecto: simple, 3 números que importan.
- Toggle "ver detalle": despliega el desglose matemático completo para el usuario sofisticado.
- Toda cifra de dinero mostrada lleva su etiqueta de estimación — esto es simultáneamente una decisión de diseño y un requisito legal (ver [[legal-expert-usa]]). No se negocia.
- Consistencia total: un color siempre significa lo mismo en cualquier pantalla.

## El momento "wow" (primera impresión)

Receta validada para landing/onboarding: (1) el usuario ingresa 2-3 números sin fricción ni registro, (2) un contador grande en tipografía display cuenta en vivo el dinero que pierde ahora mismo en intereses, con color que transiciona rose → ignition → emerald al completarse la simulación, (3) esa cifra personalizada — no un ejemplo genérico — es lo primero que ve, antes que cualquier feature list. El "wow" viene de la personalización inmediata, no de la decoración.

## Homogeneidad — que NO se vea hecho con IA (auditado 2026-07-03)

El "look IA" no es un color concreto: es la **falta de restricciones compartidas** — cada componente inventa su propio tratamiento y el conjunto se siente forzado. Auditoría del dashboard real que motivó estas reglas: 11 familias de color conviviendo, 31 gradientes en 13 archivos, 16 emojis usados como íconos. Estas reglas existen para que eso no vuelva a pasar:

1. **Presupuesto de color por pantalla**: canvas + superficies + texto son gratis; además de eso, una pantalla puede usar `ignition` (interacción), `emerald`/`rose` (solo SOBRE datos: cifras, deltas, chart — nunca en contenedores, bordes o fondos de cards) y `gold` máximo una vez. Si un componente "necesita" otro color, está mal diseñado — no existe amber, cyan, purple, indigo ni violet en la app.
2. **Cero gradientes decorativos**: superficies planas + borde 1px. Un gradiente solo se permite si comunica dato (ej. barra de progreso de heat). El pill de nav activo, los botones y los bordes de modal son SIEMPRE planos.
3. **Cero emojis como íconos**: solo lucide-react, outline, un solo stroke-width en toda la app. Un emoji en la UI = bug visual.
4. **Un solo radio por rol**: 12px cards, 8px controles, 999px chips. Nada intermedio.
5. **Sentence case por defecto**: los titulares ALL-CAPS del hero de landing son la excepción ceremonial; dentro de la app, labels y headings van en sentence case. El grito constante es el segundo delator más fuerte del look IA (el primero son los gradientes).
6. **Glow/shadow con color: prohibido** salvo la celebración de milestone (600-900ms y desaparece). Nada tiene glow permanente.
7. **Los números son los protagonistas**: el contenedor más "callado" gana. Si una card compite en color con la cifra que contiene, la card pierde.
8. Test rápido antes de mergear UI: capturar la pantalla y preguntar "¿cuántos tratamientos visuales distintos hay aquí?" Si la respuesta es más de 3, no está homogéneo.

## Estado de implementación (2026-07-04)

Rediseño homogéneo APLICADO. **Dashboard verificado en vivo: 0 gradientes decorativos, 0 glows con color** (los dos delatores #1 del look-IA, eliminados por completo). Lint 0/0, build OK.

Archivos tocados:
- Tokens: `tailwind.config.js` (colores `ignition`/`gold`, fuentes `display: Space Grotesk`, `tech: Rajdhani`), `index.css` (`:root` y `.dark` con canvas #0A0E16), `index.html` (Google Fonts Space Grotesk + JetBrains Mono).
- `components/ui/button.tsx`: variant `premium` → `ignition` plano.
- `layouts/DashboardLayout.tsx`: nav activo = `ignition-soft` plano.
- Los 21 componentes de `features/dashboard/`.
- Componentes compartidos que renderizan sobre el dashboard: `CommanderBadge.tsx`, `InterestBleedBanner.tsx`, `UpgradeNudge.tsx`, `FeedbackWidget.tsx`, `features/strategy/components/MorningBriefing.tsx` y `RiskyOpportunity.tsx`.
- CTA legacy homogeneizado: el gradiente ámbar→naranja de "upgrade/ejecutar" ahora es `ignition` plano en todos estos componentes.

INTENCIONAL (no tocar):
- Gradiente de heat en `CashflowHeatCalendar.tsx` (rose→zinc→emerald) — codifica la escala de dato.
- El emoji del material de rank en `CommanderBadge` — es el emblema del logro, parte del sistema de datos del rank.

PENDIENTE (fuera del dashboard, para futuras pasadas — mismos patrones):
- `UpgradeModal.tsx`: modal de pricing con color por tier (velocity=ámbar, accelerator=morado, freedom=oro) — merece pasada propia de diseño de planes, solo aparece al hacer clic.
- Páginas aparte: `RankingsPage`, `SettingsPage`, `LoginPage`, `OnboardingWizard`, `features/error/*`, resto de `features/strategy/*`.
- Emojis restantes en el dashboard como íconos de categoría de gasto (☕🍽🚗) y semáforos de estado (🟢🟡🔴) — decisión de producto: reemplazar por lucide o conservarlos (patrón común en fintech). No delatan look-IA como los gradientes.

## Dónde vive esto en el código

- Tokens de color/tipografía: `frontend/tailwind.config.js` (sección `theme.extend.colors` / `fontFamily`) — actualizar ahí cuando se implemente.
- CSS variables HSL: buscar `:root` en el CSS global del frontend para los tokens `--primary`, `--background`, etc. que Tailwind consume.
- Cualquier nueva pantalla o componente debe leerse contra esta paleta y esta tipografía antes de introducir un color o fuente nueva.
