# GymLog: contrato de integración (Pruebas, sin compilar)

El proyecto GymLog tendrá **una sola fuente web** y tres presentaciones: GitHub Pages, Hostinger y Android/Capacitor. Las tres compartirán la misma base Supabase dentro del entorno seleccionado. Pruebas y Producción son proyectos diferentes; **no se han hecho cambios en Producción**.

## Estado de Pruebas

Proyecto Supabase: `jasuqnxrskhqfobsazwd`; esquema: `sch_android_gymlog`.

Once tablas: `tbl_usuarios`, `tbl_gimnasios`, `tbl_sedes`, `tbl_ejercicios`, `tbl_reportes`, `tbl_series`, `tbl_fotos`, `tbl_musculos`, `tbl_ejercicio_musculos`, `tbl_musculo_imagenes` y `tbl_musculo_zonas3d`.

La cuenta Anthony está autorizada con rol de usuario simple. La identidad se valida con Supabase Auth; para acceso a datos se exige perfil GymLog activo más acceso vigente en `app_core.user_app_access`. El resto de las tablas de GymLog tienen RLS restrictivo.

Los entrenamientos se registran con la función **transaccional** `sch_android_gymlog.guardar_entrenamiento` que guarda reporte y series en un solo paso. Las series normales, Sub1/Sub2 y Derecha/Izquierda se representan mediante `tbl_series.subdivision`.

## Almacenamiento

- `gymlog-anatomia` — bucket privado para fotografías compartidas y modelos 3D (vacío por ahora).
- `gymlog-usuarios` — bucket privado para fotografías personales. Ruta obligatoria: `<auth.uid()>/<uuid>.jpg`. RLS evita acceder a archivos ajenos.
- `tbl_fotos.vista` distingue vistas frontal, posterior y lateral.
- `tbl_ejercicio_musculos` define primarios/secundarios por su ID; `tbl_musculo_imagenes` y `tbl_musculo_zonas3d` definen los recursos visuales. No inventar IDs cuando estén vacíos.

## Pendiente antes de probar los clientes

1. Incorporar el código completo de la carpeta `web/` del paquete generado en esta conversación. La rama actual contiene solo los archivos de preparación: **no es aún un sitio desplegable ni un APK**.
2. Comprobar o habilitar `sch_android_gymlog` en los esquemas expuestos de Supabase Data API (PostgREST); no alterar las demás apps.
3. Configurar `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_SUPABASE_SCHEMA`; nunca usar `service_role` en cliente.
4. Autorizar URLs de retorno de GitHub Pages, Hostinger y Android en Auth.
5. Probar sesión real, series, catálogos, RLS, fotos y vista 3D pendiente.
6. Solo tras autorizar: instalar dependencias, compilar web, inicializar Gradle y compilar APK.

No se ha instalado ninguna dependencia ni compilado nada.
