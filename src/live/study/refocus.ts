import { CLOS, lectureBefore, nextTest, REVISION_START, taughtBy, type CloId } from '../../scenario/course';
import { CONCEPTS, type ConceptId } from '../../scenario/knowledgeGraph';
import type { StudentProfile, StudyPlan, StudyPlanDay } from '../types';

/** CONCEPTS is listed prerequisites first, so its order is a safe study order. */
const ORDER: ConceptId[] = CONCEPTS.map((c) => c.id);
const conceptsOf = (clo: CloId): ConceptId[] => CLOS.find((c) => c.id === clo)!.concepts;

/**
 * Re-picks one week of the plan (`weekStart` to `weekStart + 6`) from what has been lectured by each day: the newest
 * lecture's concepts first, then what the next test covers, then the weakest; up to 2, prerequisites first. Revision
 * week and the days before the exam spread over every taught concept, weakest first. Minutes, the reason and every
 * other day stay as they were. Not a replan. Pure.
 */
export function refocus(plan: StudyPlan, student: StudentProfile, weekStart: number): StudyPlan {
  const turns: Partial<Record<CloId, number>> = {};
  const weakest = (a: ConceptId, b: ConceptId) => student.mastery[a] - student.mastery[b];
  const refocusDay = (d: StudyPlanDay): StudyPlanDay => {
    if (d.day < weekStart || d.day > weekStart + 6) return d;
    const taught = taughtBy(d.day);
    const has = (clo: CloId) => conceptsOf(clo).some((c) => taught.includes(c));
    const test = nextTest(d.day);
    const clo = has(d.clo) ? d.clo : test?.clos.find(has) ?? CLOS.map((c) => c.id).find(has);
    if (!clo) return d; // before Lecture 1
    const pool = conceptsOf(clo).filter((c) => taught.includes(c));
    let picked: ConceptId[];
    if (d.day >= REVISION_START) {
      const sorted = [...pool].sort(weakest);
      const k = (turns[clo] = (turns[clo] ?? -1) + 1);
      picked = [...new Set([sorted[k % sorted.length], sorted[(k + 1) % sorted.length]])];
    } else {
      const newest = lectureBefore(d.day, '09:00')?.concepts ?? [];
      const tested = test ? test.clos.flatMap((c) => conceptsOf(c)) : [];
      const rank = (c: ConceptId) => (newest.includes(c) ? 0 : tested.includes(c) ? 1 : 2);
      picked = [...pool].sort((a, b) => rank(a) - rank(b) || weakest(a, b)).slice(0, 2);
    }
    return { ...d, clo, concepts: picked.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)) };
  };
  return { ...plan, days: plan.days.map(refocusDay) };
}
