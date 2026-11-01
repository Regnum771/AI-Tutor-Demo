import { cloOf } from '../../scenario/course';
import { EDGES, type ConceptId } from '../../scenario/knowledgeGraph';
import { BANK, type BankItem } from '../../scenario/practiceBank';
import type { StudentProfile, StudyRecord } from '../types';

export const SELF_SESSION = 5;
const READY = 0.4;
const RECENT_DAYS = 3;

const prerequisites = (c: ConceptId) => EDGES.filter(([, to]) => to === c).map(([from]) => from);

function chooseConcept(student: StudentProfile, concepts: ConceptId[]): ConceptId {
  const weakest = (list: ConceptId[]) => [...list].sort((a, b) => student.mastery[a] - student.mastery[b])[0];
  const eligible = concepts.filter((c) => prerequisites(c).every((p) => student.mastery[p] >= READY));
  if (eligible.length) return weakest(eligible);
  const blocking = [...new Set(concepts.flatMap(prerequisites))].filter((p) => student.mastery[p] < READY);
  return weakest(blocking.length ? blocking : concepts);
}

/** The next question: the weakest ready concept, at the student's Bloom level, avoiding recent repeats. */
export function nextItem(rec: StudyRecord, student: StudentProfile, today: number, concepts: ConceptId[], served: string[]): BankItem {
  const concept = chooseConcept(student, concepts);
  const clo = cloOf(concept);
  const level = rec.bloom[clo.id];
  const recent = new Set(rec.attempts.filter((a) => today - a.day < RECENT_DAYS).map((a) => a.itemId));
  const pool = BANK.filter((i) => i.concept === concept && !served.includes(i.id));
  const byDistance = [level, level - 1, level + 1, level - 2, level + 2].filter((l) => l >= 0 && l <= 2);
  for (const l of byDistance) {
    const fresh = pool.find((i) => i.bloom === clo.levels[l] && !recent.has(i.id));
    if (fresh) return fresh;
  }
  const lastSeen = (id: string) => [...rec.attempts].reverse().find((a) => a.itemId === id)?.day ?? -1;
  return [...pool].sort((a, b) => lastSeen(a.id) - lastSeen(b.id))[0] ?? BANK.find((i) => i.concept === concept)!;
}
