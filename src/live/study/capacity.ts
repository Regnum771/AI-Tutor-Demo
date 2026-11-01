import { isWeekend, studyDays } from '../../scenario/course';
import type { DemoState, StudyDay, StudyRecord } from '../types';
import { minutesNeeded } from './estimate';

const clamp = (v: number) => Math.min(1.3, Math.max(0.6, v));

export const applyCheck = (feel: number, check: StudyDay['check']): number =>
  clamp(feel * (check === 'tooMuch' ? 0.9 : check === 'tooLittle' ? 1.1 : 1));

/** Minutes for `day`, judged from `today`: the lower of what was reported and 1.25× what really happened lately, adjusted by the end-of-day check. At least 10. */
export function capacityFor(rec: StudyRecord, day: number, today = day): number {
  const reported = rec.reported ? (isWeekend(day) ? rec.reported.weekend : rec.reported.weekday) : 0;
  const recent = Object.entries(rec.days).filter(([d]) => Number(d) < today && Number(d) >= today - 7).map(([, v]) => v.done);
  const base = recent.length < 3 ? reported : Math.min(reported, 1.25 * (recent.reduce((a, b) => a + b, 0) / recent.length));
  return Math.max(10, Math.round(base * rec.feel));
}

/** Teacher pathways sent to the student and still open. Their sessions are fixed. */
export const openPathways = (state: DemoState, studentId: string) =>
  state.plans.filter((p) => p.kind === 'pathway' && p.studentIds.includes(studentId) && ['sent', 'autoApproved'].includes(p.status));

/** Minutes a teacher's pathway already takes, by day. Those sessions are fixed. */
export function teacherMinutes(state: DemoState, studentId: string): Record<number, number> {
  const out: Record<number, number> = {};
  for (const p of openPathways(state, studentId)) {
    out[p.date] = (out[p.date] ?? 0) + p.sessions.reduce((a, s) => a + s.minutes, 0);
  }
  return out;
}

/** What is left for self-study on `day`. */
export const capacityLeft = (state: DemoState, studentId: string, day: number): number =>
  Math.max(0, capacityFor(state.study[studentId], day, state.day) - (teacherMinutes(state, studentId)[day] ?? 0));

/** Whether the time left is under 60% of what reaching 0.75 on every concept would take. */
export function shortOfTime(state: DemoState, studentId: string): boolean {
  const available = studyDays(state.day).reduce((a, d) => a + capacityLeft(state, studentId, d), 0);
  return available < 0.6 * minutesNeeded(state.students.find((s) => s.id === studentId)!);
}
