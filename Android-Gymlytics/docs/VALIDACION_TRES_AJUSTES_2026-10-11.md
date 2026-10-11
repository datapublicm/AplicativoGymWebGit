# Gymlytics — Tres ajustes acordados

**Fecha:** 11/10/2026 (registro CI). **Repositorio:** datapublicm/AplicativoGymWebGit, rama exclusiva `Android-Gymlytics`.

El alcance de esta intervención está limitado a **márgenes**, **cargar información** y **visualización de la información cargada**. El visor humano 3D permanece fuera del alcance. No compilar APK, no fusionar a `main` y no modificar datos existentes.

## 1. Márgenes Android y diseño responsive

- `web/styles.css`: sustituye el margen superior rígido de 52 px por `safe-area-inset-top + 12px`; aplica `safe-area-inset-left/right` y respeta la barra inferior.
- Ajusta el ancho de las tarjetas, títulos, botones y campos para que no desborden el viewport; el historial pasa a disposición en dos columnas y a una en pantallas de menos de 400 px.
- Los filtros del nuevo Dashboard pasan de dos columnas a una en pantallas estrechas. El gráfico conserva un área desplazable horizontalmente en lugar de recortar fechas.
- Las correcciones están comprobadas por pruebas de estructura CSS, **no** por capturas de pantalla de un dispositivo Android. La verificación visual sigue pendiente y no necesita compilar APK si se prueba en navegador móvil.

## 2. Carga de información desde Supabase Pruebas

- `web/auth-cloud.js`, método `loadInitialCatalog()`: consulta primero el total exacto del catálogo activo, recupera las páginas en un orden determinista (`fila_origen`, `id`) y rechaza respuestas incompletas, nulas, IDs repetidos y cambios de sesión.
- Al iniciar sesión, el estado muestra el número real de **ejercicios de referencia** y **series del usuario** descargados.
- La fuente sigue siendo `sch_android_gymlytics.tbl_catalogo_predeterminado`. **No se importa o duplica el Excel**: el catálogo ya fue cargado previamente a Supabase.
- Estado SQL de Pruebas comprobado en lectura: **242 registros activos, 242 IDs únicos y 242 números de fila de origen distintos**; **278 ejercicios, 6 gimnasios, 32 sedes, 18.526 series**.
- Con contexto de rol `authenticated` simulado por cuenta, A y B acceden cada una a **242 ejercicios de referencia, 139 ejercicios personales y 9.263 series propias; cero series de la otra cuenta**. No es una validación con JWT real.

## 3. Visualización de información cargada

- `web/index.html`: nuevo panel «Progreso por fecha» en Dashboard, con selector de ejercicio y 4 indicadores: **peso máximo (kg)**, **repeticiones totales**, **series realizadas** y **volumen total (kg × rep.)**.
- `web/app.js`: agrega por ejercicio y fecha las series presentes en `model.records` (descargadas de Supabase). Muestra las diez fechas más recientes con SVG accesible y valores detallados. Convierte el peso en `lb` a `kg` antes de mostrar peso y volumen.
- El gráfico no consulta ninguna API adicional, no introduce bibliotecas externas y no implementa aún visualización 3D. Cuando no hay datos se muestra un mensaje vacío, sin inventar valores.
- Validación SQL de la cuenta A: **9.263 series**, **377 fechas**, **42 nombres de ejercicio**, **cero filas sin fecha, nombre, peso o repeticiones**. Los valores de la vista están tipados como `date`, `numeric` y `text`, según corresponde.

## Versiones y pruebas

- `tests/catalog-loading-completeness.test.mjs`: 8 pruebas nuevas de catálogo íntegro, paginación, errores, duplicados y sesiones.
- `tests/margins-data-dashboard.test.mjs`: 8 pruebas nuevas del gráfico, conversión kg/lb, estado vacío, XSS y CSS responsive.
- `web/sw.js`: caché estática renovada a `gymlytics-mobile-v0.5-20261011` para que se actualicen HTML, JS y CSS; se mantiene el aislamiento de cachés de otras apps y de información privada.
- **CI:** [GitHub Actions 38114273292](https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38114273292) — **123/123 pruebas aprobadas, 0 fallos**. La compilación Android y la validación visual en dispositivo no se realizaron.

**Próximo paso restringido al alcance:** revisar los márgenes y la navegación sobre tamaños Android reales con las herramientas de previsualización, y verificar la carga de catálogo y gráfico mediante un inicio de sesión real autorizado. No empezar modelo 3D.
