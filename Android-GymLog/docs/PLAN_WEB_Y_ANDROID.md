# Plan de implementación y criterios de aceptación

- **Sesión:** entrada con correo y contraseña. Sin sesión autorizada no se accede a Catálogos/Registro/Tablas/Dashboard. El perfil de usuario simple nunca puede administrar otras cuentas.
- **Catálogos:** todos los ejercicios predefinidos como referencia, más gimnasios, sedes y ejercicios privados por persona. La relación músculo–ejercicio se almacena por ID.
- **Registro:** peso, unidades, repeticiones y asistencias; modo normal, Sub1/Sub2, derecha/izquierda; hasta 12 series de grupo y guardado transaccional.
- **Tablas y Dashboard:** consultan Supabase, no una base local aislada. Cambios guardados desde cualquiera de las tres versiones deben aparecer al volver a consultar desde las demás.
- **Visor:** popup de Fotos/2D frontal-posterior y 3D. Ambos visibles aunque sin datos; solo mostrar imágenes o partes 3D cuando estén efectivamente vinculadas.
- **Android:** appId `com.datapublicm.gymlog`; Capacitor envuelve el resultado del mismo build web.
- **GitHub Pages y Hostinger:** mismo contenido generado en `dist/`; se pueden distribuir con diferentes despliegues, no con diferentes bases de datos.

**Sin build Android ni APK hasta nueva autorización.**
