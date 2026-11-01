import { CLOS, type CloId } from '../../scenario/course';
import type { PassBand, StudentProfile, StudyRecord } from '../types';

/** The 10-point grade scale: pass, Khá (distinction), Giỏi (high distinction). */
export const PASS = 4.0;
export const KHA = 7.0;
export const GIOI = 8.5;
/** The mastery a concept is worked up to. */
export const TARGET_MASTERY = 0.75;
/** The most a plan that is kept can add by exam day. */
const MAX_GAIN = 2.0;

const round1 = (v: number) => Math.round(v * 10) / 10;

export const cloMastery = (student: Pick<StudentProfile, 'mastery'>, cloId: CloId): number => {
  const concepts = CLOS.find((c) => c.id === cloId)!.concepts;
  return concepts.reduce((a, c) => a + student.mastery[c], 0) / concepts.length;
};

export const bandOf = (value: number): PassBand => (value >= 5 ? 'Likely' : value >= 3.5 ? 'At risk' : 'Unlikely');

/** Minutes to bring every concept to 0.75: 12 per 0.1 of gap. */
export const minutesNeeded = (student: Pick<StudentProfile, 'mastery'>): number =>
  Math.round(Object.values(student.mastery).reduce((a, m) => a + Math.max(0, TARGET_MASTERY - m), 0) * 120);

/** Mastery weighted by exam share, blended with a mark (a percentage), on 0–10. */
export const standing = (student: Pick<StudentProfile, 'mastery'>, mark: number): number =>
  round1(0.6 * 10 * CLOS.reduce((a, c) => a + c.share * cloMastery(student, c.id), 0) + 0.4 * (mark / 10));

/** The newest assessment mark, or Quiz 2 before any. */
export const latestMark = (student: StudentProfile, rec?: StudyRecord | null): number =>
  rec?.marks.length ? [...rec.marks].sort((a, b) => a.day - b.day).at(-1)!.mark : student.quiz.q2;

/** Where the student stands now, out of 10. A plan alone never moves it. An estimate. */
export function forecast(student: StudentProfile, rec?: StudyRecord | null): { value: number; band: PassBand } {
  const value = standing(student, latestMark(student, rec));
  return { value, band: bandOf(value) };
}

/** Self-study done ÷ planned over the last 7 closed days; 1 before any day has closed. */
export function doneRate(rec: StudyRecord, today: number): number {
  let planned = 0;
  let done = 0;
  for (let d = today - 7; d < today; d++) {
    const day = rec.days[d];
    if (!day || day.planned <= 0) continue;
    planned += day.planned;
    done += day.done - (day.teacher ?? 0);
  }
  return planned > 0 ? Math.min(1, Math.max(0, done / planned)) : 1;
}

/** The exam forecast if the current plan is kept. Shown as a projection, never as the band. */
export function projection(student: StudentProfile, rec: StudyRecord | null | undefined, today: number): number {
  const now = forecast(student, rec).value;
  if (!rec?.plan) return now;
  const planned = rec.plan.days.filter((d) => d.day >= today).reduce((a, d) => a + d.minutes, 0);
  const need = minutesNeeded(student);
  const cover = need > 0 ? Math.min(1, planned / need) : 0;
  return round1(Math.min(10, now + MAX_GAIN * cover * doneRate(rec, today)));
}

/** Seeded points, then the recorded ones; a recorded point wins on the same day. */
export function forecastSeries(student: StudentProfile, rec?: StudyRecord | null): { day: number; value: number }[] {
  const byDay = new Map(student.pastForecast.map((p) => [p.day, p.value]));
  for (const p of rec?.forecasts ?? []) byDay.set(p.day, p.value);
  return [...byDay].sort((a, b) => a[0] - b[0]).map(([day, value]) => ({ day, value }));
}
