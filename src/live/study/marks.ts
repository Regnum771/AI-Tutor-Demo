import { CLOS, type Assessment } from '../../scenario/course';
import type { StudentProfile } from '../types';
import { cloMastery } from './estimate';

/** A mark for an assessment that has just passed: mastery on its CLOs, plus a seeded offset of −6 to +6. */
export function markFor(student: StudentProfile, assessment: Assessment): number {
  const clos = CLOS.filter((c) => assessment.clos.includes(c.id));
  const weight = clos.reduce((a, c) => a + c.share, 0);
  const mastery = clos.reduce((a, c) => a + c.share * cloMastery(student, c.id), 0) / weight;
  const offset = ((student.index * 37 + assessment.day * 11) % 13) - 6;
  return Math.max(0, Math.min(100, Math.round(mastery * 100) + offset));
}
