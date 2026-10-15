# Gymlytics 01.06 · Bloque 1: sincronización local y nube

**Ámbito:** solamente rama `apk/pruebas`, backend `ProyectosPrueba` (`jasuqnxrskhqfobsazwd`), esquema `sch_android_gymlytics`. **No está compilado en APK ni fusionado con Android-Gymlytics ni main.**

## Funcionalidades disponibles en código
- App accesible offline sin login. La pestaña **Perfil** administra usuarios del dispositivo.
- Cada perfil tiene su propio almacenamiento IndexedDB, operaciones pendientes, borrados irreversibles locales y copias de seguridad.
- Cuenta en la nube opcional: registro autónomo posterior a verificación de correo; la función `asegurar_perfil_gymlytics` crea solo la cuenta de Gymlytics y nunca reactiva una cuenta deshabilitada.
- Vinculación de un perfil local a una sola cuenta y bloqueo de la misma cuenta en otro perfil del dispositivo.
- Subida **manual** de altas, ediciones y borrados de series en lotes de hasta 50, con UUID de operación permanente.
- Subidas protegidas por comparación `expected_version`; el RPC devuelve conflictos y reintentos idempotentes. Ninguna edición conflictiva se aplica de manera implícita.
- Descarga **manual** y completa de series históricas (vista `vw_historial_series`) y del espejo versionado (`tbl_sync_series`), con unión por identificador y lápidas.
- Si ocurre un conflicto, el usuario debe escoger **conservar local** (generar operación nueva) o **usar nube** (descartar cambios locales tras confirmar).
- Se preservan originales `tbl_reportes` y `tbl_series`. La nueva sincronización usa un espejo privado para no reescribir registros de versiones anteriores.

## Limitaciones conocidas y pendientes
1. **Compatibilidad web anterior:** la interfaz web antigua y cualquier APK anterior que no consulten `tbl_sync_series` todavía no reflejan modificaciones y eliminaciones del espejo. Las versiones compatibles con 01.06 sí pueden resolver conflictos entre sí. Se necesita adaptar los otros clientes o sincronizar el modelo canónico sin tocar historiales originales.
2. **Catálogos y fotografías:** los cambios locales se mantienen como operaciones pendientes, pero todavía no se envían. No mostrar estos cambios como sincronizados.
3. **Conflictos con modificaciones de versiones antiguas:** una escritura directa al historial legado, realizada por un cliente no actualizado, no incrementa la versión del espejo. No prometer detección de todos esos conflictos.
4. **Primera instalación y actualización de APK:** el motor de persistencia y su ciclo de vida Android real requieren comprobación en dispositivos. Las pruebas de navegador automatizadas no demuestran que el instalador conserve IndexedDB al actualizar o reinstalar.
5. **Recuperación tras desinstalación:** Android normalmente elimina datos locales al desinstalar. Antes de reinstalar exportar respaldo o subir a la nube; una instalación sin copia no garantiza recuperación.
6. **Sin verificación de sesión real:** falta ensayo de extremo a extremo con cuentas de prueba autenticadas y escenarios de desconexión de Supabase para comprobar políticas y RPC desde Android.
7. **Comprobaciones exhaustivas:** escenarios de 2 dispositivos con escritura concurrente, desconexión a mitad de RPC y recuperación con idempotencia requieren validación real (hay simulación automatizada, no evidencia de hardware).

## Invariantes de protección
- Ninguna operación de nube se dispara por conectividad, por abrir Perfil, por crear cuenta ni por cambio de perfil.
- Cualquier respuesta tardía se descarta si el perfil o la sesión cambió.
- Los registros eliminados conservan lápidas; la importación no los resucita.
- Ante error de red se conserva la cola; repetir el mismo UUID no crea más filas.
- Se rechazan subidas durante cambios activos en la UI, y los conflictos se deciden por persona.
- El RPC obtiene el dueño de `auth.uid()`, valida la cuenta habilitada y no acepta que el cliente elija a otro dueño.
- Todas las migraciones del bloque son aditivas; no eliminan ni vacían tablas existentes.

## Aceptación pendiente
En el teléfono probar: instalar sin Internet, registrar durante varios días, crear cuenta y confirmar correo, descargar, subir, modificar, borrar, alternar perfiles, trabajar simultáneamente desde clientes compatibles, cortar Internet durante una operación, actualizar APK sin eliminar la app, exportar y restaurar respaldo. **No compilar hasta autorizar.**
