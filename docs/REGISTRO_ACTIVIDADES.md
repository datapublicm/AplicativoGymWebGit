# Registro de actividades — AplicativoGym

Este documento conserva el historial operativo del proyecto.

## Regla de registro
Desde el 30/09/2026 a las 21:34 (hora de Perú, UTC-5), cada avance relevante debe registrar:
- fecha;
- hora de Perú;
- tarea o fase;
- acción realizada;
- archivo(s) o carpeta(s) afectados;
- resultado;
- siguiente paso.

Formato de hora: `DD/MM/YYYY HH:MM` (Perú, UTC-5).

> Las actividades anteriores a la adopción de esta regla conservan su fecha, pero no se les asigna una hora retroactiva inventada.

---

## 30/09/2026 — actividades previas sin hora registrada

### Limpieza previa a Task 13.2B-v5.0
- Se retiraron del flujo activo los scripts y dependencias del pipeline anterior basado en MakeHuman y generación Python.
- Se eliminó `requirements-model.txt`.
- Se retiró el plan antiguo `docs/superpowers/plans/2026-09-29-v05-dual-anatomy-web.md`.
- Se actualizó `README.md` para reflejar la nueva dirección de modelado.
- Se actualizó `.github/workflows/pages.yml` para que el despliegue web ya no ejecute el pipeline Python retirado.
- Se conservaron intactos el visor, catálogo de ejercicios, lógica de músculos, rotación y zoom.

### Organización de referencias v5.0
- Se confirmó la estructura de Drive `01_Modelos_3D/Task_13.2B-v5.0/`.
- Se guardaron cuatro referencias visuales aprobadas dentro de `01_Referencias/`.
- Entre los archivos guardados figuran:
  - `v5_referencia_masculina_diseno_anatomico.png`
  - `v5_referencia_femenina_diseno_anatomico.png`
  - `v5_referencia_visual_03.png`
  - `v5_referencia_visual_04.png`
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

---

## 30/09/2026 21:34 — hora de Perú

### Registro de actividades formalizado
- **Acción:** se actualizó el documento permanente de seguimiento del proyecto para incluir fecha y hora en cada actividad futura.
- **Archivo:** `docs/REGISTRO_ACTIVIDADES.md`.
- **Resultado:** a partir de esta entrada, todo archivo creado, guardado, modificado o eliminado deberá quedar identificado con su fecha y hora de Perú, junto con una descripción breve de la acción.
- **Siguiente paso:** continuar Task 1 con el perfil lateral femenino y registrar el resultado con nueva marca de fecha y hora.
