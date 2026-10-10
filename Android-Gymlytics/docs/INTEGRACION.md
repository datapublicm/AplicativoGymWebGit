# Contrato de integración Gymlytics v0.2 — sin compilar

## Fuentes y destinos

- Código web en `web/` (única fuente de interfaz) → Vite `dist/` **posteriormente**.
- Deploy 1: GitHub Pages (estático).
- Deploy 2: Hostinger (mismo resultado web `dist/`).
- Android: Capacitor apuntando al mismo `dist/`; se creará `android/` **posteriormente** sin compilar hasta permiso.
- En Pruebas los tres clientes deben utilizar proyecto Supabase `jasuqnxrskhqfobsazwd`, esquema `sch_android_gymlytics`.
- En Producción deben utilizar **otro** proyecto, pero las tres plataformas volverán a compartir un solo backend de Producción.

## Controles de seguridad

- `auth.users` comprueba identidad. `sch_android_gymlytics.tbl_usuarios` + `app_core.user_app_access` comprueba permiso y perfil (Anthony: usuario simple).
- RLS restrictivo de Gymlytics valida cuenta activa y acceso a la aplicación.
- `tbl_usuarios` no admite creación directa de perfiles desde clientes autenticados; requiere provisión administrativa.
- Supabase Data API debe exponer el esquema personalizado para consultar tablas/RPC. **Verificación real pendiente**.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_SCHEMA` se inyectan en build (solo clave publicable). Jamás service_role.
- Añadir orígenes autorizados y redirects de GitHub Pages, Hostinger y Android en Auth antes de pruebas.

## Flujo de registros

1. Crear/buscar gimnasio, sede y ejercicio del usuario.
2. Enviar series a `sch_android_gymlytics.guardar_entrenamiento(...)` para transacción indivisible.
3. Recargar historial desde `tbl_reportes` y `tbl_series`.
4. Consultar tablas anatómicas y relación por ID. El 3D puede permanecer vacío.

## Imágenes

- `gymlog-anatomia`: bucket **privado** de referencias anatómicas y modelos GLB (actualmente vacío).
- `gymlog-usuarios`: bucket **privado** de fotos particulares, rutas `UID/<uuid>.jpg`.
- `tbl_fotos` registra origen, vista (frontal/posterior) y ruta personal.
- `tbl_musculo_imagenes` registra fotos compartidas y `tbl_musculo_zonas3d` contiene mapeo músculo→parte del modelo para el futuro visor.

## Pruebas por completar

1. Configurar esquema expuesto y clave publicable.
2. Probar en navegador correo autenticado y comprobar acceso RLS a datos propios.
3. Guardar ejercicio personal; comprobar creación de gym/sede/ejercicio.
4. Guardar series; simular error para verificar reversión de reporte.
5. Subir fotografía y comprobar URL temporal privada.
6. Verificar el mismo historial en GitHub Web, Hostinger Web y APK.
7. Integrar GLB de visor 3D desde el módulo antiguo `site/viewer` y ajustar sus partes a IDs de Supabase.

**No se han generado builds ni instalado dependencias en esta fase.**


**Nota de migración del nombre (10/10/2026):** Los depósitos privados de fotografías conservaron los identificadores `gymlog-usuarios` y `gymlog-anatomia`; las políticas de Storage no se pueden renombrar con el rol actual. Gymlytics los sigue utilizando. El nombre del esquema SQL sí cambió a `sch_android_gymlytics`, al igual que el registro de la app. 
