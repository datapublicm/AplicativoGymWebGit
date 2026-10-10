# GymLog — Importación del historial del Excel (Pruebas)

Fuente: `Chat_Salud_Deporte v2.5(1).xlsx`, hoja `BD_Filter_Extend`.

La importación fue realizada **solo para la cuenta Anthony** en Supabase ProyectosPrueba. No se importaron entrenamientos a la cuenta de demostración `prueba`.

## Resultado de la migración

- Rango histórico: **03/07/2025 a 08/10/2026**.
- Registros de entrenamiento: **3,109** en `tbl_reportes`.
- Series: **9,263** en `tbl_series` (incluidas **300** subdivididas).
- Catálogos personales: **3 gimnasios, 16 sedes y 139 variantes de ejercicio**.
- Músculos: **35 registros con UUID** y **305 relaciones con ejercicios**.
- Catálogo base compartido, existente antes de la carga: **242 filas**.
- Se conservaron repeticiones y asistencias decimales (se alteró la definición de columnas a `numeric(10,2)`).
- Se conservaron fecha original local, técnica, ejercicio, equipo, gimnasio, sede y trazabilidad `origen_excel` / `fila_excel`.
- **8 filas sin nombre de ejercicio o instrumento** quedaron excluidas: 2548–2552 y 2885–2887 en la hoja de origen. No se fabricaron datos para completarlas.
- La vista `vw_historial_series` aplica la seguridad RLS del usuario e incluye paginación en la app.

## Aclaraciones

- No se ha importado la tabla de mensajes completa ni se ha replicado el historial en la cuenta `prueba`.
- Fotografías y anatomía 3D se incorporarán después; los músculos existentes todavía requieren revisar su normalización anatómica.
- No se alteró el proyecto Supabase de Producción.
- Cargas sucesivas desde el Excel deben usar el identificador `origen_excel`/ `fila_excel` para evitar duplicados.
