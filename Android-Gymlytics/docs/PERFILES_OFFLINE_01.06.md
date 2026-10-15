# Gymlytics 01.06 · Bloque 2 — perfiles locales y cuentas independientes

Rama: `apk/pruebas`. Última APK entregada: 01.05. No instalar, compilar ni fusionar la 01.06 hasta autorización.

## Funcionalidad implementada
- Un primer perfil `Mi perfil` se crea sin cuenta ni conexión. Otras personas pueden crear perfiles locales independientes y elegir el perfil activo desde la pestaña **Perfil**.
- Un perfil se identifica internamente por un UUID; cambiar su nombre **no cambia el ID ni sus series, fotos, catálogos, operaciones pendientes, lápidas o asociación cloud**.
- Las escrituras del perfil anterior terminan antes del cambio de usuario. Durante el cambio se bloquean nuevas escrituras; luego se borran de memoria los modelos y fotografías visibles de A **antes** de mostrar B.
- El cliente Supabase en memoria se rota en cada cambio de perfil: las credenciales de A no se reutilizan en B. Cada nuevo inicio de sesión se comprueba contra la identidad del perfil activo.
- La vinculación de nube es opcional y expresa: **Vincular este perfil con esta cuenta**. No provoca subida ni descarga. Es imposible asociar dos perfiles del mismo dispositivo con la misma cuenta o vincular un perfil ya asociado a una cuenta distinta.
- El respaldo JSON conserva el historial, catálogos personales, fotos, borrados y cola de operaciones; espera a que termine el último guardado antes de exportar.
- Restaurar crea otro perfil y no sobrescribe ningún perfil anterior. Un respaldo vinculado a una cuenta que ya existe en este dispositivo es rechazado: no puede producir dos propietarios locales de una misma cuenta.
- Las operaciones de sincronización del Bloque 1 siguen manuales, con conflictos y versiones. El cambio de perfil queda bloqueado mientras una sincronización esté activa.

## Restricciones y condiciones de uso
1. Los perfiles aíslan información a nivel de **aplicación**; **no** constituyen cuentas seguras con autenticación individual ni cifrado de extremo a extremo de cada perfil. Cualquiera con acceso desbloqueado al mismo dispositivo puede seleccionar otro perfil.
2. Los datos locales se conservan entre aperturas y actualizaciones que no borren los datos de la app. **Desinstalar o borrar datos puede destruirlos**; exportar respaldos primero.
3. No se eliminan perfiles desde esta fase, para impedir borrados accidentales. Se puede crear, renombrar y alternar entre perfiles.
4. No se suben aún fotos, catálogos ni ajustes personales al backend; siguen locales y figuran como operaciones pendientes.
5. El actual motor de sincronización solo garantiza versiones entre clientes que utilicen la capa nueva. Las versiones web antiguas deben adecuarse antes de afirmar sincronización completa.
6. No se han ejecutado todavía pruebas manuales con dos móviles ni actualización/reinstalación real del paquete Android. Corresponden al Bloque 3.

## Plan de prueba pendiente
- Dos o más perfiles creados sin conexión con historiales distintos.
- Cambiar de A a B durante el guardado, la carga de una fotografía, el renombrado y la exportación.
- Dos cuentas de Supabase diferentes, con vinculación expresa; prohibir la misma cuenta en dos perfiles.
- Cerrar sesión y alternar perfiles sin exponer datos ajenos.
- Restaurar perfil con y sin nube; rechazar conflicto de cuenta duplicada.
- No sincronizar por volver a tener Internet o abrir Perfil; descargar/subir solo mediante acción confirmada.
