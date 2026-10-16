# Gymlytics 01.06 — Perfil y Catálogo (16/10/2026)
**Origen:** cambios dictados en la sesión de voz del 16 de octubre de 2026.  
**Base:** rama `apk/pruebas`, versión Gymlytics 01.06.  
**Rama de trabajo:** `cambios/gymlytics-perfil-catalogo-20261016`.  
**Alcance:** editar fuentes web/Capacitor, **sin compilar APK**, sin alterar `main`, `apk/pruebas` ni el APK 01.06 existente.

## Requisitos consolidados
1. **Perfil:** reemplazar encabezado repetido «Perfil Gymlytics» con introducción breve sobre el aplicativo.
2. **Perfiles locales:** mostrar un único selector compacto con nombre de perfil, y desplegable de acciones **Agregar** y **Modificar**; conservar selección y persistencia offline.
3. **Vincular cuenta:** sustituir «Cuenta en la nube» por «Vincular cuenta»; acceso con «Correo o usuario», «Contraseña» e «Ingresar».
4. **Estado:** mostrar «No vinculado» sin cuenta personal (incluida sesión de prueba); al autenticar cuenta personal, mostrar «Vinculado» con check; «Descargar datos» depende de la identidad real (sin botón especial «de prueba»).
5. **Sin opción visible de «Desconectar cuenta de la nube»**.
6. **Respaldar, Restaurar, Actualizar:** tres acciones compactas. Respaldar exporta los datos locales a archivo de texto estructurado `.txt` (contenido JSON para conservar relaciones); Restaurar importa un respaldo válido a perfil independiente; Actualizar envía cambios a Supabase solo si hay cuenta personal vinculada.
7. **Modo de sincronización:** «Actualizar al momento» (tras guardar localmente, sincronizar si hay Internet) o «Actualizar después» (solo almacenamiento local hasta que se pulse Actualizar). Cuenta de prueba nunca puede escribir en Supabase.
8. **Cuenta de prueba:** aunque los datos provengan de Supabase en modo consulta, **Agregar, Modificar y Eliminar** deben funcionar en el dispositivo; «solo lectura» restringe exclusivamente la nube.
9. **Catálogo:** gimnasios y sedes como entidades distintas vinculadas por `gimnasio_id`; mostrar sedes únicamente del gimnasio seleccionado. Al agregar una sede, usar el gimnasio activo; si solo existe como referencia descargada, crear copia local del gimnasio para conservar la relación.
10. **Modificar** sustituye el valor anterior del mismo registro, sin insertar duplicado ni cambiar su identificador; **Eliminar** elimina el registro local y conserva operación pendiente/lápida cuando corresponda. Proteger gimnasios con sedes asociadas.
11. **Sin compilar:** acumular cambios fuente; habrá más modificaciones antes de construir el siguiente APK.

## Cambios incorporados en la rama de trabajo
- `web/index.html` y `web/styles.css`: introducción de Perfil, fila compacta, menú Agregar/Modificar, formulario de vinculación, estado de cuenta, «Descargar datos», selector de sincronización, Respaldar/Restaurar/Actualizar.
- `web/offline-first.js`: migración de perfiles demo que antes bloqueaban la escritura; CRUD local habilitado también para prueba; vinculación personal tras login; creación de sedes asociadas; respaldo `.txt` compatible con restauración JSON validada; activación de subida opcional para operaciones de series.
- `web/cloud-sync.js`: descarga demo fusionada con contenido offline conservando cambios locales; demo no queda vinculada como cuenta personal; envío manual o automático de **series** a cuenta personal.
- `web/app.js`: filtro gimnasio → sedes, asociación automática al agregar y campo «Modificar» precargado con el valor existente.
- `tests/offline-download-policy.test.mjs`, `tests/auth-kind-offline.test.mjs`: pruebas ajustadas a permisos demo locales y nueva interfaz de sincronización.

## Verificación sin compilación
- Análisis sintáctico de JavaScript (archivos `app.js`, `offline-first.js`, `cloud-sync.js`): correcto mediante parser V8.
- Comprobación de IDs de elementos de Perfil requeridos por JavaScript: presentes una sola vez.
- Ejecución aislada de CRUD de sedes: alta ligada a Smart Fit, renombrado sin cambio de ID y eliminación con lápida: correcta.
- **No se ejecutó compilación ni pruebas completas de Android.** No se tocó el APK existente ni la rama de entrega.

## Limitaciones identificadas para resolver antes de publicar
- **Bloque 1 implementado:** «Actualizar» envía series y operaciones de catálogos personales (gimnasios, sedes, máquinas, opciones y ejercicios) mediante un RPC idempotente por cuenta. Las fotografías aún no se sincronizan (Bloque 3).
- **Bloque 2 implementado en código:** los elementos de referencia se renombran u ocultan mediante una capa de sustituciones por perfil local. El catálogo compartido original no se altera ni se envían estas sustituciones a la nube.
- Falta ejecutar batería completa de pruebas, incluyendo renderizado en Android real, tras incorporar los demás cambios dictados.

## Bloque 1 — Sincronización de catálogo (implementado, sin APK)

**Fecha:** 16/10/2026. **Rama:** `cambios/gymlytics-perfil-catalogo-20261016`.

### Archivos añadidos y modificados
- `web/catalog-sync-engine.js`: planificación de creación/edición/borrado, orden gimnasio→sede, deduplicación de pendientes, validación de propietario, acuses y conflictos.
- `web/cloud-sync.js`: integración en «Actualizar» y modalidad «Actualizar al momento»; procesa catálogo y posteriormente series, con reintentos idempotentes.
- `web/offline-first.js`: guardar el estado anterior y propietario en eliminaciones locales, sincronización automática opcional del catálogo, edición y eliminación de ejercicios propios con sede, revisión explícita de conflictos.
- `web/offline-catalog-download.js`: conserva ID, `user_id`, snapshot de referencia, relaciones y eliminaciones, e identifica perfiles antiguos que requieren revisión.
- `supabase/migrations/20261016_catalog_sync.sql`: bitácora idempotente de operaciones, RPC `aplicar_cambio_catalogo`, control de sesión y cuenta de prueba, bloqueos de colisión, actualizaciones verificadas por estado y borrados lógicos.
- `tests/catalog-cloud-sync.test.mjs`: 12 pruebas de catálogo, dependencias, edición, eliminación, reintentos, aislamiento, conflictos y compatibilidad de descarga.

### Cambios en la base
- Se aplicaron correctamente las migraciones aditivas `gymlytics_catalogo_offline_idempotente_20261016` y `gymlytics_catalogo_offline_seguridad_20261016` al proyecto de Supabase existente.
- No se insertaron, modificaron ni eliminaron gimnasios, sedes, ejercicios u otros registros de usuario para probar la nueva función.

### Verificación
- 12/12 pruebas del motor ejecutadas en entorno V8 aislado.
- Simulación de llamada completa `upload` con servidor falso: gimnasio antes de sede, 2 acuses recibidos, cola vacía.
- Parseo de JavaScript completado: `offline-first.js`, `cloud-sync.js`, `offline-catalog-download.js`, `catalog-sync-engine.js` y `app.js`.
- La migración SQL fue aceptada por Supabase.
- **Sin compilación APK y sin ejecutar pruebas integrales autenticadas ni pruebas en Android real.**

### Regla de seguridad
- Toda edición se guarda primero en IndexedDB.
- «Actualizar al momento» solo opera con sesión personal vinculada y conexión.
- La cuenta de prueba no puede escribir en Supabase.
- Un UUID de otra cuenta, un cambio remoto no coincidente o una colisión de nombre generan bloqueo o conflicto, sin sobrescribir automáticamente.
- Las eliminaciones remotas son lógicas (`activo=false`) para no romper claves foráneas históricas.

### Próximos bloques
- Bloque 2: implementado en fuentes; pendiente de validación funcional en Android.
- Bloque 3: sincronización de fotografías.
- Bloque 4: pruebas end-to-end autenticadas con perfiles reales y Android.
- Bloque 5: compilación, **solo después de las demás modificaciones solicitadas**.


## Bloque 2 — Sustituciones de referencias del catálogo (implementado, sin APK)

**Fecha:** 16/10/2026. **Rama:** \`cambios/gymlytics-perfil-catalogo-20261016\`.

### Funcionamiento

- \`web/reference-overrides.js\` define identificadores \`base:\` estables frente a los cambios de nombre locales, basados en la identidad original de la referencia. Se almacenan en \`data.referenceOverrides\`, exclusivo de cada perfil IndexedDB.
- «Modificar» cambia la denominación **visible** en el catálogo local (copy-on-write). El original \`baseCatalog\`, sus relaciones y los registros históricos se preservan. «Eliminar» oculta la referencia del perfil, sin borrar el dato compartido ni el historial.
- Los identificadores de sede incorporan el gimnasio original: una sede «La Rambla» de Smart Fit no afecta una sede con el mismo nombre de Evolution.
- Los cambios de gimnasio se reflejan en sus sedes y en los campos derivados de Registro y Catálogo. El mecanismo abarca gimnasio, sede, instrumento, ejercicio, AnotaciónV2, agarre/implemento y técnica.
- Los ejercicios personales con gimnasio/sede se renderizan usando los nombres más recientes de las entidades a las que están asociados, sin modificar la fuente ni el historial.
- Las copias de seguridad completas incluyen automáticamente \`referenceOverrides\`. Restaurarlas en otro perfil recupera las sustituciones sin intervenir sobre otros perfiles.
- Una descarga posterior conserva las sustituciones. Si un registro base cambia en la nube mientras tiene una sustitución local, se conserva la referencia anterior y se genera un aviso de conflicto; no se sobrescribe sin avisar.
- Las sustituciones de referencia **no generan operaciones de subida de catálogo**. Solo los elementos personales, incluidos los gimnasios que se copien explícitamente al agregar una sede, pueden formar parte de la sincronización definida en Bloque 1.

### Cambios de código

- Nuevo: \`web/reference-overrides.js\`; \`tests/reference-overrides.test.mjs\`.
- Modificados: \`web/offline-first.js\`, \`web/app.js\`, \`web/offline-catalog-download.js\`, \`web/cloud-sync.js\`.
- Sin migración de base de datos para este bloque, sin alterar \`main\` ni la versión APK de entrega.

### Verificación sin compilar

- **14/14 pruebas** de referencias (incluyen gimnasio→sede, coincidencia de nombres entre gimnasios, eliminación no destructiva, separación de perfiles, restauración de nombre y descarga posterior).
- Prueba aislada de representación de ejercicio personal: nombres de gimnasio/sede/ejercicio actualizados sin cambiar la fuente almacenada.
- Verificación sintáctica V8 correcta de los archivos JavaScript modificados.
- **No** se efectuaron pruebas con Android real ni pruebas E2E con perfiles de Supabase; quedan para el bloque de integridad.
