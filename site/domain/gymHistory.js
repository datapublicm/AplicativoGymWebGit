/**
 * Exercise labels and row fields recovered from the user's gym workbook workflow
 * (BD_Filter / BD_Filter_Extend). Historical rows remain external; Part 01.3 uses
 * only the catalog/schema so the UI can recognize the user's real exercise names.
 */
export const GYM_HISTORY_FIELDS = [
    'Gimnasio',
    'Sede',
    'Grupo Muscular',
    'Ejercicio',
    'Tipo',
    'Numero Serie',
    'Subdivision',
    'Peso',
    'Repeticiones',
];
export const GYM_HISTORY_LABELS = [
    'Pectoral 1', 'Pectoral 2', 'Chest press', 'Chesse press',
    'Espalda 1', 'Espalda 2', 'Espalda 3', 'Espalda 4', 'Seated row',
    'Pierna 1', 'Pierna 2', 'Pierna 3', 'Pierna 4', 'Pierna 5',
    'Gemelos', 'Pantorrilla',
    'Press militar', 'Shoulder press',
    'Reverse fly', 'Fly reverse', 'Lateral',
    'Copa', 'Extensión triceps', 'Extension triceps',
    'Curl bíceps', 'Curl biceps', 'Curl biseps', 'Martillo', 'Predicador', 'Antebrazo',
    'Abs 1', 'Abs 2', 'Abds',
];
// These historical labels are intentionally not assigned to a specific movement yet.
// Their exact machine/exercise meaning must not be guessed from the generic number.
export const UNMAPPED_HISTORY_LABELS = [
    'Pectoral 1', 'Pectoral 2',
    'Espalda 1', 'Espalda 2', 'Espalda 3', 'Espalda 4',
    'Pierna 1', 'Pierna 2', 'Pierna 3', 'Pierna 4', 'Pierna 5',
];
