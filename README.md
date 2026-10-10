# Android-GymLog — rama independiente

Rama `Android-GymLog`: solo contiene el proyecto `Android-GymLog/`, este README y el workflow de pruebas de Android.

- Carpeta de desarrollo: `Android-GymLog/`. Contiene interfaz, Capacitor, catálogos, autenticación, historial y pruebas de GymLog 01.04.
- Pruebas estáticas: `cd Android-GymLog && npm run test:static` (no compila APK).
- Aún no se ha probado una APK real, ni el inicio de sesión ni la recuperación del historial desde la app.
- Supabase Producción, cuentas, contraseñas e historiales quedan intactos. No enviar correos de recuperación automáticamente.
- La compilación de la APK permanece desautorizada hasta autorización expresa.

La rama de respaldo `feature/organizacion-web-android` conserva las dos carpetas juntas; aquí se separó el árbol de trabajo sin reescribir el historial Git.
