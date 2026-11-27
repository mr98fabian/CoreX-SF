---
name: release-android
description: Checklist para sacar una versión nueva de la app Android de KoreX (Capacitor). Úsalo SIEMPRE que se suba versionCode o versionName, se genere un APK o AAB, se publique un release en GitHub, se toque `frontend/public/apk.json` o `frontend/android/app/build.gradle`, o Fabian diga "saca versión", "sube el APK", "nueva build para Play" o "el banner de actualización no aparece".
---

# Release Android

Hay **dos canales** y cada uno lee la versión de un sitio distinto. Casi todos los fallos de
release vienen de actualizar uno y olvidar el otro.

| Canal | Qué lee | Archivo |
|---|---|---|
| Google Play (AAB firmado) | `versionCode` / `versionName` | `frontend/android/app/build.gradle` |
| APK directo (banner "Actualizar a v…" en la app) | `version_code`, `version_name`, `apk_url`, `notas` | `frontend/public/apk.json` |

El banner compara el `version_code` de `apk.json` con el de la app instalada: si `apk.json`
no sube, nadie con APK directo se entera de la versión nueva.

## Pasos

1. **Decidir el canal** con Fabian antes de tocar nada: ¿Play, APK directo o ambos?
2. **Subir versión** en `build.gradle`: `versionCode` +1 (entero, nunca se repite ni baja;
   Play rechaza un código ya usado) y `versionName` semver.
   Commit: `chore(android): versión X.Y.Z (versionCode N)`
3. **Build web y sync:** `npm run build` en `frontend/` y luego `npx cap sync android`.
   Sin esto el APK empaqueta el `dist` viejo.
4. **Compilar** el AAB (Play) o el APK (directo). La firma usa `keystore.properties` local.
5. **Solo APK directo:** publicar el release `vX.Y.Z` en GitHub con `korex.apk` y **después**
   actualizar `apk.json` (los cuatro campos; `notas` en español, tono de producto).
   Commit: `chore(apk): apk.json points to the vX.Y.Z release (versionCode N)`
   El orden importa: si `apk.json` llega antes que el release, el banner apunta a un 404.
6. **Verificar:** abrir la `apk_url` y confirmar que descarga; `version_code` de `apk.json`
   coincide con el del APK publicado.

## Nunca al repo

`*.jks`, `*.keystore`, `keystore.properties` y `google-services.json` están en `.gitignore`.
Antes del commit: `git status --short` y comprobar que ninguno aparece. Si la firma o Firebase
piden una contraseña o llave, se para y la pone Fabian.

## Confirmar antes de actuar

Publicar un release en GitHub y subir un AAB a Play son acciones públicas y difíciles de
deshacer: se confirma con Fabian cada vez, aunque ya haya aprobado un release anterior.

## Desfase conocido (27 nov 2026)

`build.gradle` está en 1.0.9 (versionCode 10) y `apk.json` en 1.0.6 (version_code 7).
Puede ser intencional (las últimas versiones salieron solo por Play); preguntar antes de
"arreglarlo".
