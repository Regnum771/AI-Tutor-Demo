export const SIM_LABEL = 'Simulated projection · illustrative';
export const TARGET = 0.75;

/** curve[i] = projected logical-equivalence mastery after i sessions. */
export const PATHWAY_A = { id: 'A', label: 'Repeat all prerequisite content', curve: [0.35, 0.42, 0.49, 0.56, 0.63, 0.69, 0.75] };
export const PATHWAY_B = { id: 'B', label: 'Target implication & equivalence, then application', curve: [0.35, 0.52, 0.66, 0.75] };
export const SELECTED = 'B';

export const sessionsToTarget = (curve: number[], target = TARGET): number => curve.findIndex((v) => v >= target);
