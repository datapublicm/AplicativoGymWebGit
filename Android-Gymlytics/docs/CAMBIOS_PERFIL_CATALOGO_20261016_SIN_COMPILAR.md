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
- El motor `planUpload` actual admite sincronización a Supabase de **series**. Las operaciones pendientes de **catálogos** y **fotografías** aún requieren una implementación específica con aislamiento por cuenta, mapeo seguro de IDs y gestión de conflictos; **no debe indicarse que Actualizar ya sube todas las categorías**.
- Los elementos de **referencia base** se consultan pero no se editan ni eliminan directamente; las copias locales y entidades personales sí. Requiere decidir cómo aplicar sustituciones de referencia sin destruir entradas compartidas ni asociaciones existentes.
- Falta ejecutar batería completa de pruebas, incluyendo renderizado en Android real, tras incorporar los demás cambios dictados.
