import { CLOS, cloOf, type CloId } from '../../scenario/course';
import type { BankItem } from '../../scenario/practiceBank';
import type { DemoState, StudentProfile, StudyRecord } from '../types';

/** Nominal study time: story time is not real time. */
export const MINUTES = { question: 1.5, card: 0.5 };

const meanOf = (student: StudentProfile, cloId: CloId) => {
  const concepts = CLOS.find((c) => c.id === cloId)!.concepts;
  return concepts.reduce((a, c) => a + student.mastery[c], 0) / concepts.length;
};
const startLevel = (mastery: number) => (mastery < 0.45 ? 0 : mastery < 0.7 ? 1 : 2);

export function newRecord(student: StudentProfile): StudyRecord {
  return {
    reported: null, feel: 1, days: {}, attempts: [], cards: {}, marks: [], plan: null, band: null,
    bloom: { CLO1: startLevel(meanOf(student, 'CLO1')), CLO2: startLevel(meanOf(student, 'CLO2')), CLO3: startLevel(meanOf(student, 'CLO3')) },
    streak: { CLO1: 0, CLO2: 0, CLO3: 0 },
    pendingSignal: null, lastReplanDay: null, replans: [], planning: null,
  };
}

/** The student's record, created on first use. Mutates `s`. */
export function ensureRecord(s: DemoState, studentId: string): StudyRecord {
  s.study[studentId] ??= newRecord(s.students.find((x) => x.id === studentId)!);
  return s.study[studentId];
}

export function logMinutes(rec: StudyRecord, day: number, minutes: number): void {
  rec.days[day] ??= { planned: 0, done: 0, check: null };
  rec.days[day].done += minutes;
}

/** Logs a graded answer and moves the Bloom level: two first-try answers up, a wrong answer down. Mutates `rec`. */
export function noteAttempt(rec: StudyRecord, item: BankItem, day: number, correct: boolean, firstTry: boolean): void {
  rec.attempts.push({ itemId: item.id, day, correct, firstTry });
  logMinutes(rec, day, MINUTES.question);
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
