# Gymlytics — Fase 2: integración con Supabase Pruebas (10/10/2026)

## Alcance

Únicamente la rama `Android-Gymlytics`, dentro de `Android-Gymlytics/`; backend **ProyectosPrueba** `jasuqnxrskhqfobsazwd`. `main`, Producción y los registros de usuario no se modificaron. **No se compiló APK, Gradle ni dist/**.

## Comprobaciones directas de base de datos (lectura)

1. El rol `authenticator` tiene configurado `pgrst.db_schemas=public,graphql_public,web,sch_android_offline_report,sch_android_gymlytics`. Los otros esquemas se preservan.
2. `sch_android_gymlytics` otorga `USAGE` a `authenticated`, no a `anon`. Las tablas operativas tienen `SELECT` y los permisos apropiados, siempre bajo RLS.
3. Las 15 tablas tienen RLS y `vw_historial_series` utiliza `security_invoker=true`.
4. `guardar_entrenamiento` acepta `p_fecha, p_gimnasio_id, p_sede_id, p_ejercicio_id, p_tecnica, p_observaciones, p_series`, coincide con la llamada JavaScript y tiene `EXECUTE` para `authenticated`.
5. `usuario_habilitado()` comprueba perfil activo, permiso activo en `app_core.user_app_access` y aplicación con slug `gymlytics`.
6. Recuento de solo lectura: **18.526** series, exactamente **9.263 por cada una de las dos cuentas**, **6.218** reportes.
7. Integridad referencial inspeccionada: **0** series sin reporte o asignadas a otro propietario; **0** reportes sin ejercicio o asociados a un ejercicio privado de otro propietario; **0** sedes sin gimnasio o asociadas al gimnasio de otro propietario.
8. El proyecto de Pruebas se encuentra activo y dispone de clave publicable habilitada. El navegador/Android debe usar dicha clave, nunca `service_role`.

Estos resultados demuestran configuración y consistencia SQL, pero **NO** acreditan una petición HTTP autenticada real desde la app ni la efectividad de RLS con dos JWT reales.

## Corrección de concurrencia entre cuentas

Se añadió `assertCurrentSession(uid, epoch)` a `web/auth-cloud.js`. Antes de publicar datos globales, los métodos `loadOwnCatalog`, `loadIndependentCatalog` y `loadCatalogStats` comprueban que la sesión actual coincide con la que inició la consulta. No se vuelca en pantalla una respuesta antigua tras cambiar de cuenta.

`tests/session-race-isolation.test.mjs` prueba 4 casos: carga tardía de ejercicios, de gimnasios/sedes/máquinas, estadísticas atrasadas y comportamiento normal sin cambio de cuenta. GitHub Actions los ha ejecutado satisfactoriamente.

## Verificación HTTP real preparada (SIN ejecutar, requiere credenciales privadas)

`tools/validar-data-api.mjs` usa Node 22 y `fetch`; no instala paquetes, no escribe registros, no envía correos, no usa el rol administrativo y bloquea URLs distintas de **ProyectosPrueba**.

- Con `VITE_SUPABASE_PUBLISHABLE_KEY`: comprueba el acceso anónimo a un perfil sin leer otros usuarios.
- Además, con `GYMLYTICS_TEST_EMAIL_A` y `GYMLYTICS_TEST_PASSWORD_A`: solicita un token de Auth y comprueba perfil e historial propios.
- Opcionalmente con `GYMLYTICS_TEST_USERNAME_A`: valida login por usuario mediante `gymlytics-login-usuario`.
- Con `GYMLYTICS_TEST_EMAIL_B` y `GYMLYTICS_TEST_PASSWORD_B`: comprueba con dos sesiones reales que ninguna puede consultar las series de la otra cuenta.

Configurar estas variables **fuera del repositorio y de los mensajes de chat**. Un archivo local `.env.integration.local` está excluido por `.gitignore`. Desde `Android-Gymlytics/` ejecutar con Node 22:

```sh
node --env-file=.env.integration.local tools/validar-data-api.mjs
```

También se ofrece `npm run test:integration` cuando las variables ya estén presentes en el proceso. No se ejecuta automáticamente en CI, porque no deben almacenarse contraseñas ni JWT en el repositorio.

## Aún pendiente

- [ ] Prueba HTTP real con identidad de la cuenta A.
- [ ] Prueba HTTP real con dos cuentas y aislamiento de RLS.
- [ ] Confirmar login y persistencia de sesión desde dispositivo Android real.
- [ ] Configurar URL de recuperación HTTPS autorizada y probar retorno (sin enviar correos hasta preparar un entorno controlado).
- [ ] Probar creación de gimnasios, sedes, máquinas y ejercicio, guardado de series y error de transacción en Pruebas (solo cuando se autoricen pruebas que escriban datos).
- [ ] Verificar fotografias privadas y Storage mediante sesión real.
- [ ] Integración 3D y pruebas de interfaz móvil.
- [ ] No compilar APK hasta autorización explícita.

**La ausencia de una prueba HTTP real no debe presentarse como éxito de integración funcional.**


## Continuación — validación de operaciones entre sesiones (10/10/2026)

Se reforzó el aislamiento por sesión en el cliente de **Android-Gymlytics** y se ejecutaron pruebas sin paquetes ni compilación.

- `web/app.js`: guardado, eliminación de series, subida de fotografías, vista anatómica y descarga posterior verifican que la sesión actual corresponde a la solicitud que generó la respuesta. Evitan sobrescribir el historial o la previsualización de otra cuenta.
- `web/auth-cloud.js`: `ensureExercise`, `uploadUserPhoto` y `loadAnatomy` guardan la identidad y época de sesión y las comprueban entre operaciones asíncronas. Las rutas de Storage y los registros de `tbl_fotos` utilizan el identificador fijado al iniciar la subida.
- Nuevas pruebas: `mutation-session-isolation.test.mjs`, `cloud-write-session.test.mjs` y `anatomy-session-isolation.test.mjs`.
- **GitHub Actions 38080959688:** **56 pruebas Node aprobadas, 0 fallidas**; comprobación de sintaxis y verificación de ausencia de artefactos completadas.
- Revisión SQL de solo lectura posterior: **2 usuarios**, **6.218 reportes**, **18.526 series**, **0 fotografías** y **15/15 tablas con RLS**. Sin cambios en tablas ni autenticación.
- Rama `main` observada sin variación en `7642f8eac9623892e7d292b2b49f81d14d76e2b1`. Las actualizaciones se realizaron únicamente en `Android-Gymlytics`.

**Limitación importante:** Si la sesión cambia exactamente después de que Storage acepta un archivo y antes de que se inserte su metadato, se evita asociar la foto a la cuenta equivocada, pero podría quedar un archivo huérfano bajo la carpeta privada del propietario original. No se ha validado una rutina de limpieza de esos casos. No supone que se hayan creado archivos en esta revisión (la tabla de fotos permanece vacía).

**Sigue pendiente:** comprobación HTTPS autenticada con tokens reales de dos cuentas de prueba; revisión en móvil/emulador de sesión, teclado, tablas, imágenes y safe areas; pruebas de escritura controladas con datos ficticios; recuperación de contraseña autorizada; y visor 3D. No se ha generado APK ni proyecto Gradle.


## Continuación — sesión, decimales y caché móvil (10/10/2026)

- **Paginación privada:** `cloud.loadHistory()` comprueba `uid` y `authEpoch` después del conteo y después de cada lote. Una descarga iniciada en una sesión antigua se descarta incluso cuando se vuelve a iniciar sesión con el mismo usuario.
- **Guardado:** `cloud.saveWorkout()` comprueba la sesión antes de invocar `guardar_entrenamiento` y después de obtener su respuesta. Si una sesión cambia mientras la operación está en curso, la respuesta no se presenta como éxito de la sesión nueva; en ese caso, el resultado final de la escritura debe comprobarse con un historial actualizado de la cuenta original.
- **Formulario de series:** peso, repeticiones y asistencias permiten valores decimales mediante `step="any"` y `inputmode="decimal"`. SQL confirmó `numeric(12,2)` para peso, `numeric(10,2)` para repeticiones y asistencias.
- **Compatibilidad con historial:** en las 18.526 series actuales existen **2.272 pesos fraccionarios**, **1.550 repeticiones fraccionarias** y **2 asistencias fraccionarias** (lectura agregada; no se expusieron datos individuales).
- **Service worker:** la versión `gymlytics-mobile-v0.4-20261010` elimina únicamente versiones previas con prefijo `gymlytics-mobile-`. No borra cachés de otras apps del mismo origen. La interceptación y persistencia se restringieron a un inventario explícito de archivos estáticos y no comprenden URLs de recuperación con parámetros ni llamadas de API.
- **Pruebas agregadas:** `save-workout-epoch.test.mjs`, caso adicional en `history-cloud-isolation.test.mjs` y `service-worker-isolation.test.mjs`.
- **Evidencia CI:** ejecución [38083367124](https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38083367124): **66 pruebas aprobadas, 0 fallidas**, junto a validación de sintaxis y ausencia de artefactos.
- **Conservación de datos:** tras estos cambios continúan **2 usuarios, 18.526 series, 6.218 reportes y 0 fotos** en ProyectosPrueba. `main` no se editó y no se hizo build ni APK.

### Límites de lo validado

Estas pruebas de Node y la auditoría SQL no equivalen a ensayos de inicio de sesión real o verificación en hardware Android. Todavía se necesita la prueba de HTTPS con JWT de ambas cuentas, control de escritura con datos ficticios, retorno autorizado de recuperación de contraseña y ensayo real del diseño móvil. También está pendiente una solución robusta para recuperar archivos huérfanos si Storage completa una subida exactamente cuando cambia la sesión.


## Continuación — integridad de borrado y privacidad de transición

En la rama `Android-Gymlytics` se incorporaron las siguientes correcciones sin compilar la aplicación ni realizar escrituras en Supabase:

- **Borrado verificable**: `GymCloud.deleteSeries` usa la respuesta de `.delete().eq('id',id).eq('user_id',uid).select('id')` y exige una fila eliminada. Un error de RLS o una eliminación de cero filas no produce una confirmación falsa. Se conserva el filtro por propietario y se verifica la versión de sesión.
- **Respaldo JSON**: se conectó `exportJson` al botón de la pantalla **Tablas**. La exportación incluye el historial que está cargado en memoria; es una copia local descargable, **no** una restauración automática ni una escritura en la base de datos.
- **Cambio de identidad inmediato**: `applyState` limpia, antes de consultar el perfil nuevo, los registros, fotografías y catálogos cargados del usuario anterior, descarta los borradores, oculta el perfil y cambia a la pantalla Sesión. Si el acceso del nuevo usuario falla, los datos antiguos permanecen ocultos.
- **Pruebas**: `tests/export-delete-confirmation.test.mjs` y `tests/auth-transition-privacy.test.mjs` comprueban borrado efectivo, borrado inexistente, errores, descarga JSON, transición A→B pendiente y perfil B sin autorización.
- **Última ejecución**: [GitHub Actions 38102608652](https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38102608652), **75/75 pruebas aprobadas**, cero fallidas, sintaxis correcta y ausencia de artefactos de compilación.
- **Lectura SQL posterior**: se mantienen exactamente **2 usuarios**, **6.218 reportes**, **18.526 series**, **0 filas de fotografías** y **15/15 tablas con RLS** en Supabase Pruebas.
- **Ramas**: `main` sigue en `7642f8eac9623892e7d292b2b49f81d14d76e2b1`; solo se modificó `Android-Gymlytics`.

**Limitaciones:** la validación HTTP autenticada con dos cuentas reales, el flujo en un dispositivo Android, las operaciones de escritura de entrenamiento con datos de ensayo y el manejo definitivo de archivos huérfanos en Storage permanecen sin ejecutar o resolver. Ninguna prueba automatizada reemplaza estas verificaciones.


## Continuación — integración HTTP pública y operaciones de catálogo

**Fecha local: 10/10/2026.** Cambios efectuados solamente en `Android-Gymlytics` y sin compilar APK.

1. **Exportación JSON**: se eliminó el controlador duplicado del botón. Una pulsación no debe generar dos copias.
2. **Operaciones de catálogo**: `addIndependentItem`, `saveCustomExercise` y sus formularios mantienen el `uid` y `authEpoch` de la solicitud; un resultado de A no puede recargar el catálogo, borrar campos ni mostrar un mensaje de éxito en la sesión B. Se probaron también inicios de sesión repetidos de la misma cuenta.
3. **Fotos tras cambio de sesión**: si un archivo terminó de subirse cuando la sesión original ya no es vigente, la aplicación realiza un intento de eliminación del archivo antes de rechazar la operación. Es **limpieza de mejor esfuerzo**: una nueva identidad podría carecer de permisos para eliminar ese archivo. No se considera una solución garantizada a archivos huérfanos.
4. **Conexión HTTP realmente observada**: GitHub Actions hizo `GET https://jasuqnxrskhqfobsazwd.supabase.co/auth/v1/health` **sin apikey** y recibió **HTTP 401**. Esto prueba la respuesta HTTP del *gateway*, **no** la salud de Auth ni el inicio de sesión. El paso CI se describe como comprobación de gateway, no de autenticación.
5. **Prueba autenticada preparada, sin ejecutar**: `tools/validar-data-api.mjs` exige clave publicable configurada fuera del repositorio; valida primero `/auth/v1/health` con respuesta 200 antes de probar acceso anónimo y, cuando existan credenciales privadas de prueba, login y aislamiento por RLS entre dos cuentas. No se enviaron contraseñas ni JWT.
6. **Último CI**: [38103429903](https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38103429903), **84 pruebas automatizadas aprobadas, cero fallidas**. Se comprueba también sintaxis JS y ausencia de artefactos compilados.
7. **Conservación SQL**: 2 usuarios, **18.526 series**, **6.218 reportes**, 0 filas de fotos, 0 objetos en bucket privado `gymlog-usuarios`, y **15/15 tablas con RLS**. Las consultas fueron solo de lectura; Producción y `main` permanecen sin cambios.

**Siguiente bloqueo auténtico de la Fase 2:** falta ejecutar una sesión HTTP de prueba con clave publicable y dos identidades reales, sin compartir contraseñas en el chat. Después vendrán las operaciones ficticias de escritura reversibles y las pruebas de interfaz en dispositivo Android. No se autorizó ni realizó compilación APK.


## Continuación — protección de valores numéricos y exportaciones

**Fecha:** 10/10/2026. Esta revisión solo modifica la rama `Android-Gymlytics`. No se compila APK ni se modifica la base.

- **Precisión de series:** `web/app.js` valida las tres columnas antes del guardado. Solo acepta números no negativos con cero, uno o dos decimales; las repeticiones deben ser mayores a cero. Respeta `peso numeric(12,2)`, `repeticiones numeric(10,2)` y `asistencias numeric(10,2)`. Se admiten valores como `6.5`, `1.25`, `.5`, peso `0` y kilogramos o libras.
- **Validación antes de escribir:** `cloud.saveWorkout()` realiza también el control de entradas sin confiar solo en el formulario. Rechaza `NaN`, `Infinity`, negativos, precisión superior a dos decimales, valores fuera del límite numérico y unidades distintas de `kg`/`lb` **antes de ejecutar `ensureExercise`**, impidiendo altas auxiliares accidentales por datos inválidos.
- **CSV:** `exportCsv()` antepone un apóstrofo a textos cuyo contenido, incluso precedido por espacios o controles, pudiera ejecutarse como fórmula al abrir en hojas de cálculo (`=`, `+`, `-`, `@`). Mantiene el formato separado por punto y coma, el BOM UTF-8 y los números válidos. La exportación JSON no cambia.
- **Pruebas nuevas:** `tests/series-data-integrity.test.mjs` incluye cinco escenarios para límites decimales, validación anterior a la creación de tablas auxiliares y neutralización del CSV. Se ajustaron `tests/save-session-isolation.test.mjs` y `tests/history-pagination.test.mjs` para ejecutar el validador real.
- **CI:** [ejecución 38107904471](https://github.com/datapublicm/AplicativoGymWebGit/actions/runs/38107904471), **89/89 pruebas aprobadas**, 0 fallidas, sin artefactos compilados.
- **Supabase Pruebas, comprobación SQL posterior:** 2 cuentas, **18.526 series**, **6.218 reportes**, 0 fotos en `tbl_fotos`, 0 objetos en bucket `gymlog-usuarios`; **15/15 tablas con RLS**. Todas las consultas fueron de lectura.

**Pendientes reales:** prueba HTTPS de extremo a extremo con JWT de dos cuentas autorizadas, escrituras de ensayo controladas y comprobación funcional/visual en Android real. La validación SQL de roles simulados documentada en `VALIDACION_RLS_2026-10-10.md` sigue siendo distinta de una sesión JWT real. No se ha compilado la APK.
