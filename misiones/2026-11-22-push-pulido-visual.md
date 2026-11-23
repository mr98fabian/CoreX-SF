# Misión: Push — pulido visual de notificaciones (Android)
- **ID:** 2026-11-22-push-pulido-visual
- **Estado:** completada
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
- **Fecha:** 2026-11-22
- **Rama y commit:** `feat/push-en-y-pulido`, commit 0cb73c4 (el Reporte va en el commit de cabeza).
  Build Android nuevo: **1.0.9 (versionCode 10)**, APK debug firmado con `~/.android/debug.keystore`.
- **Qué se hizo:**
  1. **Ícono:** `res/drawable/ic_stat_korex.xml`, la marca K de `public/korex-isotipo.svg` en silueta
     blanca (vector, con margen), declarado como `default_notification_icon` de FCM.
  2. **Color:** `@color/korex_amber` = **#F59E0B** como `default_notification_color`.
  3. **Texto expandible:** no hizo falta código. El SDK de FCM (firebase-messaging 25.0.1,
     `CommonNotificationBuilder`) ya aplica `BigTextStyle` al cuerpo de los avisos con `notification`,
     que son los que manda el motor (verificado en el bytecode de la librería).
  4. **Canal:** `korex_avisos`, «Avisos de KoreX», con la descripción «Cortes de tarjeta, tu misión del
     día y deudas saldadas.» e importancia alta. Lo crea `MainActivity` en cada arranque; es
     declarado `default_notification_channel_id`, y el motor lo pide explícito
     (`android.notification.channel_id`). Ningún texto ni regla del motor cambió.
- **Verificaciones corridas y resultado:**
  - En el emulador (API 36.1, Google Play) con el APK 1.0.9: el canal existe con
    `mImportance=4` (alta), `mLightColor=-680437` (= #F59E0B) y nombre «Avisos de KoreX» (`dumpsys
    notification`). El teléfono obtuvo un token FCM real del proyecto `corex-financial`.
  - vitest **331 passed**, `npm run build` OK, `eslint` OK, pytest **622 passed**.
- **Desviaciones o dudas:**
  - **Prueba real con capturas: NO completada.** Envié el aviso de prueba («Corte en 2 días») desde la
    consola de Firebase («Enviar mensaje de prueba») al token del emulador, varias veces. La consola lo
    aceptó, pero el aviso nunca llegó: Google Play services del emulador no registró ningún mensaje
    entrante, aunque estaba conectado a `mtalk.google.com`. Sin las credenciales del servidor
    (`FIREBASE_SERVICE_ACCOUNT_JSON`, solo en Railway) no hay otra vía de envío real, y la imagen
    Google Play no permite `adb root` para inyectarlo. **Faltan las capturas colapsada y expandida.**
    Propuesta: instalar el APK 1.0.9 en un teléfono físico y repetir el envío de prueba desde la
    consola.
  - El nombre del canal va en español también para usuarios en inglés, como pide la misión. Se
    podría añadir `values-en/strings.xml` si se quiere.
  - **Decisión de Fabian (2026-11-22):** se acepta la misión sin las capturas reales; la prueba en
    teléfono físico queda pendiente fuera de esta misión.
