# Android-Gymlytics — proyecto separado

Fuente: copia del directorio `gymlog/` de la revisión 07, rama `feature/gymlog-01-04-registro-tabs-safearea`, commit `0da25c911df722d65b95300ae4a9e0463389204e`.

- `web/`: interfaz web que Capacitor usa para el aplicativo Android.
- `android/`: actualmente documentación; **no contiene una APK compilada**.
- `tests/`: verificaciones Node.
- `vite.config.js` y `capacitor.config.json`: configuración relativa al directorio del proyecto.
- Pruebas estáticas: `npm run test:static` ejecutado dentro de `Android-Gymlytics/`; no requiere Android SDK ni compilación.
- **No** ejecutar el workflow viejo `gymlog-android.yml` ni fusionar cambios en `main` hasta revisar sus disparadores y rutas.
- No se han probado inicio de sesión real, recuperación por URL HTTPS autorizada ni carga real de series desde APK.
