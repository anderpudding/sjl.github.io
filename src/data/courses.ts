/**
 * Courses taken at UBC, by term, plus the prerequisite links between them.
 * Titles and prerequisites are from the UBC Vancouver Academic Calendar; only links
 * between courses on this list are kept.
 */
export type Subject = 'cpsc' | 'math' | 'data' | 'other';

export interface Term {
    id: string;
    label: string;
    courses: string[];
}

export interface EdgeInfo {
    from: string;
    to: string;
    /** req: required · oneof: satisfies one alternative · coreq · rec: recommended */
    kind: 'req' | 'oneof' | 'coreq' | 'rec';
}

export const terms: Term[] = [
    { id: '1F', label: 'Science 1F', courses: ['SCIE 113', 'CPSC 110', 'JAPN 100', 'FMST 210'] },
    { id: '1W', label: 'Science 1W', courses: ['MATH 101B', 'CPSC 121', 'BIOL 111', 'PHYS 131'] },
    { id: '1S', label: 'Science 1S', courses: ['MATH 200', 'EOSC 114', 'ASIA 327', 'WRDS 150B'] },
    { id: '2F', label: 'CMCM 2F', courses: ['CPSC 210', 'MATH 221', 'MATH 220', 'STAT 200', 'MUSC 156B'] },
    { id: '2W', label: 'CMCM 2W', courses: ['MATH 215', 'JAPN 101', 'CPSC 213', 'CRWR 208', 'MUSC 156B', 'DSCI 100', 'NURS 180', 'FRST 303'] },
    { id: '2S', label: 'CMCM 2S', courses: ['MATH 302', 'CONS 127', 'CPSC 221'] },
    { id: '3F', label: 'CMCM 3F', courses: ['CPSC 320', 'MATH 322', 'BIOL 121', 'CHEM 121', 'CPSC 313'] },
    { id: '3W', label: 'CMCM 3W', courses: ['MATH 317', 'MATH 215', 'CPSC 310', 'CPSC 322', 'MATH 320'] },
];

export const titles: Record<string, string> = {
    'CPSC 110': 'Computation, Programs, and Programming',
    'CPSC 121': 'Models of Computation',
    'CPSC 210': 'Software Construction',
    'CPSC 213': 'Introduction to Computer Systems',
    'CPSC 221': 'Basic Algorithms and Data Structures',
    'CPSC 310': 'Introduction to Software Engineering',
    'CPSC 313': 'Computer Hardware and Operating Systems',
    'CPSC 320': 'Intermediate Algorithm Design and Analysis',
    'CPSC 322': 'Introduction to Artificial Intelligence',
    'MATH 101B': 'Integral Calculus with Applications',
    'MATH 200': 'Calculus III',
    'MATH 215': 'Elementary Differential Equations I',
    'MATH 220': 'Mathematical Proof',
    'MATH 221': 'Matrix Algebra',
    'MATH 302': 'Introduction to Probability',
    'MATH 317': 'Calculus IV',
    'MATH 320': 'Real Variables I',
    'MATH 322': 'Introduction to Group Theory',
    'STAT 200': 'Elementary Statistics for Applications',
    'DSCI 100': 'Introduction to Data Science',
    'JAPN 100': 'Beginning Japanese IA',
    'JAPN 101': 'Beginning Japanese IB',
    'SCIE 113': 'First-Year Seminar in Science',
    'FMST 210': 'Family Context of Human Development',
    'BIOL 111': 'Introduction to Modern Biology',
    'BIOL 121': 'Genetics, Evolution and Ecology',
    'PHYS 131': 'Energy and Waves',
    'CHEM 121': 'Structure and Bonding in Chemistry',
    'EOSC 114': 'The Catastrophic Earth: Natural Disasters',
    'ASIA 327': 'Korean Popular Music in Context',
    'WRDS 150B': 'Writing and Research in the Disciplines',
    'MUSC 156B': 'Vocal Chamber Ensembles',
    'CRWR 208': 'Introduction to Writing for Graphic Forms',
    'NURS 180': 'Stress and Strategies to Promote Well Being',
    'FRST 303': 'Into the Woods: An Introduction to Forest Science',
    'CONS 127': 'Observing the Earth from Space',
};

/** Any 200-level MATH/STAT course satisfies part (b) of CPSC 320's prerequisite. */
const math200Level = ['MATH 200', 'MATH 215', 'MATH 220', 'MATH 221', 'MATH 302', 'STAT 200'];

export const edges: EdgeInfo[] = [
    { from: 'CPSC 110', to: 'CPSC 121', kind: 'coreq' },
    { from: 'CPSC 110', to: 'CPSC 210', kind: 'oneof' },
    { from: 'CPSC 121', to: 'CPSC 213', kind: 'req' },
    { from: 'CPSC 210', to: 'CPSC 213', kind: 'req' },
    { from: 'CPSC 210', to: 'CPSC 221', kind: 'oneof' },
    { from: 'CPSC 121', to: 'CPSC 221', kind: 'oneof' },
    { from: 'MATH 220', to: 'CPSC 221', kind: 'oneof' },
    { from: 'CPSC 213', to: 'CPSC 310', kind: 'req' },
    { from: 'CPSC 221', to: 'CPSC 310', kind: 'req' },
    { from: 'CPSC 213', to: 'CPSC 313', kind: 'req' },
    { from: 'CPSC 221', to: 'CPSC 313', kind: 'oneof' },
    { from: 'CPSC 221', to: 'CPSC 320', kind: 'oneof' },
    ...math200Level.map(from => ({ from, to: 'CPSC 320', kind: 'oneof' as const })),
    { from: 'CPSC 221', to: 'CPSC 322', kind: 'oneof' },
    { from: 'MATH 101B', to: 'MATH 200', kind: 'oneof' },
    { from: 'MATH 101B', to: 'MATH 215', kind: 'oneof' },
    { from: 'MATH 221', to: 'MATH 215', kind: 'oneof' },
    { from: 'MATH 200', to: 'MATH 215', kind: 'coreq' },
    { from: 'MATH 101B', to: 'MATH 220', kind: 'oneof' },
    { from: 'MATH 200', to: 'MATH 220', kind: 'oneof' },
    { from: 'MATH 200', to: 'MATH 302', kind: 'oneof' },
    { from: 'MATH 200', to: 'MATH 317', kind: 'oneof' },
    { from: 'MATH 221', to: 'MATH 317', kind: 'rec' },
    { from: 'MATH 200', to: 'MATH 320', kind: 'oneof' },
    { from: 'MATH 220', to: 'MATH 320', kind: 'req' },
    { from: 'MATH 221', to: 'MATH 322', kind: 'oneof' },
    { from: 'MATH 220', to: 'MATH 322', kind: 'req' },
    { from: 'JAPN 100', to: 'JAPN 101', kind: 'rec' },
];

export function subjectOf(code: string): Subject {
    if (code.startsWith('CPSC')) return 'cpsc';
    if (code.startsWith('MATH')) return 'math';
    if (code.startsWith('STAT') || code.startsWith('DSCI')) return 'data';
    return 'other';
}
