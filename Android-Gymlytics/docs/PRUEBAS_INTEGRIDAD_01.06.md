# Gymlytics 01.06 — Bloque 3: pruebas de integridad

**Fecha:** 15/10/2026. **Rama:** `apk/pruebas`. No se compiló APK, no se publicó ninguna nueva versión Android y no se modificaron `main`, `Android-Gymlytics` ni `apk/pruebas_01.05`.

## Evidencia automatizada
- GitHub Actions: [205/205 pruebas unitarias y de regresión + 24/24 escenarios de Chrome móvil](https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38799656928).
- GitHub Actions: [paquete web validado y 8 escenarios reales con IndexedDB y Service Worker](https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38799656931).
- `tools/verificar-integridad-offline.mjs` ejecuta una interfaz real en Chromium aislado, no solo simulaciones de métodos.
- `tests/integridad-transferencias.test.mjs` cubre RPC de prueba en memoria, red interrumpida tras commit, reintentos, conflictos de perfiles, errores en descarga paginada y operaciones confirmadas después de borrados/ediciones posteriores. Estas simulaciones no escriben datos en Supabase.
- Confirmación **solo lectura** de Supabase `ProyectosPrueba`: `tbl_sync_series` y `tbl_sync_ops` existen, con RLS habilitado y cero registros; funciones `aplicar_cambios_offline` y `asegurar_perfil_gymlytics` están instaladas. No se ejecutó un ciclo autenticado real.

## Matriz de siete escenarios acordados

| Escenario solicitado | Evidencia obtenida | Estado |
|---|---|---|
| 1. Instalar y usar sin Internet | Arranque Chromium sin login; recarga completamente offline inmediatamente después de la instalación de caché | **Web validada**; instalación APK en teléfono pendiente |
| 2. Registrar semanas sin cuenta | Cuatro meses de registros ficticios con red deshabilitada; persistencia IndexedDB y cola de pendientes | **Web validada** |
| 3. Crear cuenta después y migrar | Alta de cuenta y vinculación opcional implementadas; cobertura de reglas de cuenta y migración simulada | **Pendiente E2E con correo confirmado y Supabase real** |
| 4. Borrar registros offline antes de sincronizar | Borrado persistente, lápidas, eliminación de alta nunca enviada; reintentos después de ACK perdido | **Web y simulación validadas** |
| 5. Modificar información simultáneamente desde web y Android | Control de versiones y conflicto entre dos clientes simulados, sin sobrescritura silenciosa | **Pendiente ensayo con ambos clientes reales**; clientes antiguos no usan espejo |
| 6. Interrumpir Internet durante sincronización | Corte antes de iniciar, después del commit, descarga interrumpida, repetición idempotente; edición y borrado tras ACK perdido | **Simulaciones superadas**; ensayo real de red pendiente |
| 7. Actualizar o reinstalar sin perder datos | Recarga, reinicio offline, separación de perfiles y renovación de caché web sin perder IndexedDB | **Actualización web simulada validada**; actualizar APK real pendiente; **desinstalar puede borrar los datos locales** |

## Defectos descubiertos y corregidos
1. La caché inicial no incluía los scripts/CSS generados por Vite con nombres hash. La app podía quedarse en «Iniciando almacenamiento sin conexión» al reiniciar offline. La construcción web ahora inyecta esos recursos al manifiesto del Service Worker y permite arranque offline inmediato.
2. Una solicitud enviada a Supabase podía confirmarse en servidor y perder su respuesta en una interrupción de red. Si el usuario editaba o borraba la serie antes del reintento, el `op_id` original habría sido reutilizado con un contenido diferente o descartado. Ahora el mensaje exacto se persiste en IndexedDB **antes** del RPC, se reenvía inmutable y se encadenan las operaciones posteriores con nuevos UUID y versión confirmada.
3. La eliminación de una serie cuyo alta ya se había enviado conserva ahora la operación anterior hasta reconocer su ACK; luego transmite el borrado. Así no resucitan registros durante la descarga.

## Condiciones de aceptación pendientes
- Instalar `01.06` en un móvil Android físico **solo después de autorizar la compilación**, con pruebas de arranque online/offline.
- Actualizar `01.05` a `01.06` sin desinstalar, verificar mismo `appId` y conservación de datos, fotografías, catálogos, perfiles, lápidas y cola pendiente.
- Comprobar inicio de sesión, confirmación de correo, vinculación y transferencia con cuentas **exclusivas de prueba**; nunca usar historiales reales en pruebas destructivas.
- Dos clientes actualizados a 01.06 con cambios concurrentes, cancelaciones, pérdida de cobertura, recuperación y reintentos.
- Adaptar clientes web antiguos al espejo versionado o cerrar su compatibilidad; actualmente no permiten garantizar conflictos con todas las versiones.
- La transferencia de fotos y catálogos sigue pendiente y no debe indicarse como sincronizada.
- **Reinstalar borrando datos de Android no asegura recuperar perfiles**: hacer copia JSON completa o respaldo nube antes de desinstalar.

## Ejecución
- `npm run test:static`
- `node tools/verificar-layout-mobile.mjs`
- `npm run build:web`
- `node tools/verificar-integridad-offline.mjs` (requiere `dist` y Chrome/Chromium)
- No ejecutar `android:sync`, Gradle ni workflow de compilación APK sin autorización.

## Preparación posterior: compatibilidad y paquete paralelo

- Se añadió `web/legacy-compat.js` para **detectar modificaciones y eliminaciones hechas por clientes antiguos** en `vw_historial_series`. Cuando esas operaciones no disponen de versión compatible, se bloquea su resolución automática y se exige actualización de los clientes antes de conciliar. No se modificó `tbl_series`.
- Un historial recibido mediante el espejo conserva una línea base del historial heredado para evitar falsos conflictos en descargas sucesivas.
- Se preparó `.github/workflows/compilar-gymlytics-01.06-pruebas.yml` como **ejecución exclusivamente manual**. Generará `com.datapublicm.gymlytics.pruebas` en paralelo con la instalación 01.05, preservando su información y sin reemplazar `Android-Gymlytics`.
- No se ha verificado la actualización del paquete original 01.05 a 01.06: la firma de depuración del 01.05 no está documentada como reutilizable, por lo que una actualización directa podría ser rechazada. No prometer actualización in situ sin una firma compatible.
- Queda pendiente probar en dispositivo físico la entrega paralela y, con usuarios exclusivamente de prueba, la vinculación real de cuentas, el RPC y la reconciliación entre web y Android.
- La transferencia de catálogos y fotografías sigue pendiente; esas operaciones deben mostrarse como locales.
