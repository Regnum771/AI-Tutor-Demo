import { EXAM_DAY } from '../../scenario/course';
import type { PassBand, ReplanSignal, StudyRecord } from '../types';

const MARK_SWING = 15;
const COOLDOWN_DAYS = 5;

function disengaged(rec: StudyRecord, today: number): boolean {
  const last = (n: number) => Array.from({ length: n }, (_, i) => rec.days[today - 1 - i]);
  if (last(3).every((d) => d && d.planned > 0 && d.done === 0)) return true;
  const week = last(7).filter(Boolean);
  const planned = week.reduce((a, d) => a + d.planned, 0);
  return week.length === 7 && planned > 0 && week.reduce((a, d) => a + d.done, 0) / planned < 0.25;
}

/** The drastic signal that justifies a new plan, if any. Small day-to-day slips are handled by carry-over, not here. */
export function detectSignal(rec: StudyRecord, today: number, band: PassBand, newMark: number | null, previousMark: number | null): ReplanSignal | null {
  if (newMark !== null && previousMark !== null && Math.abs(newMark - previousMark) >= MARK_SWING) return 'markSwing';
  if (rec.band !== null && rec.band !== band) return 'bandChange';
  return disengaged(rec, today) ? 'disengaged' : null;
}

/** At most one replan per 5 story days; a mark swing, teacher plan or setup goes straight through. */
export const mayReplan = (rec: StudyRecord, signal: ReplanSignal, today: number): boolean =>
  signal === 'markSwing' || signal === 'teacherPlan' || signal === 'setup' || rec.lastReplanDay === null || today - rec.lastReplanDay >= COOLDOWN_DAYS;

/** A signal that stays true until a plan answers it, so a failed or later run must not lose it. */
export const kept = (s: ReplanSignal | null): s is ReplanSignal => s === 'markSwing' || s === 'teacherPlan' || s === 'setup';

/**
 * What a new day does with a signal: replan now, or hold it through the cooldown. A disengagement or band change
 * counts only if it is raised again; a mark or a teacher plan is a fact that stays true until a plan answers it.
 */
export function nextReplan(rec: StudyRecord, raised: ReplanSignal | null, today: number): { run: ReplanSignal | null; hold: ReplanSignal | null } {
  if (today >= EXAM_DAY) return { run: null, hold: null };
  const wanted = (kept(rec.pendingSignal) ? rec.pendingSignal : null) ?? raised;
  if (!wanted) return { run: null, hold: null };
  return mayReplan(rec, wanted, today) ? { run: wanted, hold: null } : { run: null, hold: wanted };
}

/** Minutes done (all practice, teacher sessions too) and planned over the 7 closed days before `today`, rounded. */
export function lastWeek(rec: StudyRecord, today: number): { done: number; planned: number } {
  let done = 0;
  let planned = 0;
  for (let d = today - 7; d < today; d++) {
    done += rec.days[d]?.done ?? 0;
    planned += rec.days[d]?.planned ?? 0;
  }
  return { done: Math.round(done), planned: Math.round(planned) };
}

/** The disengagement rule as a fact for the teacher: the last 7 days' minutes while the student has stopped, else null. */
export const stoppedPractising = (rec: StudyRecord, today: number): { done: number; planned: number } | null =>
  disengaged(rec, today) ? lastWeek(rec, today) : null;

/** The first day of the current stopped stretch, or null while the student is practising. */
export function stoppedSince(rec: StudyRecord, today: number): number | null {
  if (!stoppedPractising(rec, today)) return null;
  let day = today;
  while (day > 0 && disengaged(rec, day - 1)) day--;
  return day;
}
