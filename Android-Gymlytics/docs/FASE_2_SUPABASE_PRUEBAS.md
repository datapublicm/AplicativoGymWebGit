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
