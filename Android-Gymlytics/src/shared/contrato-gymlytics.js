// Contrato documental de las tres plataformas: no implementa una segunda base de datos.
// Usar estos nombres desde web y Capacitor cuando se integre el adaptador de la app.
export const GYMLYTICS_SCHEMA = 'sch_android_gymlytics';
export const GYMLYTICS_APP = 'gymlytics';
export const GYMLYTICS_TABLES = Object.freeze({
  users:'tbl_usuarios', gyms:'tbl_gimnasios', branches:'tbl_sedes',
  exercises:'tbl_ejercicios', workouts:'tbl_reportes', sets:'tbl_series',
  photos:'tbl_fotos', muscles:'tbl_musculos',
  exerciseMuscles:'tbl_ejercicio_musculos', anatomyImages:'tbl_musculo_imagenes',
  anatomy3d:'tbl_musculo_zonas3d'
});
export const GYMLYTICS_STORAGE = Object.freeze({
  userPhotos:'gymlog-usuarios', sharedAnatomy:'gymlog-anatomia'
});
export const GYMLYTICS_WORKOUT_RPC = 'guardar_entrenamiento';
