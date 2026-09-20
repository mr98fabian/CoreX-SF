# 🔄 HANDOFF — KoreX Diseño UI/UX Optimización

> **Sesión origen:** 2026-08-10  
> **Tarea:** Investigación multidioma de diseño fintech + análisis frontend + recomendaciones  
> **Estado al cierre:** Investigación COMPLETA. Implementación NO iniciada.  
> **Próxima sesión debe empezar por:** Fase 1 — Limpieza de Confianza

---

## 📌 ESTADO ACTUAL (Resumen Ejecutivo)

### ✅ Hecho en esta sesión
- [x] Limpieza/optimización del backend (143MB+ liberados, 1036 líneas compactadas)
- [x] Investigación multidioma de diseño fintech premium (EN / ES / JP / CN)
- [x] Análisis de 6 archivos frontend clave
- [x] Informe completo escrito: `docs/informe-diseno-multidioma-korex.md`

### ⏳ Pendiente (NO iniciado)
- [x] Fase 1: Confianza ✅ 2026-08-10 — 1.1 emojis → Lucide · 1.2 refs GTA VI · 1.3 tono bélico suavizado · 1.4 modales 9 → 2 (InstallPrompt y SessionTimeoutWarning ahora son toasts; InterestBleedBanner y OnboardingResumePopup son inline en DashboardPage; DemoWelcomeModal fusionado en el wizard y archivo eliminado; FeedbackWidget sin nagging; OfflineIndicator sin cambios)
- [x] Fase 2: Claridad ✅ 2026-08-10 — 2.1 progressive disclosure (CollapsibleSection: Nivel 1 siempre visible, Nivel 2 "Análisis y actividad" default open, Nivel 3 "Progreso y logros" default closed, estado persistido en localStorage) · 2.2 greeting compacto 1 línea (quote eliminada) · 2.3 paleta semántica unificada en tailwind.config (success/danger/warning/premium/info) · 2.4 componente MoneyAmount + font-mono global en AnimatedCurrency · 2.5 elevación light mode (tokens --cx-surface-0..3, --cx-shadow-card/elevated, glass-card sin shadow-xl)
- [ ] Fase 3: Sofisticación — Glassmorphism, microinteracciones, polish

---

## 🎯 PRÓXIMO PASO: FASE 1 — CONFIANZA

**Objetivo:** *Parecer un banco, no un juego.*  
**Impacto:** Alto | **Complejidad:** Baja-Media | **Tiempo estimado:** 2-4 horas

### Tarea 1.1 — Eliminar emojis (⭐ Baja, ~15 min)
**Archivo:** `frontend/src/features/landing/LandingPage.tsx` (líneas ~69-100, objeto `copy.solution.features`)

Reemplazar emojis por iconos Lucide:
```
⚔️ → Sword o Target o Zap (de lucide-react)
🛡️ → Shield (ya existe en lucide-react)
📊 → BarChart3 o TrendingUp
🎖️ → Award o Medal o Crown (ya usas Crown en dashboard)
💡 → Lightbulb (lucide-react)
```

### Tarea 1.2 — Eliminar referencia a GTA VI (⭐ Baja, ~5 min)
**Archivo:** `frontend/src/features/landing/LandingPage.tsx` (línea 1-12, docstring/comentario)

Cambiar:
```
"LandingPage — GTA VI Cinematic Edition"
"Inspired by rockstargames.com/VI"
```
Por algo profesional como:
```
"LandingPage — Premium Fintech Experience"
"Inspired by modern fintech: Revolut, N26, Stripe"
```

### Tarea 1.3 — Suavizar tono "bélico" en copy (⭐⭐ Media, ~30 min)
**Archivo:** `frontend/src/features/landing/LandingPage.tsx` (objeto `copy`)

Cambiar frases como:
- "The weapon banks don't want you to have" → "The strategy banks hope you never discover"
- "Attack Engine" → "Velocity Optimizer" o "Debt Accelerator"
- "Turn The Banks' Math Against Them" → "Use the Same Math, For Your Benefit"

### Tarea 1.4 — Reducir modales de 9 a 2 (⭐⭐ Media, ~1 hora)
**Archivo:** `frontend/src/layouts/DashboardLayout.tsx` (líneas 223-228)

**Mantener (máx 2):**
1. `OnboardingWizard` (solo primera vez)
2. `UpgradeNudge` (con frecuencia controlada)

**Convertir a inline/banners:**
- `FeedbackWidget` → Footer banner o slide-in
- `InterestBleedBanner` → Inline banner en dashboard
- `InstallPrompt` → Toast notification
- `OfflineIndicator` → Top bar indicator (ya es sutil)
- `SessionTimeoutWarning` → Toast
- `OnboardingResumePopup` → Inline card en dashboard
- `DemoWelcomeModal` → Primera pantalla del onboarding

---

## 📁 ARCHIVOS CLAVE (Rutas exactas)

| Archivo | Líneas | Rol | Estado |
|---------|--------|-----|--------|
| `frontend/src/features/landing/LandingPage.tsx` | 853 | Landing page | 🔴 Necesita cambios |
| `frontend/src/layouts/DashboardLayout.tsx` | 257 | Layout sidebar/topbar | 🟡 Necesita cambios |
| `frontend/src/features/dashboard/DashboardPage.tsx` | 733 | Dashboard principal | 🟡 Necesita cambios |
| `frontend/src/index.css` | 182 | Variables CSS globales | 🟢 Base buena, refinar |
| `frontend/tailwind.config.js` | 119 | Config Tailwind | 🟢 Base buena, refinar |
| `frontend/src/contexts/ThemeContext.tsx` | 53 | Tema dark/light | 🟢 OK |

**Ruta base del proyecto:** `C:\Users\Khine\Desktop\Workspace\Proyectos_Software\KoreX`

---

## 📋 DECISIONES TOMADAS (No revertir sin consultar)

1. **NO tocar código en esta sesión** — Solo investigación y recomendaciones.
2. **Paleta de colores propuesta:** Negro/Blanco (primary), Ignition #FF5B3D (CTAs), Emerald (positivo), Rose (negativo), Amber (warning), Gold (premium).
3. **Tono de marca:** Pivotear de "guerrero/ataque" a "estratega/optimización" para mayor confianza.
4. **Dashboard:** Implementar progressive disclosure (4-5 widgets visibles + tabs/secciones).

---

## 📖 DOCUMENTOS DE REFERENCIA

| Documento | Ubicación | Contenido |
|-----------|-----------|-----------|
| Informe completo | `docs/informe-diseno-multidioma-korex.md` | Análisis detallado, hallazgos por región, recomendaciones |
| Este handoff | `docs/HANDOFF.md` | Estado, próximos pasos, rutas de archivos |

---

## ⚠️ ADVERTENCIAS / TRAMPAS

1. **Los emojis están hardcodeados** en el objeto `copy` de LandingPage.tsx. Buscar el array `features` dentro de `copy.solution`.
2. **El docstring GTA VI** está en las primeras 12 líneas del archivo. Cambiar el comentario NO afecta funcionalidad.
3. **Los modales** en DashboardLayout se renderizan todos al final del componente (líneas ~223). No eliminarlos, solo moverlos a componentes inline.
4. **No cambiar la lógica de negocio** — solo UI/copy/estructura visual.
5. **El tema dark mode funciona bien** — no romper lo que ya está en `index.css`.

---

## 💡 SUGERENCIA PARA LA SIGUIENTE SESIÓN

Abrir con este prompt al siguiente agente:

```
Continuar con el proyecto KoreX. El estado actual está documentado en:
- docs/HANDOFF.md (este archivo — estado y próximos pasos)
- docs/informe-diseno-multidioma-korex.md (investigación completa)

Empezar por Fase 1 — Tarea 1.1: Eliminar emojis de LandingPage.tsx.
Los emojis están en el objeto copy.solution.features (líneas ~69-100).
Reemplazar por iconos de lucide-react.

Ruta del proyecto: C:\Users\Khine\Desktop\Workspace\Proyectos_Software\KoreX
```

---

*Documento generado automáticamente al cerrar sesión. Última actualización: 2026-08-10*
