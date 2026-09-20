# Mapa Regulatorio — KoreX (SaaS de gestión de deudas, USA)

Cada entrada: qué es la ley, cuándo aplica a KoreX, triggers de riesgo y mitigación. Ordenadas por relevancia para el producto.

---

## 1. FTC Act §5 — Unfair or Deceptive Acts or Practices (UDAP)

- **Qué es:** prohibición general de prácticas engañosas o injustas en comercio. La FTC la usa contra apps de finanzas personales por claims de ahorro exagerados, cancelaciones difíciles y dark patterns.
- **Cuándo aplica:** SIEMPRE. Es la ley base para todo el marketing, UX y billing de KoreX.
- **Triggers:** claims de ahorro no sustanciados, testimonios atípicos sin disclosure, flujos de cancelación con fricción, cargos sorpresa, urgencia falsa ("solo hoy").
- **Mitigación:** toda cifra mostrada debe derivar de los datos del usuario o de supuestos documentados; guardar la memoria de cálculo (sustanciación); cancelación en ≤ el mismo número de pasos que la suscripción.

## 2. Dodd-Frank §1031/1036 — UDAAP (CFPB)

- **Qué es:** versión ampliada de UDAP aplicada por el CFPB, añade "abusive": aprovecharse de la falta de entendimiento del consumidor o de su incapacidad de proteger sus intereses.
- **Cuándo aplica:** el CFPB supervisa a "covered persons" que ofrecen productos/servicios financieros de consumo. Una app de asesoría/gestión de deudas puede caer bajo su órbita ("providing financial advisory services" es actividad cubierta, 12 U.S.C. §5481(15)(A)(viii)).
- **Triggers:** presentar la estrategia como infalible; explotar sesgos (gamificación que empuja a usar la línea de crédito más de lo prudente); lenguaje que oculte riesgos del velocity banking (que REQUIERE disciplina y cashflow positivo).
- **Mitigación:** el producto debe mostrar también los riesgos de la estrategia (ej. advertencia cuando el cashflow del usuario es negativo — el Attack Engine no debe recomendar chunks agresivos en ese caso); tono educativo, no imperativo.

## 3. CROA — Credit Repair Organizations Act (15 U.S.C. §1679)

- **Qué es:** ley federal MUY estricta para cualquiera que, a cambio de dinero, ofrezca mejorar el historial, rating o record crediticio del consumidor. Impone contrato escrito, derecho de cancelación de 3 días, prohibición de cobro por adelantado, y da acción privada (demandas colectivas frecuentes).
- **Cuándo aplica a KoreX:** NO aplica mientras KoreX no prometa ni sugiera mejorar el credit score. CUIDADO: cortes han interpretado CROA de forma amplia — basta con *marketing* que implique mejora de crédito.
- **Triggers 🔴:** cualquier copy tipo "boost your credit score", "improve your credit", incluso en blog posts o testimonios; un feature de "credit score tracking" acompañado de consejos para subirlo.
- **Mitigación:** prohibición editorial total de lenguaje de mejora de crédito. Si un día se añade score tracking, que sea puramente informativo y con revisión legal previa.

## 4. Leyes estatales de Debt Adjusting / Debt Management / Debt Settlement

- **Qué es:** ~todos los estados regulan (y algunos prohíben a for-profits) el "debt adjusting": actuar como intermediario que negocia, recibe o distribuye dinero del deudor hacia acreedores. Requieren licencias, bonds, límites de fees.
- **Cuándo aplica:** NO aplica al modelo actual (software self-service; el usuario ejecuta sus pagos). Es LA línea roja estructural del producto.
- **Triggers 🔴:** feature de auto-pago a acreedores desde la app; "concierge" que llame a negociar tasas; recibir fondos del usuario para redistribuir.
- **Mitigación:** mantener el modelo "read-only + recomendaciones". Si se quiere bill-pay, hacerlo vía partner licenciado (ej. procesador con licencias de money transmission) y con opinión legal estado por estado.

## 5. Telemarketing Sales Rule — Debt Relief Amendments (16 CFR 310)

- **Qué es:** regula servicios de "debt relief" vendidos por teléfono: prohíbe fees por adelantado antes de resultados.
- **Cuándo aplica:** no aplica al SaaS self-service actual. Aplicaría si se añade venta telefónica de planes o coaching de alivio de deuda.
- **Mitigación:** si algún día hay sales calls o coaching 1:1 de pago, revisar TSR antes.

## 6. GLBA — Gramm-Leach-Bliley Act + FTC Safeguards Rule (16 CFR 314)

- **Qué es:** privacidad y seguridad de datos de instituciones financieras. La FTC interpreta "financial institution" ampliamente: incluye empresas "significantly engaged" en actividades financieras (asesoría financiera y credit counseling están listadas).
- **Cuándo aplica:** ZONA GRIS — una app de planificación de deudas con datos bancarios vía Plaid probablemente debería tratarse como cubierta por prudencia. La Safeguards Rule exige: programa de seguridad escrito, encriptación, MFA, gestión de acceso, plan de respuesta a incidentes, y (desde 2024) notificación a la FTC de brechas ≥500 consumidores en 30 días.
- **Triggers:** almacenar transacciones/balances de Plaid sin política de retención; credenciales o tokens sin encriptar; sin plan de incident response.
- **Mitigación:** documento de seguridad escrito (aunque sea de 3 páginas), tokens Plaid encriptados en reposo, retención mínima, designar responsable de seguridad (puede ser el founder), plan de respuesta a brechas.

## 7. ROSCA — Restore Online Shoppers' Confidence Act (15 U.S.C. §8401) + FTC Negative Option Rule + leyes estatales de auto-renewal

- **Qué es:** para suscripciones online con renovación automática: divulgación clara y conspicua de los términos ANTES de cobrar, consentimiento expreso informado, y mecanismo simple de cancelación. La "Click-to-Cancel Rule" federal de la FTC (2024) fue anulada por la corte de apelaciones en 2025 ⚠️ *(verificar estado actual — puede haber cambiado)*, pero ROSCA sigue vigente y estados como California (auto-renewal law, actualizada con AB 2863 efectiva 2025) exigen cancelación online tan fácil como la suscripción.
- **Cuándo aplica:** SIEMPRE — KoreX vende suscripciones (starter/velocity/accelerator/freedom, mensual/anual).
- **Triggers:** precio de renovación no visible en el checkout; trial que se convierte en pago sin aviso; cancelación que exige email o pasos ocultos; retention flows con más de una oferta antes de permitir cancelar.
- **Mitigación:** en la página de pricing y checkout mostrar precio de renovación + frecuencia + cómo cancelar; email de recordatorio antes de renovar anual; botón de cancelar visible en Settings que lleve al portal de Lemon Squeezy en ≤2 clics. LS como MoR maneja el cobro, pero la pantalla de consentimiento es de KoreX.

## 8. Privacidad estatal — CCPA/CPRA (California) y leyes similares (VA, CO, CT, TX, etc.)

- **Qué es:** derechos de acceso, borrado, portabilidad y opt-out de venta/compartición de datos personales.
- **Cuándo aplica:** CCPA tiene umbrales ($25M+ revenue anual, o 100k+ consumidores CA, o 50%+ ingresos por venta de datos). Probablemente KoreX aún no los cruza, PERO: (a) datos financieros son "sensitive personal information" bajo CPRA, (b) diseñar para cumplir desde ya es barato; retrofitting es caro. Nota: datos ya cubiertos por GLBA tienen exención parcial en CCPA.
- **Mitigación:** Privacy Policy con sección de derechos estatales; flujo de borrado de cuenta que realmente borre (Supabase + backups con TTL); no vender datos (y decirlo); registro de subprocesadores (Supabase, Railway, Vercel, Plaid, Lemon Squeezy, analytics).

## 9. ESIGN Act / UETA

- **Qué es:** validez de consentimientos y firmas electrónicas.
- **Cuándo aplica:** aceptación de ToS/Privacy al registrarse.
- **Mitigación:** checkbox no pre-marcado + timestamp + versión del documento aceptado guardada en DB (columna `tos_version_accepted` o similar). Clickwrap (checkbox explícito) es defendible; browsewrap ("al usar aceptas") NO lo es.

## 10. CAN-SPAM + TCPA

- **Qué es:** CAN-SPAM regula email comercial (unsubscribe funcional, dirección física, no headers engañosos). TCPA regula SMS/llamadas automatizadas (consentimiento expreso escrito para SMS de marketing; demandas de $500–$1,500 por mensaje).
- **Cuándo aplica:** emails de marketing y, si se añaden, notificaciones SMS.
- **Mitigación:** unsubscribe en todo email de marketing (los transaccionales están exentos); si algún día hay SMS, consentimiento explícito con disclosure y opt-out STOP.

## 11. Investment Advisers Act / reguladores estatales de "financial planners"

- **Qué es:** regula a quien asesora sobre *securities* a cambio de compensación.
- **Cuándo aplica:** NO aplica — deuda no es un security. PERO evitar autodenominarse "financial advisor" o dar consejos de inversión (ej. "invierte en X en vez de pagar deuda") porque algunos estados regulan el título y la actividad.
- **Mitigación:** vocabulario del producto: "herramienta", "estrategia", "calculadora", "educación" — nunca "advisor"/"advice" en sentido profesional. El nombre del feature "Smart Advice" merece revisión: preferible "Smart Insights" o disclaimer claro de que es output de software educativo.

## 12. App Stores (Apple App Review 3.1.1/3.2, Google Play Financial Services)

- **Qué es:** políticas privadas pero con efecto de ley práctica para la app Capacitor.
- **Puntos clave:** (a) Apple exige que apps con suscripciones compradas dentro de la app usen In-App Purchase — KoreX debe decidir si el checkout móvil redirige a web (reglas post-2025 sobre external purchase links en US lo permiten con condiciones ⚠️ *verificar estado actual*) o implementa IAP; (b) Google Play exige declaración de Financial Features para apps de "personal loans" y finanzas — revisar el formulario al publicar; (c) ambos exigen privacy labels/Data Safety exactos, incluyendo datos de Plaid.
- **Mitigación:** completar Data Safety/Privacy Nutrition Labels con inventario real de datos; documentar la decisión IAP vs web checkout antes del submission.

## 13. Estructura corporativa y protección del founder

- **Recomendación estándar** (no verificada contra tu situación específica): operar bajo LLC (Delaware o estado de residencia) antes de tener usuarios de pago significativos, para separar responsabilidad personal; contratar seguro E&O/cyber cuando haya tracción; asignar la IP del código a la empresa (importante si hubo colaboradores).
- **Triggers:** operar como sole proprietor con datos financieros de terceros = exposición personal ilimitada.
