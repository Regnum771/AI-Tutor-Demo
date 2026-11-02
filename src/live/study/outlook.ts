import { ASSESSMENTS, CLOS, EXAM_DAY, fullDate, nextAssessment, shortDate, type CloId } from '../../scenario/course';
import type { DemoState, PassBand, ReplanSignal, StudentProfile } from '../types';
import { cloMastery, forecast, PASS, projection } from './estimate';
import { averageTries, newRecord, selfDone } from './record';
import { lastWeek } from './signals';

export interface ExamOutlook {
  setUp: boolean;
  /** Out of 10, now. Always an estimate, never a prediction to state as fact. */
  forecast: number;
  /** Out of 10 on exam day if the current plan is kept. An estimate. */
  ifPlanKept: number;
  band: PassBand;
  passMark: number;
  cloMastery: Record<CloId, number>;
  minutesPlanned: number;
  minutesDone: number;
  /** Minutes done and planned over the last 7 closed days; little or nothing done means the student has stopped practising. */
  practisedLast7Days: { done: number; planned: number };
  /** Mean tries per question answered in the last 7 days, or null with none. */
  averageTries: number | null;
  nextAssessment: { title: string; date: string; daysAway: number } | null;
  exam: { date: string; daysAway: number };
  lastChange: { date: string; signal: ReplanSignal; reason: string } | null;
  /** Assessment marks so far, oldest first. */
  marks: { title: string; mark: number; date: string }[];
}

/** Where a student stands on the road to the exam. Used by the agents and the teacher's panel. */
export function examOutlook(state: DemoState, student: StudentProfile): ExamOutlook {
  const rec = state.study[student.id] ?? newRecord(student);
  const next = nextAssessment(state.day);
  const last = rec.replans.at(-1) ?? null;
  const est = forecast(student, rec);
  const round2 = (v: number) => Math.round(v * 100) / 100;
  return {
    setUp: rec.reported !== null,
    forecast: est.value,
    ifPlanKept: projection(student, rec, state.day),
    band: est.band,
    passMark: PASS,
    cloMastery: Object.fromEntries(CLOS.map((c) => [c.id, round2(cloMastery(student, c.id))])) as Record<CloId, number>,
    // Measured against the current plan: what it asked for up to today, and what was self-studied since it was made.
    minutesPlanned: rec.plan ? rec.plan.days.filter((d) => d.day <= state.day).reduce((a, d) => a + d.minutes, 0) : 0,
    minutesDone: rec.plan
      ? Math.round(Object.entries(rec.days).filter(([d]) => Number(d) >= rec.plan!.createdDay).reduce((a, [, v]) => a + selfDone(v), 0))
      : 0,
    practisedLast7Days: lastWeek(rec, state.day),
    averageTries: averageTries(rec, state.day),
    nextAssessment: next && { title: next.title, date: fullDate(next.day), daysAway: next.day - state.day },
    exam: { date: fullDate(EXAM_DAY), daysAway: EXAM_DAY - state.day },
    lastChange: last && { date: fullDate(last.day), signal: last.signal, reason: last.reason },
    marks: [...rec.marks].sort((a, b) => a.day - b.day).map((m) => ({ title: ASSESSMENTS.find((a) => a.id === m.assessment)?.title ?? m.assessment, mark: m.mark, date: shortDate(m.day) })),
  };
}

/** Students with a study plan whose forecast is At risk or Unlikely. */
export const examRisk = (state: DemoState): StudentProfile[] =>
  state.students.filter((s) => state.study[s.id]?.plan && forecast(s, state.study[s.id]).band !== 'Likely');
