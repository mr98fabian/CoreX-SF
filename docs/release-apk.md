# Release del APK (Android, fuera de Play Store)

La app nativa **empaqueta `frontend/dist` dentro del APK** (`capacitor.config.ts` no tiene `server.url`).
Por tanto **cualquier cambio de la interfaz llega al móvil solo con un APK nuevo**, no con el deploy web.
El avisador (`useApkUpdate` + `ApkUpdateBanner`) lee `https://korexf.com/apk.json` y ofrece la versión
nueva; Android exige que el usuario confirme la instalación con un toque.

## Checklist

1. Subir `versionCode` (+1, entero) y `versionName` en `frontend/android/app/build.gradle`.
2. `cd frontend && npm run build && npx cap sync android`
3. Compilar el APK firmado (Android Studio → Build → Generate Signed APK, o `./gradlew assembleRelease`).
4. Subirlo a una GitHub Release del repo (tag `apk-v<versionName>`).
5. Actualizar `frontend/public/apk.json`: `version_code` = el nuevo versionCode, `version_name`,
   `apk_url` = enlace **https** directo al `.apk` de la Release, `notas` opcional.
   Con `apk_url` vacío o sin https la app no muestra nada.
6. Desplegar la web (merge a main → Vercel). `vercel.json` sirve `apk.json` sin caché y con CORS.

El orden importa: si se publica `apk.json` antes de que exista el APK, la app ofrece un enlace roto.

## ⚠️ La clave de firma

Todas las releases se firman con **la misma keystore**. Si la clave cambia, Android rechaza la
actualización ("conflicto de paquete") y toca desinstalar y reinstalar desde cero (se pierden los datos
locales: PIN/huella, preferencias). Guarda la keystore y sus contraseñas fuera del repo, con copia de seguridad.
No commitear nunca la keystore ni `key.properties`.
