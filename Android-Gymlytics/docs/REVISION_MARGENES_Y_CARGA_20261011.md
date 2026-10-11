# Gymlytics · Revisión del alcance acordado (11/10/2026)

**Alcance autorizado:** márgenes de la interfaz móvil, carga de información del catálogo y visualización de series/gráficos. **El modelo humano 3D continúa expresamente pospuesto.** No se modifica ningún modelo, geometría, asignación muscular 3D ni visor interactivo; tampoco se compila la APK.

## Hallazgo 1: carga de catálogo bloqueaba el historial

**Antes:** si la consulta a `tbl_catalogo_predeterminado` o al catálogo personal fallaba, la secuencia de inicio de sesión entraba en el bloque `catch` y **nunca intentaba consultar `vw_historial_series`**. Como resultado, Tablas y Dashboard podían verse vacíos aunque hubiera series registradas.

**Después:** `web/auth-cloud.js` intenta recuperar el historial de entrenamientos aun cuando falla el catálogo. Si el historial se recupera completo, lo publica para la cuenta activa y habilita respaldos; si el historial también falla, mantiene los respaldos bloqueados. En caso de fallo de catálogo se abre Catálogos y se muestra un mensaje con instrucción de reintento.

**Nueva recuperación:** botón **Actualizar catálogo**, con espera de sesión, bloqueo de peticiones paralelas durante la carga inicial y comprobación de propietario/época antes de publicar nuevos catálogos. Esta operación **no borra ni vuelve a guardar series existentes**.

## Hallazgo 2: margen móvil del botón y diálogo de detalle

**Antes:** los dos botones de acciones del catálogo no tenían una distribución responsive propia. La ventana de detalle usaba ancho de pantalla menos 16 px sin descontar explícitamente los márgenes laterales seguros del dispositivo.

**Después:** `web/styles.css` distribuye los botones en dos columnas bajo 760 px y en una bajo 380 px, con altura táctil de al menos 44 px. El cuadro de detalle y su altura disponible tienen en cuenta las cuatro áreas seguras de Android (arriba, abajo, izquierda y derecha). La barra inferior respeta también las áreas seguras laterales.

Estas verificaciones se realizaron sobre **código y pruebas automatizadas**; no se ha realizado captura real en teléfono o emulador. No se debe presentar una comprobación visual en hardware como completada.

## Visualización de los registros

Se conservó el Dashboard ya implementado: los indicadores de peso, repeticiones, series y volumen se calculan sobre las series descargadas de Supabase. El fallo del catálogo ya no tiene que impedir que se obtengan esos datos. No se añadieron gráficos ni funciones 3D nuevas en esta revisión.

## Pruebas y conservación

- `tests/catalog-partial-failure-retry.test.mjs`: 8 pruebas de recuperación del historial, recarga del catálogo, fallo de ambos orígenes, error de historial y aislamiento entre cuentas.
- `tests/margins-data-dashboard.test.mjs`: 2 pruebas nuevas de acciones del catálogo a 320 px y de márgenes seguros de modal/barra inferior.
- Caché de PWA renovada a `gymlytics-mobile-v0.6-20261011`. `tests/service-worker-isolation.test.mjs` mantiene el aislamiento de cachés de otras aplicaciones.
- **133/133 pruebas aprobadas**, 0 fallos. [CI de referencia](https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38114907437).
- Lectura SQL sin modificar datos en `ProyectosPrueba`: **2 cuentas, 242 registros activos en el catálogo de referencia, 18.526 series, 6.218 reportes y 0 fotos**.
- `main` permanece intacta y no se generó APK.

**Pendiente dentro del mismo alcance:** ejecución visual real con tamaños 320/360/390/412 px y una sesión HTTPS de prueba para observar carga del catálogo y series en el navegador del dispositivo. Las simulaciones y pruebas estáticas no sustituyen esas comprobaciones.


## Verificación de navegador y datos — 11/10/2026

**Alcance inalterado:** márgenes, carga de información y visualización. **El modelo humano 3D sigue pospuesto**. No se ha habilitado ni modificado. No se compiló APK ni se fusionó `main`.

**Problema detectado:** en la etapa «Series» del registro a 390 px, el botón `#backToContext` sobresalía aproximadamente 3 px. Chrome reportó `innerWidth=393` con viewport visual de 390 px. La cabecera `.series-head` no acomodaba correctamente título, contador y botón. Se corrigió con `flex-wrap`, reducción flexible del título y reorganización del botón en móviles. La tabla ancha conserva su desplazamiento horizontal contenido.

**Verificación real en navegador:** el flujo `.github/workflows/validar-android-gymlytics.yml` ejecuta `tools/verificar-layout-mobile.mjs`, que inicia Chrome headless, sirve los archivos HTML/CSS/JS del repositorio por HTTP local y configura el viewport mediante DevTools. Comprueba **Sesión, Catálogos, Registro, Registro/Series, Tablas y Dashboard** en 320, 360, 390 y 412 px: **24 escenarios**, verificando desbordamientos, rectángulos de controles, barra inferior y gráfico SVG de Dashboard con datos ficticios. Guarda capturas de Dashboard 320 px y Registro/Series 390 px en los artefactos de GitHub Actions. Se realiza sin dependencias adicionales y sin APK.

**Ejecución validada:** [CI 38117617991](https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38117617991), 133 pruebas de Node y 24 escenarios Chrome aprobados. [Capturas verificables](https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38117617991/artifacts/11693841679). Se incorporaron después dos pruebas adicionales de regresión y este informe; verificar la ejecución final correspondiente.

**Lectura SQL sin modificar datos en Supabase Pruebas:** 2 usuarios, 242 ejercicios activos de referencia (242 IDs únicos), 278 ejercicios totales, 18.526 series, 6.218 reportes, 0 fotos, 0 objetos en Storage y 15/15 tablas con RLS. Bajo `authenticated` con `auth.uid()` simulado para cada cuenta: 9.263 series, 9.263 IDs únicos, 0 series de otra cuenta y 0 registros incompletos (fecha, ejercicio, peso, repeticiones).

**Alcance de la evidencia:** Chrome en modo móvil no sustituye un dispositivo físico Android ni WebView de una APK. La validación SQL de permisos no sustituye autenticación por HTTPS con JWT real; no se proporcionaron contraseñas ni tokens.


## Continuación: progreso visible de la carga del historial

**Implementación web sin alterar la base de datos ni la funcionalidad 3D.** El historial de cada cuenta contiene miles de series (9.263 registros por cuenta en Supabase Pruebas). Hasta ahora, durante la descarga inicial y la recarga manual, Gymlytics no indicaba cuántas series había recibido. Se incorporó:

- Una barra de progreso visible en `web/index.html` y `web/styles.css`, adaptable al ancho del móvil. Muestra el recuento de filas y el porcentaje. Durante la consulta inicial del total, se comporta como indicador indeterminado y **no inventa porcentajes**.
- `cloud.loadHistory(onProgress)` comunica los totales después de consultar el recuento y al finalizar cada lote paginado comprobado. Por ejemplo, sobre 9.263 filas: 0, 2.800, 5.600, 8.400 y 9.263. Un cambio de cuenta anula respuestas anteriores.
- El inicio de sesión y la opción **Actualizar historial** utilizan ese progreso y lo ocultan al terminar, fallar o cambiar de usuario. Las exportaciones CSV/JSON **permanecen bloqueadas** hasta completarse toda la descarga; se conservan las validaciones de duplicados, cuenta y cantidad exacta.
- Actualización del Service Worker: caché estática `gymlytics-mobile-v0.8-20261011`; no se cachean respuestas privadas de Supabase.
- Pruebas nuevas de progreso y adaptación de pruebas anteriores: **150/150 pruebas aprobadas**, CI [38167202998](https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38167202998).

**Lectura SQL de conservación:** 2 usuarios, 242 ejercicios de referencia activos, 18.526 series, 6.218 reportes, 0 fotos. Solo consultas de lectura en esta continuación. `main` no modificada. No se compiló APK durante esta intervención y el modelo humano 3D **sigue pospuesto**.

**Alcance de la evidencia:** el indicador funciona en pruebas de código y muestra avances calculados por lotes; todavía no se ha confirmado mediante navegación autenticada en un dispositivo físico. No presentar las pruebas simuladas como sesión HTTPS real.
