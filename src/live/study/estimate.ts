import { CLOS, type CloId } from '../../scenario/course';
import type { PassBand, StudentProfile, StudyRecord } from '../types';

export const PASS_MARK = 50;
/** The mastery a concept is worked up to. */
export const TARGET_MASTERY = 0.75;

export const cloMastery = (student: StudentProfile, cloId: CloId): number => {
  const concepts = CLOS.find((c) => c.id === cloId)!.concepts;
  return concepts.reduce((a, c) => a + student.mastery[c], 0) / concepts.length;
};

export const bandOf = (score: number): PassBand => (score >= 60 ? 'Likely' : score >= 45 ? 'At risk' : 'Unlikely');

/** Minutes to bring every concept to 0.75: 12 per 0.1 of gap. */
export const minutesNeeded = (student: StudentProfile): number =>
  Math.round(Object.values(student.mastery).reduce((a, m) => a + Math.max(0, TARGET_MASTERY - m), 0) * 120);

/** Projected exam score: CLO mastery by exam share, plus a capped gain for the study still planned. An estimate. */
export function passEstimate(student: StudentProfile, rec: StudyRecord, today: number): { score: number; band: PassBand } {
  const planned = rec.plan?.days.filter((d) => d.day >= today).reduce((a, d) => a + d.minutes, 0) ?? 0;
  const gain = Math.min(0.2, planned / 1000);
  const score = CLOS.reduce((a, c) => a + c.share * Math.min(1, cloMastery(student, c.id) + gain), 0) * 100;
  return { score: Math.round(score), band: bandOf(Math.round(score)) };
}
