import { EXERCISE_CATEGORIES, filterExercises, } from '../domain/exercises.js';
export function createExercisePanel(container, onSelect) {
    let query = '';
    let category = 'Todos';
    let selectedId = '';
    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'exercise-search';
    search.placeholder = 'Buscar ejercicio…';
    search.setAttribute('aria-label', 'Buscar ejercicio');
    search.dataset.testid = 'exercise-search';
    const categories = document.createElement('div');
    categories.className = 'category-list';
    categories.setAttribute('aria-label', 'Filtrar por grupo');
    const list = document.createElement('div');
    list.className = 'exercise-list';
    list.dataset.testid = 'exercise-list';
    const empty = document.createElement('p');
    empty.className = 'exercise-empty';
    empty.textContent = 'No hay ejercicios con ese filtro.';
    empty.hidden = true;
    const categoryButtons = new Map();
    const render = () => {
        const visible = filterExercises(query, category);
        const fragment = document.createDocumentFragment();
        for (const exercise of visible) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'exercise-button';
            button.dataset.exerciseId = exercise.id;
            button.setAttribute('aria-pressed', String(exercise.id === selectedId));
            button.innerHTML = `<span>${exercise.name}</span><small>${exercise.category}</small>`;
            button.addEventListener('click', () => void onSelect(exercise));
            fragment.append(button);
        }
        list.replaceChildren(fragment);
        empty.hidden = visible.length !== 0;
        for (const [key, button] of categoryButtons)
            button.setAttribute('aria-pressed', String(key === category));
    };
    for (const item of EXERCISE_CATEGORIES) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-button';
        button.dataset.category = item;
        button.textContent = item;
        button.setAttribute('aria-pressed', String(item === category));
        button.addEventListener('click', () => {
            category = item;
            render();
        });
        categoryButtons.set(item, button);
        categories.append(button);
    }
    search.addEventListener('input', () => {
        query = search.value;
        render();
    });
    const excelNote = document.createElement('p');
    excelNote.className = 'excel-note';
    excelNote.textContent = 'Incluye nombres reconocidos de tu historial Excel.';
    container.replaceChildren(search, categories, list, empty, excelNote);
    render();
    return {
        setSelected(id) {
            selectedId = id;
            render();
        },
        dispose() { container.replaceChildren(); },
    };
}
