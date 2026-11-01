import type { ConceptId } from '../../scenario/knowledgeGraph';
import { itemById } from '../../scenario/practiceBank';
import type { StudentProfile, StudyRecord } from '../types';

/** Mastery a concept loses in a week without practice. */
export const FORGET_PER_WEEK = 0.02;
/** Forgetting stops here; a concept already below it is left alone. */
export const FORGET_FLOOR = 0.25;

/** A week's forgetting: every concept with no attempt in the 7 days before `today` loses 0.02, never below 0.25. Mutates `student.mastery`. */
export function forget(student: StudentProfile, rec: StudyRecord, today: number): void {
  const practised = new Set(rec.attempts.filter((a) => a.day >= today - 7 && a.day < today).map((a) => itemById(a.itemId)?.concept));
  for (const c of Object.keys(student.mastery) as ConceptId[]) {
    const m = student.mastery[c];
    if (practised.has(c) || m < FORGET_FLOOR) continue;
    student.mastery[c] = Math.max(FORGET_FLOOR, Math.round((m - FORGET_PER_WEEK) * 1000) / 1000);
  }
}
