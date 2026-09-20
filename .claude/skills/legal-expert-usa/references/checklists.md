# Checklists Legales Operativos — KoreX

Checklists accionables para auditorías y lanzamientos. Usarlos como rúbrica: revisar punto por punto y reportar ✅/⚠️/❌ con cita del archivo/pantalla concreta.

## 1. Auditoría de Terms of Service (`frontend/src/features/legal/TermsOfServicePage.tsx`)

- [ ] **Identificación de las partes** — nombre legal de la entidad (LLC vs persona física — si aún no hay LLC, flag 🔴)
- [ ] **Descripción del servicio** — "software tool for financial education and planning"; explícitamente NO advice, NO credit repair, NO debt adjusting
- [ ] **Disclaimer de asesoría** — financiero, legal y fiscal
- [ ] **Exactitud de cálculos** — estimaciones, no garantías; el usuario es responsable de verificar con sus instituciones
- [ ] **Términos de suscripción** — precios, ciclo de renovación, política de reembolso (alineada con lo que Lemon Squeezy ejecuta), método de cancelación
- [ ] **Cuentas y elegibilidad** — 18+, solo USA (o listar jurisdicciones), una cuenta por persona
- [ ] **Propiedad intelectual** — KoreX conserva el software; el usuario conserva sus datos
- [ ] **Datos de terceros (Plaid)** — el usuario autoriza el acceso read-only; referencia a la Plaid End User Privacy Policy
- [ ] **Limitación de responsabilidad** — cap a lo pagado en los últimos 12 meses (estándar SaaS)
- [ ] **Indemnización, garantías "AS IS"**
- [ ] **Arbitraje + class action waiver** — decisión de negocio: protege de class actions pero puede generar mass arbitration; documentar la decisión. Si se incluye: opt-out de 30 días lo hace más defendible
- [ ] **Ley aplicable y foro** — coherente con el estado de la LLC
- [ ] **Modificaciones** — notificación con 30 días para cambios materiales, no "cambios silenciosos"
- [ ] **Versionado** — fecha efectiva visible + registro en DB de qué versión aceptó cada usuario (clickwrap: checkbox no pre-marcado en signup)

## 2. Auditoría de Privacy Policy (`frontend/src/features/legal/PrivacyPolicyPage.tsx`)

- [ ] **Inventario de datos completo y VERAZ** — cuenta (email vía Supabase Auth), datos financieros ingresados manualmente, datos de Plaid (cuentas, balances, transacciones), datos de pago (procesados por Lemon Squeezy, no almacenados por KoreX), analytics, logs
- [ ] **Finalidades por categoría de dato**
- [ ] **Subprocesadores listados** — Supabase, Railway, Vercel, Plaid, Lemon Squeezy + cualquier analytics; cada nuevo vendor se añade aquí
- [ ] **NO venta de datos** — declararlo explícitamente (y cumplirlo)
- [ ] **Retención** — cuánto tiempo se guardan datos tras cerrar cuenta; los backups también cuentan
- [ ] **Borrado real** — el flujo "delete account" debe borrar en Supabase Y purgar en backups dentro de un plazo declarado
- [ ] **Derechos estatales** — sección CCPA/CPRA (acceso, borrado, corrección, no discriminación) aunque aún no se crucen los umbrales
- [ ] **Seguridad** — descripción honesta (encriptación en tránsito/reposo); NO prometer "bank-level security" si no está implementado
- [ ] **Brechas** — compromiso de notificación conforme a leyes estatales (los 50 estados tienen breach notification laws)
- [ ] **Menores** — servicio no dirigido a <18; sin knowingly collecting de <13 (COPPA)
- [ ] **Contacto** — email real monitoreado

## 3. Checklist de lanzamiento de feature nuevo

Antes de mergear cualquier feature que toque dinero, datos financieros o marketing:

1. ¿El feature **mueve dinero** o instruye pagos automáticos? → 🔴 STOP, revisar debt adjusting + money transmission
2. ¿Menciona o afecta **credit score**? → 🔴 STOP, CROA
3. ¿Muestra **proyecciones o cifras de ahorro**? → etiquetar como estimación + disclaimer + memoria de cálculo en el código (docstring con la fórmula)
4. ¿Recolecta **datos nuevos**? → actualizar Privacy Policy + Data Safety labels ANTES del release
5. ¿Añade **notificaciones/emails nuevos**? → ¿transaccional o marketing? Marketing → unsubscribe
6. ¿Cambia **precios o planes**? → actualizar ToS + pantalla de consentimiento + avisar a suscriptores existentes con antelación razonable (30 días típico)
7. ¿Usa lenguaje de **"advice"/"advisor"**? → reescribir a "insights/tools/estimates"
8. ¿La gamificación **premia comportamiento financieramente riesgoso**? → ajustar la mecánica

## 4. Checklist App Store / Google Play (app Capacitor)

- [ ] Data Safety (Google) / Privacy Nutrition Labels (Apple) llenados con el inventario REAL (incluye Plaid y analytics) — las discrepancias causan rechazos y son evidencia en casos FTC
- [ ] Decisión documentada: suscripciones vía IAP vs external purchase link (reglas US post-2025 ⚠️ verificar estado vigente en developer.apple.com)
- [ ] Google Play Financial Features declaration completada
- [ ] Screenshots sin claims prohibidos (la lista roja de marketing-claims.md aplica también a los stores)
- [ ] ToS y Privacy Policy accesibles desde dentro de la app sin login

## 5. Formación de empresa (orientación general — validar con CPA/abogado)

1. **LLC** en el estado de residencia del founder (más simple/barato) o Delaware (si habrá inversión VC). Para un solo founder sin inversores: estado de residencia suele ganar
2. **EIN** (gratis, irs.gov), cuenta bancaria separada, operating agreement (aunque sea single-member)
3. **Asignación de IP**: documento firmado transfiriendo el código de la persona física a la LLC; misma exigencia a cualquier contractor futuro (contractor agreement con IP assignment)
4. **Registered agent** en el estado de formación
5. **Foreign qualification**: normalmente NO necesaria por tener usuarios en otros estados (SaaS sin presencia física), pero verificar con CPA por nexo fiscal — Lemon Squeezy como MoR absorbe la mayor parte del problema de sales tax
6. Cuando haya tracción: **seguro E&O + Cyber liability** (los datos financieros lo justifican pronto)
7. Renombrar en ToS/Privacy de nombre personal a la LLC cuando exista

## 6. Respuesta a incidentes de datos (mínimo viable)

1. Contener (revocar tokens Plaid/Supabase comprometidos, rotar secrets)
2. Evaluar alcance: qué usuarios, qué datos, cuántos estados
3. Plazos: leyes estatales varían (30–90 días, algunas "without unreasonable delay"); FTC Safeguards Rule: notificar a FTC si ≥500 consumidores en 30 días
4. Notificar usuarios afectados con: qué pasó, qué datos, qué hacer, qué hace KoreX
5. Documentar todo (timeline, decisiones) — la documentación contemporánea es la mejor defensa
