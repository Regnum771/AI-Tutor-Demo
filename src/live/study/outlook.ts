import { CLOS, EXAM_DAY, fullDate, nextAssessment, type CloId } from '../../scenario/course';
import type { DemoState, PassBand, ReplanSignal, StudentProfile } from '../types';
import { cloMastery, PASS_MARK, passEstimate } from './estimate';
import { newRecord } from './record';

export interface ExamOutlook {
  setUp: boolean;
  /** Always an estimate, never a prediction to state as fact. */
  projectedScore: number;
  band: PassBand;
  passMark: number;
  cloMastery: Record<CloId, number>;
  minutesPlanned: number;
  minutesDone: number;
  nextAssessment: { title: string; date: string; daysAway: number } | null;
  exam: { date: string; daysAway: number };
  lastChange: { date: string; signal: ReplanSignal; reason: string } | null;
}

/** Where a student stands on the road to the exam. Used by the agents and the teacher's panel. */
export function examOutlook(state: DemoState, student: StudentProfile): ExamOutlook {
  const rec = state.study[student.id] ?? newRecord(student);
  const days = Object.values(rec.days);
  const next = nextAssessment(state.day);
  const last = rec.replans.at(-1) ?? null;
  const est = passEstimate(student, rec, state.day);
  const round2 = (v: number) => Math.round(v * 100) / 100;
  return {
    setUp: rec.reported !== null,
    projectedScore: est.score,
    band: est.band,
    passMark: PASS_MARK,
    cloMastery: Object.fromEntries(CLOS.map((c) => [c.id, round2(cloMastery(student, c.id))])) as Record<CloId, number>,
    minutesPlanned: days.reduce((a, d) => a + d.planned, 0),
    minutesDone: Math.round(days.reduce((a, d) => a + d.done, 0)),
    nextAssessment: next && { title: next.title, date: fullDate(next.day), daysAway: next.day - state.day },
    exam: { date: fullDate(EXAM_DAY), daysAway: EXAM_DAY - state.day },
    lastChange: last && { date: fullDate(last.day), signal: last.signal, reason: last.reason },
  };
}

/** Students with a study plan whose estimate is At risk or Unlikely. */
export const examRisk = (state: DemoState): StudentProfile[] =>
  state.students.filter((s) => state.study[s.id]?.plan && passEstimate(s, state.study[s.id], state.day).band !== 'Likely');
