import { STUDENTS, type Status, type Student } from '../scenario/classroom';
import type { ConceptId } from '../scenario/knowledgeGraph';
import { TWIN_FOCUS } from '../scenario/minhAnh';
import type { DemoState, Mastery, StudentProfile } from './types';

export const TARGET = 0.9;
/** The share of the gap to TARGET a right answer closes, by try. Later tries earn nothing. */
const GAIN_BY_TRY = [0.3, 0.15, 0.05];

const round2 = (v: number) => Math.round(v * 100) / 100;

export const gainFor = (tryNumber: number): number => GAIN_BY_TRY[tryNumber - 1] ?? 0;

/** A correct answer moves the item's concept part of the way toward TARGET, by the try it came on; a wrong one leaves it. */
export function afterAnswer(value: number, correct: boolean, tryNumber: number): number {
  if (!correct) return value;
  return Math.max(value, round2(value + (TARGET - value) * gainFor(tryNumber)));
}

/** Week 6 is logical equivalence: the Classroom's per-student figure. */
export const topicMastery = (m: Mastery): number => m.equivalence;

/** The concepts to show for a student: the Week 6 focus plus anything their plans practise. */
export function twinConcepts(state: DemoState, studentId: string): ConceptId[] {
  const planned = state.plans
    .filter((p) => p.kind === 'pathway' && p.status !== 'dismissed' && p.studentIds.includes(studentId))
    .flatMap((p) => p.sessions.flatMap((s) => (s.concept ? [s.concept] : [])));
  return [...new Set([...TWIN_FOCUS, ...planned])];
}

/** The bands the roster was built with: high risk < 0.42 ≤ support < 0.60 ≤ on track. */
export function statusFor(m: Mastery): Status {
  const v = topicMastery(m);
  return v < 0.42 ? 'highRisk' : v < 0.6 ? 'support' : 'onTrack';
}

export interface ClassKpis {
  students: number;
  needSupport: number;
  highRisk: number;
  escalated: number;
  avgMastery: number;
}

export function classKpis(students: StudentProfile[]): ClassKpis {
  const sum = students.reduce((a, s) => a + topicMastery(s.mastery), 0);
  return {
    students: students.length,
    needSupport: students.filter((s) => s.status !== 'onTrack').length,
    highRisk: students.filter((s) => s.status === 'highRisk').length,
    escalated: students.filter((s) => s.escalated).length,
    avgMastery: round2(sum / students.length),
  };
}

/** Live profiles in the Classroom's `Student` shape (tracks stay as scripted). */
export const liveStudents = (state: DemoState): Student[] =>
  state.students.map((p) => ({
    index: p.index, id: p.id, name: p.name, status: p.status, mastery: topicMastery(p.mastery), track: STUDENTS[p.index].track,
  }));
