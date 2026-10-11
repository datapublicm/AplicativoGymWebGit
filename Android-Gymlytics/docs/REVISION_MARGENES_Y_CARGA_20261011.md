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
