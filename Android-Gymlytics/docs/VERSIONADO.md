# Gymlytics — Política de versionado

Numeración **visible al usuario**: `MM.mm` (dos dígitos, punto, dos dígitos), sin prefijo `v`.
Ejemplos de mantenimiento: `01.01` → `01.02` → `01.03` → `01.04`.
Al pasar a una etapa principal: `02.01` → `02.02` (no `02.00`).

## Versión vigente
**01.05 — Última APK compilada y versión principal Android** (15/10/2026).

**01.06 — Preparada en `apk/pruebas`, sin compilar.**
Modo offline-first, perfiles múltiples, respaldo íntegro, sincronización manual versionada e idempotente de series y advertencias ante cambios desde clientes antiguos.

La compilación `compilar-gymlytics-01.06-pruebas.yml` se ejecuta **solo manualmente**. Genera un paquete independiente `com.datapublicm.gymlytics.pruebas` («Gymlytics Pruebas») con `versionCode 6` y `versionName 01.06`: puede convivir con la 01.05 y no actualiza ni borra su instalación.

**Precaución:** la 01.05 se distribuyó con firma de depuración generada en la compilación, sin una clave privada estable documentada. Una APK nueva con firma diferente podría no poder actualizarla en el mismo paquete. No desinstalar la 01.05 ni prometer migración automática. La futura distribución principal requiere una estrategia de firma y migración validada, o respaldos completos recuperables.

La APK original `Gymlytics-v0.1.3-Pruebas-debug.apk` se distribuyó inicialmente con una denominación ajena a este formato.
Se corrigió el **nombre externo de distribución**, sin alterar ni recompilar sus bytes, a `Gymlytics_01.03_Pruebas.apk`.
Su versión **interna** todavía corresponde a la generación anterior; el cambio de versionName Android requiere un nuevo build.

## Requisitos antes del siguiente build
1. Actualizar la versión visible de Android (`versionName`) a la numeración `MM.mm` aprobada y asignar `versionCode` creciente (para esta secuencia, 3 en 01.03, 4 en 01.04, etc.).
2. Actualizar el nombre del artefacto y el APK en `.github/workflows/compilar-gymlytics-debug.yml`, sin prefijo `v` y sin formato SemVer expuesto al usuario.
3. Mantener un único número de versión en la distribución APK, el README y los comunicados. La versión técnica de `package.json` debe respetar SemVer para npm; no se utiliza como etiqueta comercial.
4. Incrementar la subversión solo cuando haya una nueva entrega; reiniciarla en `01` al cambiar de etapa principal.
5. Mantener la rama `main` intacta y no integrar el modelo humano 3D hasta nueva autorización.

> 01.04 conservada en `apk/versiones-anteriores/v01.04`. La compilación 01.05 está en `Android-Gymlytics` y `apk/pruebas_01.05`. Los cambios 01.06 existen únicamente en `apk/pruebas`; el workflow de compilación sigue fijado deliberadamente a 01.05 y no debe ejecutarse para esta rama hasta autorizar la próxima APK.
