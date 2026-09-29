export const PREFERRED_VIEWS = ['front', 'front_3q', 'side_left', 'side_right', 'back_3q', 'back'];
export const EXERCISE_CATEGORIES = ['Todos', 'Pecho', 'Espalda', 'Hombros', 'Brazos', 'Piernas', 'Core'];
export const EXERCISES = [
    { id: 'bench-press', name: 'Press banca', category: 'Pecho', primary: ['pectoralis'], secondary: ['triceps', 'deltoid_anterior'], preferredView: 'front_3q' },
    { id: 'chest-press', name: 'Chest press', category: 'Pecho', primary: ['pectoralis'], secondary: ['triceps', 'deltoid_anterior'], preferredView: 'front_3q', historyAliases: ['Chest press', 'Chesse press'] },
    { id: 'biceps-curl', name: 'Curl de bíceps', category: 'Brazos', primary: ['biceps'], secondary: ['forearm'], preferredView: 'front_3q', historyAliases: ['Curl bíceps', 'Curl biceps', 'Curl biseps'] },
    { id: 'hammer-curl', name: 'Curl martillo', category: 'Brazos', primary: ['biceps'], secondary: ['forearm'], preferredView: 'front_3q', historyAliases: ['Martillo'] },
    { id: 'preacher-curl', name: 'Curl predicador', category: 'Brazos', primary: ['biceps'], secondary: ['forearm'], preferredView: 'front_3q', historyAliases: ['Predicador'] },
    { id: 'triceps-extension', name: 'Extensión de tríceps', category: 'Brazos', primary: ['triceps'], secondary: [], preferredView: 'back_3q', historyAliases: ['Extensión triceps', 'Extension triceps'] },
    { id: 'overhead-triceps', name: 'Copa de tríceps', category: 'Brazos', primary: ['triceps'], secondary: [], preferredView: 'back_3q', historyAliases: ['Copa'] },
    { id: 'forearm-curl', name: 'Antebrazo', category: 'Brazos', primary: ['forearm'], secondary: [], preferredView: 'front_3q', historyAliases: ['Antebrazo'] },
    { id: 'row', name: 'Remo', category: 'Espalda', primary: ['latissimus'], secondary: ['biceps', 'trapezius'], preferredView: 'back_3q', historyAliases: ['Seated row'] },
    { id: 'squat', name: 'Sentadilla', category: 'Piernas', primary: ['quadriceps', 'gluteals'], secondary: ['hamstrings', 'adductors'], preferredView: 'side_left' },
    { id: 'deadlift', name: 'Peso muerto', category: 'Piernas', primary: ['gluteals', 'hamstrings', 'erector_spinae'], secondary: ['trapezius', 'forearm'], preferredView: 'back_3q' },
    { id: 'lateral-raise', name: 'Elevaciones laterales', category: 'Hombros', primary: ['deltoid_lateral'], secondary: ['trapezius'], preferredView: 'front', historyAliases: ['Lateral'] },
    { id: 'shoulder-press', name: 'Press de hombros', category: 'Hombros', primary: ['deltoid_anterior'], secondary: ['triceps', 'deltoid_lateral'], preferredView: 'front_3q', historyAliases: ['Press militar', 'Shoulder press'] },
    { id: 'reverse-fly', name: 'Reverse fly', category: 'Hombros', primary: ['deltoid_posterior'], secondary: ['trapezius'], preferredView: 'back_3q', historyAliases: ['Reverse fly', 'Fly reverse'] },
    { id: 'leg-curl', name: 'Curl femoral', category: 'Piernas', primary: ['hamstrings'], secondary: ['calves'], preferredView: 'back' },
    { id: 'leg-extension', name: 'Extensión de cuádriceps', category: 'Piernas', primary: ['quadriceps'], secondary: [], preferredView: 'front' },
    { id: 'calf-raise', name: 'Elevación de gemelos', category: 'Piernas', primary: ['calves'], secondary: [], preferredView: 'back_3q', historyAliases: ['Gemelos', 'Pantorrilla'] },
    { id: 'abdominal-crunch', name: 'Abdominales', category: 'Core', primary: ['abdominals'], secondary: ['obliques'], preferredView: 'front', historyAliases: ['Abs 1', 'Abs 2', 'Abds'] },
];
function normalizeSearch(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
}
export function filterExercises(query, category) {
    const needle = normalizeSearch(query);
    return EXERCISES.filter((exercise) => {
        if (category !== 'Todos' && exercise.category !== category)
            return false;
        if (!needle)
            return true;
        const haystack = [exercise.name, exercise.category, ...(exercise.historyAliases ?? [])]
            .map(normalizeSearch)
            .join(' ');
        return haystack.includes(needle);
    });
}
export function getExerciseById(id) {
    return EXERCISES.find((exercise) => exercise.id === id);
}
