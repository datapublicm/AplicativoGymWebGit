import { getExerciseById } from '../domain/exercises.js';
import { MUSCLE_LABELS } from '../domain/muscles.js';
import { DEFAULT_BODY_VARIANT, getBodyVariant } from '../domain/bodyVariants.js?v=0.5.2';
import { requestBodyVariantChange } from '../domain/bodyVariantSelection.js?v=0.5.2';
import { createExercisePanel } from '../ui/exercisePanel.js';
import { createBodyVariantSelector } from '../ui/bodyVariantSelector.js?v=0.5.2';
import { createViewer } from '../viewer/createViewer.js?v=0.5.2';
import { switchViewerModel } from '../viewer/switchModel.js?v=0.5.2';

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
export async function mountApp(root, initialBodyVariant = DEFAULT_BODY_VARIANT) {
    const initialVariant = getBodyVariant(initialBodyVariant);
    root.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div><strong>AplicativoGym <span class="app-version">v0.5.2</span></strong><span>Visor muscular 3D</span></div>
        <div class="legend"><span class="legend-primary">● Principal</span><span class="legend-secondary">● Secundario</span></div>
      </header>
      <aside class="exercise-sidebar">
        <div class="sidebar-title"><h2>Ejercicios</h2><p>Busca o filtra tu entrenamiento.</p></div>
        <div class="exercise-panel" data-testid="exercise-panel"></div>
      </aside>
      <section class="viewer-shell">
        <div class="viewer-host" data-testid="viewer-host"></div>
        <div class="body-variant-control" data-testid="body-variant-control"></div>
        <article class="exercise-detail" data-testid="exercise-detail" aria-live="polite">
          <div class="detail-placeholder"><strong>Selecciona un ejercicio</strong><span>Verás aquí sus músculos principales y secundarios.</span></div>
        </article>
        <div class="viewer-status" role="status">Arrastra para girar · rueda/pinch para zoom</div>
      </section>
    </main>`;
    const shell = root.querySelector('.app-shell');
    const viewerHost = root.querySelector('.viewer-host');
    const panelHost = root.querySelector('.exercise-panel');
    const variantHost = root.querySelector('.body-variant-control');
    const detail = root.querySelector('.exercise-detail');
    const status = root.querySelector('.viewer-status');
    const viewer = await createViewer(viewerHost, initialVariant.modelUrl);
    let currentBodyVariant = initialVariant.id;
    let selectedExercise;
    shell.dataset.bodyVariant = currentBodyVariant;
    let selectionSerial = 0;
    const selectExercise = async (exercise) => {
        const serial = ++selectionSerial;
        selectedExercise = exercise;
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
    const variantSelector = createBodyVariantSelector(variantHost, {
        initialId: currentBodyVariant,
        onChange: async (nextId) => {
            const previousId = currentBodyVariant;
            const nextVariant = getBodyVariant(nextId);
            status.textContent = `Cambiando a ${nextVariant.label}…`;
            const effectiveId = await requestBodyVariantChange(previousId, nextId, async (id) => {
                const variant = getBodyVariant(id);
                await switchViewerModel(viewer, variant.modelUrl);
            });
            currentBodyVariant = effectiveId;
            shell.dataset.bodyVariant = effectiveId;
            const effectiveVariant = getBodyVariant(effectiveId);
            status.textContent = effectiveId === nextId
                ? selectedExercise
                    ? `${selectedExercise.name} · ${effectiveVariant.label} · vista conservada`
                    : `${effectiveVariant.label} activo · arrastra para girar`
                : `${effectiveVariant.label} activo · no se pudo cargar ${nextVariant.label}`;
            return effectiveId;
        },
    });
    return {
        viewer,
        async selectExerciseById(id) {
            const exercise = getExerciseById(id);
            if (!exercise)
                throw new Error(`Unknown exercise: ${id}`);
            return selectExercise(exercise);
        },
        getBodyVariantId() { return currentBodyVariant; },
        dispose() {
            variantSelector.dispose();
            panel.dispose();
            viewer.dispose();
            root.replaceChildren();
        },
    };
}
