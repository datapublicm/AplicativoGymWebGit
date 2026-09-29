import { getExerciseById } from '../domain/exercises.js';
import { MUSCLE_LABELS } from '../domain/muscles.js';
import { createExercisePanel } from '../ui/exercisePanel.js';
import { createViewer } from '../viewer/createViewer.js';
function muscleLabels(ids) {
    return ids.length ? ids.map((id) => MUSCLE_LABELS[id]).join(' · ') : '—';
}
function renderExerciseDetail(container, exercise) {
    const excelBadge = exercise.historyAliases?.length
        ? '<span class="detail-source">Historial Excel</span>'
        : '';
    container.innerHTML = `
    <div class="detail-head">
      <div><span class="detail-category">${exercise.category}</span><h3>${exercise.name}</h3></div>
      ${excelBadge}
    </div>
    <div class="detail-muscles">
      <div><span class="detail-dot detail-dot-primary"></span><div><small>Principal</small><strong>${muscleLabels(exercise.primary)}</strong></div></div>
      <div><span class="detail-dot detail-dot-secondary"></span><div><small>Secundarios</small><strong>${muscleLabels(exercise.secondary)}</strong></div></div>
    </div>`;
    container.dataset.detailExerciseId = exercise.id;
}
export async function mountApp(root, modelUrl) {
    root.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div><strong>AplicativoGym</strong><span>Visor muscular 3D</span></div>
        <div class="legend"><span class="legend-primary">● Principal</span><span class="legend-secondary">● Secundario</span></div>
      </header>
      <aside class="exercise-sidebar">
        <div class="sidebar-title"><h2>Ejercicios</h2><p>Busca o filtra tu entrenamiento.</p></div>
        <div class="exercise-panel" data-testid="exercise-panel"></div>
      </aside>
      <section class="viewer-shell">
        <div class="viewer-host" data-testid="viewer-host"></div>
        <article class="exercise-detail" data-testid="exercise-detail" aria-live="polite">
          <div class="detail-placeholder"><strong>Selecciona un ejercicio</strong><span>Verás aquí sus músculos principales y secundarios.</span></div>
        </article>
        <div class="viewer-status" role="status">Arrastra para girar · rueda/pinch para zoom</div>
      </section>
    </main>`;
    const shell = root.querySelector('.app-shell');
    const viewerHost = root.querySelector('.viewer-host');
    const panelHost = root.querySelector('.exercise-panel');
    const detail = root.querySelector('.exercise-detail');
    const status = root.querySelector('.viewer-status');
    const viewer = await createViewer(viewerHost, modelUrl);
    let selectionSerial = 0;
    const selectExercise = async (exercise) => {
        const serial = ++selectionSerial;
        panel.setSelected(exercise.id);
        renderExerciseDetail(detail, exercise);
        shell.dataset.pendingExercise = exercise.id;
        status.textContent = `Mostrando ${exercise.name}…`;
        const result = await viewer.selectExercise(exercise);
        if (serial === selectionSerial) {
            shell.dataset.lastExercise = exercise.id;
            shell.dataset.lastRotated = String(result.rotated);
            shell.dataset.missing = result.missing.join(',');
            delete shell.dataset.pendingExercise;
            status.textContent = result.missing.length
                ? `${exercise.name} · faltan zonas: ${result.missing.join(', ')}`
                : `${exercise.name} · ${result.rotated ? 'vista ajustada' : 'vista conservada'}`;
        }
        return result;
    };
    const panel = createExercisePanel(panelHost, selectExercise);
    return {
        viewer,
        async selectExerciseById(id) {
            const exercise = getExerciseById(id);
            if (!exercise)
                throw new Error(`Unknown exercise: ${id}`);
            return selectExercise(exercise);
        },
        dispose() { panel.dispose(); viewer.dispose(); root.replaceChildren(); },
    };
}
