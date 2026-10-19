# Gymlytics 01.06 — Bloque 4: pruebas de integridad
**Fecha:** 16 de octubre de 2026
**Rama:** `cambios/gymlytics-perfil-catalogo-20261016`
**Estado:** Pruebas estáticas/automatizadas aprobadas. Sin compilar APK.

## Resultado verificable
- GitHub Actions: **288 pruebas aprobadas, 0 fallidas, 0 omitidas** (Node.js 22).
- Run: https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38921468134
- Pasaron los pasos `npm run test:static`, sintaxis de módulos y confirmación explícita de no compilación Android.
- Sin cambios a `main`, `apk/pruebas`, ni al APK Gymlytics 01.06 instalado.

## Cobertura
- Perfiles independientes y nombres únicos; prohibir vinculación cruzada o duplicada de cuentas.
- Distinción de cuenta de prueba y cuenta personal; prueba editable en IndexedDB pero sin escritura a Supabase.
- Funcionamiento offline y preservación de pendientes ante falta de Internet o descarga interrumpida.
- Sincronización idempotente de entrenamientos/series, relaciones gimnasio→sede, actualizaciones y eliminaciones.
- Descargas paginadas de **9 263 series** sin duplicar ni truncar registros (simulación).
- Conflictos de versiones y protección ante cambio de cuenta/perfil durante operaciones asíncronas.
- Referencias de catálogo editables solo localmente; nuevas descargas no reemplazan cambios locales heredados sin aviso.
- Fotografías por ejercicio/gimnasio/sede/vista, rutas privadas y reintentos por versión.
- Respaldos que preservan fotografías, cambios, relaciones y operaciones pendientes.
- Migración de pendientes de versiones anteriores.
- Caché offline y sintaxis/identificadores de interfaz.

## Correcciones de integridad realizadas durante el bloque
1. `web/offline-catalog-download.js`: ante un elemento local sin snapshot confirmado, conservar su modificación y generar conflicto/revisión en vez de reemplazarla al descargar.
2. `web/offline-first.js`, `web/index.html`: incorporación de «Eliminar perfil» en menú compacto, con confirmación, veto a eliminar el último perfil, espera/cambio seguro de perfil y borrado **solo local**.
3. `tests/integrity-block4.test.mjs`: pruebas específicas de validación de perfiles, respaldos, eliminación, aislamiento de cuenta, modo sin conexión y módulos offline.
4. Actualización de comprobaciones de regresión antiguas que exigían de manera incorrecta bloqueo de edición en la cuenta demo/referencias base o no simulaban `tbl_fotos_offline`.
5. `.github/workflows/gymlytics-bloque4-integridad.yml`: trabajo CI de pruebas Node y sintaxis **sin ejecutar Vite, Capacitor ni Gradle**.

## Restricciones y verificaciones pendientes
- **No se ejecutaron pruebas autenticadas de escritura real** contra Supabase con cuentas de prueba/personal; evitar operaciones que alteren datos de usuario reales.
- **No se probó en un teléfono Android real** ni en emulador, ni se realizó compilación APK.
- Las simulaciones de trabajo offline prolongado y los 9 263 registros no equivalen a semanas reales de uso del dispositivo.
- Al solicitarse la compilación posteriormente, validar instalación, reinicio offline, formularios táctiles, importación/restauración, permisos del navegador, subida/descarga de fotografías, redes inestables, RLS con cuentas de test y posibles conflictos entre varios equipos.

**Próximo paso condicionado por el usuario:** mantener los cambios en esta rama hasta recibir las siguientes indicaciones; no compilar todavía.
