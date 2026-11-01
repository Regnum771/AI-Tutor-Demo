import { lectureOf, START_DAY, taughtBy } from '../scenario/course';
import { CONCEPTS, type ConceptId } from '../scenario/knowledgeGraph';
import type { DemoState, MasteryPoint, StudentProfile } from './types';

/** Where a concept sits before its lecture. */
export const BEFORE_LECTURE = 0.2;
/** A lectured concept climbs to the class's seed average over this many days. */
export const RAMP_DAYS = 14;
/** Mondays of Weeks 1–6, then the story's first day. */
const SEEDED_DAYS = [0, 7, 14, 21, 28, 35, START_DAY];

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export const emptyHistory = (): Record<ConceptId, MasteryPoint[]> =>
  Object.fromEntries(CONCEPTS.map((c) => [c.id, []])) as unknown as Record<ConceptId, MasteryPoint[]>;

/** The class's mean mastery on one concept. */
export const classAverage = (students: StudentProfile[], concept: ConceptId): number =>
  round3(students.reduce((a, s) => a + s.mastery[concept], 0) / students.length);

/** Weeks 1–6 and the story's first day: 0.20 before a concept's lecture, then a straight climb to the class's average, reached two weeks after the lecture or on day 40, whichever is first. */
export function seededHistory(students: StudentProfile[]): Record<ConceptId, MasteryPoint[]> {
  const out = emptyHistory();
  for (const c of CONCEPTS) {
    const from = lectureOf(c.id).day;
    const to = Math.min(from + RAMP_DAYS, START_DAY);
    const avg = classAverage(students, c.id);
    out[c.id] = SEEDED_DAYS.map((day) => ({
      day,
      value: day < from ? BEFORE_LECTURE : round3(BEFORE_LECTURE + (avg - BEFORE_LECTURE) * Math.min(1, (day - from) / Math.max(1, to - from))),
    }));
  }
  return out;
}

/** Appends today's class average per concept (0.20 for a concept not lectured yet), replacing a point already there for today. Mutates `s`. */
export function noteClassMastery(s: DemoState): void {
  const taught = taughtBy(s.day);
  for (const c of CONCEPTS) {
    const point = { day: s.day, value: taught.includes(c.id) ? classAverage(s.students, c.id) : BEFORE_LECTURE };
    const list = s.masteryHistory[c.id];
    if (list.at(-1)?.day === s.day) list[list.length - 1] = point;
    else list.push(point);
  }
}
