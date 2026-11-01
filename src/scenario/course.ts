import type { ConceptId } from './knowledgeGraph';

/** Day 0 is Monday 21 September. The story starts at the end of Week 6. */
export const START_DAY = 40;
/** The final exam, Tuesday 24 November (Week 10). */
export const EXAM_DAY = 64;
/** Monday of Week 9, the revision week. */
export const REVISION_START = 56;

const toDate = (day: number) => new Date(Date.UTC(2026, 8, 21 + day));
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const fullDate = (day: number): string => {
  const d = toDate(day);
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
};
export const shortDate = (day: number): string => {
  const d = toDate(day);
  return `${WEEKDAYS[d.getUTCDay()].slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
};
export const weekOf = (day: number): number => Math.floor(day / 7) + 1;
export const isWeekend = (day: number): boolean => day % 7 >= 5;

/** Every day from `today` to the day before the exam. */
export const studyDays = (today: number): number[] => Array.from({ length: Math.max(0, EXAM_DAY - today) }, (_, i) => today + i);

/** "Today", "Tomorrow" or a weekday name → a day number. Unknown labels mean today. */
export function resolveDay(label: string, today: number): number {
  const l = label.trim().toLowerCase();
  if (l === 'tomorrow') return today + 1;
  const i = WEEKDAYS.findIndex((w) => w.toLowerCase() === l);
  if (i < 0) return today;
  const ahead = (i - toDate(today).getUTCDay() + 7) % 7;
  return today + (ahead === 0 ? 7 : ahead);
}

export const relativeDay = (day: number, today: number): string =>
  day === today ? 'Today' : day === today + 1 ? 'Tomorrow' : shortDate(day);

export type CloId = 'CLO1' | 'CLO2' | 'CLO3';
export type Bloom = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';

export interface Clo {
  id: CloId;
  title: string;
  concepts: ConceptId[];
  /** Three consecutive Bloom levels, lowest first. */
  levels: [Bloom, Bloom, Bloom];
  /** Share of the final exam. */
  share: number;
}

export const CLOS: Clo[] = [
  {
    id: 'CLO1', title: 'Express and evaluate logical statements', share: 0.4, levels: ['Remember', 'Understand', 'Apply'],
    concepts: ['propositions', 'negation', 'conjunction', 'disjunction', 'implication', 'biconditional', 'truthTables', 'expressions'],
  },
  { id: 'CLO2', title: 'Establish logical equivalence', share: 0.4, levels: ['Understand', 'Apply', 'Analyze'], concepts: ['equivalence', 'deMorgan', 'equivLaws'] },
  { id: 'CLO3', title: 'Reason about real problems with logic', share: 0.2, levels: ['Apply', 'Analyze', 'Evaluate'], concepts: ['applications'] },
];

export const cloOf = (concept: ConceptId): Clo => CLOS.find((c) => c.concepts.includes(concept))!;

export interface Assessment { id: string; title: string; day: number; clos: CloId[] }

export const ASSESSMENTS: Assessment[] = [
  { id: 'quiz1', title: 'Quiz 1', day: 17, clos: ['CLO1'] },
  { id: 'a1', title: 'Assignment 1', day: 25, clos: ['CLO1'] },
  { id: 'quiz2', title: 'Quiz 2', day: 38, clos: ['CLO1', 'CLO2'] },
  { id: 'a2', title: 'Assignment 2', day: 46, clos: ['CLO2'] },
  { id: 'quiz3', title: 'Quiz 3', day: 52, clos: ['CLO2', 'CLO3'] },
  { id: 'exam', title: 'Final exam', day: EXAM_DAY, clos: ['CLO1', 'CLO2', 'CLO3'] },
];

export const nextAssessment = (today: number): Assessment | null => ASSESSMENTS.find((a) => a.day >= today) ?? null;
