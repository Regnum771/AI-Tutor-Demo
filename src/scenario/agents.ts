import { CONCEPTS, type ConceptId } from './knowledgeGraph';
import { ERRORS_INITIAL, MASTERY_INITIAL } from './minhAnh';

export type AgentId = 'SAS' | 'TAS';
export type CardType = 'DIAGNOSIS' | 'PROPOSAL' | 'CHALLENGE' | 'REFINEMENT' | 'REASSESSMENT';

export interface AgentCard {
  id: string;
  from: AgentId;
  to: AgentId;
  type: CardType;
  text: string;
  /** Evidence refs: kg:<concept>, twin.mastery.<concept>, twin.errors.<concept>, course.<CLO>, resources.<id> */
  refs: string[];
}

export const COURSE_OBJECTIVES: Record<string, string> = {
  'CLO-2': 'Determine logical equivalence of compound propositions',
  'CLO-3': 'Apply equivalence laws to simplify expressions',
};

export const RESOURCES: Record<string, string> = {
  'prereq-pack': 'Prerequisite pack: logical operators',
  'implication-visual': 'Visual explainer: implication truth table',
  'worked-examples': 'Worked examples: p → q ≡ ¬p ∨ q',
  'guided-set': 'Guided exercise set (6 items)',
  'application-set': 'Application problems: equivalence laws',
  'mastery-check': 'Adaptive mastery check (8 items)',
};

export const EXCHANGES: AgentCard[] = [
  { id: 'x1', from: 'SAS', to: 'TAS', type: 'DIAGNOSIS', text: 'Student demonstrates incomplete understanding of logical operators. Evidence indicates that implication is the primary area requiring reinforcement.', refs: ['twin.errors.implication', 'kg:implication'] },
  { id: 'x2', from: 'TAS', to: 'SAS', type: 'PROPOSAL', text: 'Introduce prerequisite reinforcement followed by guided logical equivalence exercises.', refs: ['course.CLO-2', 'resources.prereq-pack'] },
  { id: 'x3', from: 'SAS', to: 'TAS', type: 'CHALLENGE', text: 'Student already demonstrates partial mastery of conjunction and disjunction. Repeating all prerequisite content may be unnecessary.', refs: ['twin.mastery.conjunction', 'twin.mastery.disjunction', 'kg:conjunction', 'kg:disjunction'] },
  { id: 'x4', from: 'TAS', to: 'SAS', type: 'REFINEMENT', text: 'Agreed. Focus reinforcement on implication and equivalence, followed by targeted application exercises.', refs: ['kg:implication', 'kg:equivalence', 'resources.worked-examples'] },
];

export const REASSESSMENT: AgentCard[] = [
  { id: 'r1', from: 'SAS', to: 'TAS', type: 'REASSESSMENT', text: 'Prerequisite understanding improved. Remaining difficulty identified in applying logical equivalence.', refs: ['twin.mastery.implication', 'kg:equivLaws'] },
  { id: 'r2', from: 'TAS', to: 'SAS', type: 'REFINEMENT', text: 'Reduce prerequisite scaffolding and introduce more challenging application exercises.', refs: ['course.CLO-3', 'resources.application-set'] },
];

/** Twin blocks SAS reads in Sc5, in order (keys match TwinPanel's TwinKey). */
export const SAS_READS = ['history', 'assessment', 'mastery', 'errors', 'activity', 'interventions'] as const;

export const SAS_DIAGNOSIS = {
  gap: 'Incomplete understanding of logical operators',
  evidence: ['Repeated errors involving implication', 'Weak prerequisite mastery', 'Inconsistent application of logical expressions'],
  state: 'Requires targeted prerequisite reinforcement',
};

export const TAS_ANALYSIS = {
  reads: ['Course learning objectives', 'Teaching materials', 'Domain knowledge', 'Learning resources', 'Instructional strategies', 'Teaching progress'],
  recommendation: 'Targeted prerequisite reinforcement before progressing to logical equivalence',
  approach: ['Visual explanations', 'Guided examples', 'Progressive exercises', 'Mastery assessment'],
};

export const SAS_CHECKS: { concept: ConceptId; label: string }[] = [
  { concept: 'conjunction', label: '∧ conjunction' },
  { concept: 'disjunction', label: '∨ disjunction' },
  { concept: 'implication', label: '→ implication' },
];

export const PLAN_DRAFT = [
  { text: 'Review ¬, ∧, ∨ (all prerequisites)', drop: true },
  { text: 'Reinforce → and ↔', drop: false },
  { text: 'Guided equivalence exercises', drop: false },
];
export const PLAN_ADDED = 'Targeted application exercises';

export const JOINT_DECISION = ['Targeted Prerequisite Reinforcement', 'Guided Application', 'Mastery Assessment'];
export const JOINT_DECISION_2 = ['Targeted Application Practice', 'Advanced Exercises', 'Mastery Assessment'];

export type RefKind = 'kg' | 'twin' | 'course' | 'resources';

/** Resolve an evidence ref to what it points at; null if it points at nothing real. */
export function refTarget(ref: string): { kind: RefKind; id: string } | null {
  if (ref.startsWith('kg:')) {
    const id = ref.slice(3);
    return CONCEPTS.some((c) => c.id === id) ? { kind: 'kg', id } : null;
  }
  const [head, sub, id] = ref.split('.');
  if (head === 'twin' && sub === 'mastery' && id !== undefined && id in MASTERY_INITIAL) return { kind: 'twin', id: `mastery.${id}` };
  if (head === 'twin' && sub === 'errors' && id !== undefined && id in ERRORS_INITIAL) return { kind: 'twin', id: `errors.${id}` };
  if (head === 'course' && sub in COURSE_OBJECTIVES) return { kind: 'course', id: sub };
  if (head === 'resources' && sub in RESOURCES) return { kind: 'resources', id: sub };
  return null;
}
