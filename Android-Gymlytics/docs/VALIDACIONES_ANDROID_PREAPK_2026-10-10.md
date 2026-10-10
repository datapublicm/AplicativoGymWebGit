# Gymlytics — validaciones previas a APK (10/10/2026)

**Ámbito:** rama `Android-Gymlytics`, carpeta `Android-Gymlytics/` y Supabase **ProyectosPrueba** (`jasuqnxrskhqfobsazwd`). Esta verificación no autoriza compilación, despliegue, modificación de `main` ni acceso a Producción.

## Identidad y separación verificadas

- Repositorio: `datapublicm/AplicativoGymWebGit`.
- `main` observado antes de trabajar: `7642f8eac9623892e7d292b2b49f81d14d76e2b1`. **No se realizaron escrituras en esta rama.**
- Existe la rama `Android-Gymlytics`; la antigua rama `Android-GymLog` ya no aparece.
- Existe la carpeta `Android-Gymlytics/`; no se encontraron carpetas Android duplicadas en la raíz de esta rama.
- `package.json`: `gymlytics`; Capacitor: `com.datapublicm.gymlytics`; manifest: `Gymlytics`.
- Esquema: `sch_android_gymlytics`; no aparece el esquema antiguo al consultar nombres de esquemas que contienen «gym».
- **Precaución:** GitHub informa `protected: false` para `main`. Esto no implica que se haya modificado; simplemente aún no existe protección de rama configurada.

## Base de datos de Pruebas (lecturas, no escrituras)

- 15 tablas en `sch_android_gymlytics`, todas con RLS habilitado.
- La vista `vw_historial_series` tiene `security_invoker = true`.
- Registros observados: **18.526 series**, **6.218 reportes**, **2 usuarios**.
- Función transaccional `guardar_entrenamiento` existente, con ejecución concedida al rol `authenticated`.
- Edge Function `gymlytics-login-usuario` desplegada y activa. El código valida datos de entrada, comprueba el límite de intentos y usa Supabase Auth para iniciar sesión, pero **no se invocó con credenciales reales**.
- Los buckets privados `gymlog-usuarios` y `gymlog-anatomia` aún tienen el nombre heredado, por las políticas de Storage. Es una excepción conocida: no renombrar ni duplicar sin migración autorizada.
- Aviso de seguridad del proyecto: protección contra contraseñas filtradas desactivada en Supabase Auth. No se modificó porque afecta al proyecto compartido.

## Validación de código sin compilación

- Se incorporó `tests/preapk-regression.test.mjs` para comprobar el contrato de Pruebas, los identificadores, los flujos de login y que CI no incluya compilación.
- La verificación puntual de **18 condiciones estáticas sobre los archivos de GitHub** devolvió 18/18 correctas.
- La ejecución del nuevo test mediante Node/GitHub Actions debe verificarse aparte; las afirmaciones anteriores **no equivalen** a un test E2E de Android.
- El workflow `.github/workflows/validar-android-gymlytics.yml` únicamente comprueba sintaxis, ejecuta pruebas Node y verifica ausencia de artefactos.
- No se instaló ninguna dependencia, no se hizo build web, no se creó proyecto Gradle y **no se compiló APK**.

## Validaciones funcionales pendientes

- [ ] Configurar la **clave publicable** y la URL del proyecto de Pruebas en un entorno privado, sin `service_role` en el cliente.
- [ ] Confirmar acceso real al esquema personalizado vía PostgREST desde un cliente autenticado.
- [ ] Probar login con correo y con nombre de usuario, cierre y restauración de sesión en Android.
- [ ] Comprobar que cuenta A solo recupera sus 9.263 series y no recibe información de cuenta B.
- [ ] Probar creación independiente de gimnasio, sede, máquina y ejercicio, más guardado atómico y reversión ante error.
- [ ] Probar subida de fotos privadas, URL firmada y bloqueo del acceso cruzado.
- [ ] Configurar y verificar un retorno HTTPS autorizado para restablecer contraseñas.
- [ ] Integrar y validar el visor 3D con sus relaciones musculares.
- [ ] Verificar ejecución de las pruebas Node en CI. No usar un workflow que compile Gradle.
- [ ] Antes de instalar paquetes, revisar versiones fijadas y generar un lockfile reproducible.

**Próximo paso permitido:** validación de integración web/Android sin producir una APK y sin escribir en Producción. Los cambios de base de datos, publicación y compilación quedan fuera de esta fase.
