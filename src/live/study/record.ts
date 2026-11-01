import { cloOf } from '../../scenario/course';
import type { BankItem } from '../../scenario/practiceBank';
import type { DemoState, StudentProfile, StudyDay, StudyRecord } from '../types';
import { cloMastery } from './estimate';

/** Nominal study time: story time is not real time. */
export const MINUTES = { question: 1.5, card: 0.5 };

/** Minutes of a day's `done` that were self-study, not teacher sessions. */
export const selfDone = (d?: StudyDay): number => (d ? d.done - (d.teacher ?? 0) : 0);
const startLevel = (mastery: number) => (mastery < 0.45 ? 0 : mastery < 0.7 ? 1 : 2);

export function newRecord(student: StudentProfile): StudyRecord {
  return {
    reported: null, feel: 1, days: {}, attempts: [], cards: {}, marks: [], plan: null, band: null,
    bloom: { CLO1: startLevel(cloMastery(student, 'CLO1')), CLO2: startLevel(cloMastery(student, 'CLO2')), CLO3: startLevel(cloMastery(student, 'CLO3')) },
    streak: { CLO1: 0, CLO2: 0, CLO3: 0 },
    pendingSignal: null, lastReplanDay: null, replans: [], planning: null,
  };
}

/** The student's record, created on first use. Mutates `s`. */
export function ensureRecord(s: DemoState, studentId: string): StudyRecord {
  s.study[studentId] ??= newRecord(s.students.find((x) => x.id === studentId)!);
  return s.study[studentId];
}

export function logMinutes(rec: StudyRecord, day: number, minutes: number, teacher = false): void {
  rec.days[day] ??= { planned: 0, done: 0, check: null };
  rec.days[day].done += minutes;
  if (teacher) rec.days[day].teacher = (rec.days[day].teacher ?? 0) + minutes;
}

/** Logs a graded answer and moves the Bloom level: two first-try answers up, a wrong answer down. Mutates `rec`. */
export function noteAttempt(rec: StudyRecord, item: BankItem, day: number, correct: boolean, firstTry: boolean, inSession = false): void {
  rec.attempts.push({ itemId: item.id, day, correct, firstTry });
  logMinutes(rec, day, MINUTES.question, inSession);
  const clo = cloOf(item.concept).id;
  if (!correct) {
    rec.bloom[clo] = Math.max(0, rec.bloom[clo] - 1);
    rec.streak[clo] = 0;
  } else if (firstTry) {
    rec.streak[clo] += 1;
    if (rec.streak[clo] >= 2) {
      rec.bloom[clo] = Math.min(2, rec.bloom[clo] + 1);
      rec.streak[clo] = 0;
    }
  }
}
