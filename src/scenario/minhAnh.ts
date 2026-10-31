import type { ConceptId } from './knowledgeGraph';

export type Mastery = Record<ConceptId, number>;

export const MINH_ANH = {
  index: 16,
  id: 's17',
  name: 'Nguyễn Minh Anh',
  short: 'Minh Anh',
  course: 'Discrete Mathematics',
  topic: 'Logical Equivalence',
  scorePrev: 75,
  scoreNow: 42,
  scoreAfter: 78,
  incompleteActivities: 2,
} as const;

export const MASTERY_INITIAL: Mastery = {
  propositions: 0.85, negation: 0.7, conjunction: 0.8, disjunction: 0.78, implication: 0.31, biconditional: 0.35,
  truthTables: 0.6, expressions: 0.55, equivalence: 0.35, deMorgan: 0.4, equivLaws: 0.38, applications: 0.3,
};

/** After Sc7 practice (guided activity done, mastery check still pending). */
export const MASTERY_MID: Mastery = { ...MASTERY_INITIAL, implication: 0.52, biconditional: 0.45, truthTables: 0.72, equivalence: 0.48 };

/** After the mastery assessment (Sc8 adapt). */
export const MASTERY_POST: Mastery = {
  ...MASTERY_INITIAL, implication: 0.74, biconditional: 0.66, truthTables: 0.8, expressions: 0.68,
  equivalence: 0.78, deMorgan: 0.64, equivLaws: 0.52, applications: 0.45,
};

export const ERRORS_INITIAL: Partial<Record<ConceptId, number>> = { implication: 6, biconditional: 2, equivalence: 3 };

export const TWIN_FOCUS: ConceptId[] = ['negation', 'conjunction', 'disjunction', 'implication', 'biconditional', 'equivalence'];

export const DELTAS = [
  { label: 'Exercise accuracy', before: '42%', after: '78%' },
  { label: 'Incorrect answers (per set)', before: '6', after: '2' },
  { label: 'Hints requested (per item)', before: '1.8', after: '0.6' },
  { label: 'Avg response time', before: '74 s', after: '41 s' },
  { label: 'Logical equivalence mastery', before: '0.35', after: '0.78' },
];

export function lerpMastery(a: Mastery, b: Mastery, p: number): Mastery {
  const out = { ...a };
  for (const k of Object.keys(a) as ConceptId[]) out[k] = a[k] + (b[k] - a[k]) * p;
  return out;
}

/** Focus concepts below `threshold`, in TWIN_FOCUS order. */
export const gaps = (m: Mastery, threshold = 0.5): ConceptId[] => TWIN_FOCUS.filter((id) => m[id] < threshold);
