# Misión: Push — pulido visual de notificaciones (Android)
- **ID:** 2026-11-22-push-pulido-visual
- **Estado:** en-curso
- **Rama:** feat/push-en-y-pulido
- **Repo:** CoreX-SF
## Objetivo
Que las notificaciones push de Android se vean elegantes y profesionales, con la marca.
## Contexto
En la auditoría se verificó el funcionamiento del push, NO su acabado visual. Pedido de Fabian
(2026-11-22): que se vean elegantes y profesionales. Misma rama que la misión 2
(`2026-11-22-push-plantillas-en`).
## Pasos
1. **Ícono** de notificación en silueta blanca de la marca (mapache o marca K) como
   `default_notification_icon` de FCM, con su drawable — no el genérico de Android.
2. **Color de acento** `default_notification_color` = ámbar de marca **#F59E0B**.
3. **Texto expandible** (BigText o equivalente en la ruta Capacitor/FCM) para leer el cuerpo
   completo al expandir.
4. **Canal**: nombre y descripción en español ("Avisos de KoreX"), importancia alta.
5. **Prueba real**: notificación de prueba en dispositivo/emulador con el build nuevo y capturas
   (colapsada y expandida) en el Reporte.
## Criterios de aceptación
- [ ] Capturas reales en el Reporte (colapsada y expandida).
- [ ] Sin cambios en reglas del motor (disparadores, topes, horarios) ni en los textos.
- [ ] vitest + build en verde; si hay build Android nuevo, indicar la versión.
## No tocar
- Nada de iOS. Nada de Google Play Billing/RTDN ni de Stripe.
## Reporte (lo llena Claude al ejecutar)
- **Fecha:**
- **Rama y commit:**
- **Verificaciones corridas y resultado:**
- **Desviaciones o dudas:**
