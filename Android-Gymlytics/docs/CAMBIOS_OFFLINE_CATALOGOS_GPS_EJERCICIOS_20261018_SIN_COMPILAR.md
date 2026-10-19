# GymLytics — ajustes de Catálogos y Registro (18/10/2026)

## Alcance y restricciones
- Rama aislada de desarrollo: `cambios/gymlytics-01.08-offline-ubicacion-ejercicios-20261018`, creada desde `cambios/gymlytics-01.08-preparacion`.
- Cambios en **código fuente de la APK**, todavía **sin compilar**.
- **No conectar, validar, consultar, probar ni modificar Supabase** hasta revisar y decidir el nuevo esquema.
- Datos de gimnasio, sede, GPS y ejercicio se escriben **primero en el perfil local IndexedDB**. Se mantiene la descarga ya implementada y los catálogos de referencia disponibles en el perfil.
- Las migraciones SQL actuales no se ejecutaron ni modificaron.

## Catálogos
1. **Ubicación** agrupa visualmente Gimnasio y Sede. Añadir un gimnasio personal crea automáticamente la sede `Única`; se puede renombrar.
2. **GPS opcional de sede:** diálogo emergente con latitud/longitud, botón `Usar mi ubicación actual`, guardar localmente por ID de sede y consultar en mapa. Para sedes de referencia descargadas, crear una copia personal con sus relaciones y guardar en ella, sin modificar el origen.
3. Se conservan las referencias ya descargadas, diferenciadas de los registros personales.
4. **Ejercicio** inicia sin exigir gimnasio ni sede. Puede tener el mismo nombre que otro ejercicio: cada uno conserva identificador distinto. Detalles estándar Agrupación, Anotación, Instrumento, Agarre / Implemento, Técnica y detalles adicionales arbitrarios.
5. Modificar detalles reemplaza el contenido **del mismo ID**, sin insertar otra fila.
6. Quitar **Número Serie** y **Subdivisión** de la pantalla Catálogos. Permanecen en Registro, historial y series.
7. Si solo hay un valor, seleccionarlo por defecto; si hay varios, mostrar `Seleccionar…`, y si no existen ejercicios, mostrar `Agregar ejercicio`.
8. Sede depende del Gimnasio; cuando la sede identifica un gimnasio único, este puede completarse automáticamente. Evitar escoger arbitrariamente gimnasio si existe ambigüedad.
9. Registro incorpora opción **Seleccionar por otros campos** y selector opcional Agrupación. No se altera el tratamiento existente de pesos, repeticiones, asistencia ni subdivisiones.

## Limitaciones deliberadas
- El guardado de latitud/longitud es offline. La solicitud del GPS requiere permisos del dispositivo y contexto seguro según la plataforma. El **mapa OpenStreetMap embebido requiere Internet para cargar el mosaico**; cuando no hay conexión, se conservan las coordenadas y se muestra una indicación.
- La sincronización de los **nuevos campos** con Supabase debe revisarse **después** de que se apruebe el esquema remoto, no antes. No interpretar un cambio local como prueba de sincronización.
- No se creó ningún APK ni se ejecutó un proceso de build.
- Revisión de sintaxis y presencia de controles es **estática**; la validación funcional en dispositivo sigue pendiente.
- Catálogo de músculos y vínculos ejercicio–músculo quedan enumerados para fase posterior; no requieren implementación hoy.

## Esquema mínimo propuesto
8 tablas para funcionamiento de perfiles, gimnasios, sedes, ejercicios y sus detalles, sesiones y series:
`tbl_usuarios`, `tbl_perfiles`, `tbl_gimnasios`, `tbl_sedes`, `tbl_ejercicios`, `tbl_ejercicio_detalles`, `tbl_sesiones`, `tbl_series`.
Dos tablas **reservadas** para etapa muscular:
`tbl_musculos`, `tbl_ejercicio_musculos`.
Esta propuesta no declara que el esquema actual de Supabase tenga solamente estas tablas.
Archivo complementario en la Biblioteca: `GymLytics_Modelo_Minimo_Tablas_Offline_20261018.xlsx`.
