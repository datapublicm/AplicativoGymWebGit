# Registro de actividades — AplicativoGym

Este documento conserva el historial operativo del proyecto. Cada avance relevante debe añadir una nueva entrada con fecha, tarea, cambios realizados, archivos afectados y siguiente paso.

## 2026-09-30

### Limpieza previa a Task 13.2B-v5.0
- Se retiraron del flujo activo los scripts y dependencias del pipeline anterior basado en MakeHuman y generación Python.
- Se eliminó `requirements-model.txt`.
- Se retiró el plan antiguo `docs/superpowers/plans/2026-09-29-v05-dual-anatomy-web.md`.
- Se actualizó `README.md` para reflejar la nueva dirección de modelado.
- Se actualizó `.github/workflows/pages.yml` para que el despliegue web ya no ejecute el pipeline Python retirado.
- Se conservaron intactos el visor, catálogo de ejercicios, lógica de músculos, rotación y zoom.

### Organización de referencias v5.0
- Se confirmó la estructura de Drive `01_Modelos_3D/Task_13.2B-v5.0/`.
- Se guardaron las cuatro referencias visuales aprobadas dentro de `01_Referencias/`.
- Se mantiene separada la nueva fase de los diseños fallidos anteriores.

### Task 1 — Referencias y proporciones
- Se inició la extracción de proporciones normalizadas antes de construir cualquier nueva malla.
- Primer bloque registrado: modelo femenino, vista frontal.
- Valores preliminares normalizados sobre altura total = 1.00:
  - cabeza ≈ 0.12
  - ancho de hombros ≈ 0.27
  - ancho de pecho ≈ 0.25
  - ancho de cintura ≈ 0.17
  - ancho de pelvis ≈ 0.23
- También se fijaron los niveles verticales principales para mentón, hombros, cintura, cadera, rodilla y tobillo.

### Siguiente paso
- Completar el perfil lateral femenino.
- Consolidar frontal + lateral en un único perfil de proporciones.
- Repetir el mismo procedimiento con el modelo masculino.
- No iniciar la malla Quad hasta cerrar y documentar las proporciones de referencia.
