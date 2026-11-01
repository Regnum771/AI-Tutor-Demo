import { capacityLeft, shortOfTime } from '../../src/live/study/capacity';
import { cloMastery } from '../../src/live/study/estimate';
import type { DemoState, ReplanSignal, StudyPlan } from '../../src/live/types';
import { CLOS, EXAM_DAY, REVISION_START, shortDate, studyDays, weekOf, type Clo, type CloId } from '../../src/scenario/course';
import type { ConceptId } from '../../src/scenario/knowledgeGraph';

const TARGET = 0.75;

const REASON: Record<ReplanSignal, (focus: string, exam: string) => string> = {
  setup: (focus, exam) => `This plan works back from the exam on ${exam}, with the most time on ${focus}.`,
  markSwing: (focus) => `Your latest mark changed the picture, so more time now goes to ${focus}.`,
  disengaged: (focus) => `The last few days were quieter, so this plan is lighter and stays on ${focus}.`,
  bandChange: (focus) => `Your exam outlook changed, so more time now goes to ${focus}.`,
  teacherPlan: (focus) => `Your lecturer sent you a plan, so your own study now fits around it, with the rest on ${focus}.`,
};

/** Capacity shared out by exam share × gap, with Week 9 spread across the CLOs still below target. */
export function cannedStudyPlan(state: DemoState, studentId: string, signal: ReplanSignal): StudyPlan {
  const student = state.students.find((s) => s.id === studentId)!;
  const weight = (c: Clo) => c.share * Math.max(0.05, TARGET - cloMastery(student, c.id));
  const total = CLOS.reduce((a, c) => a + weight(c), 0);
  const byWeight = [...CLOS].sort((a, b) => weight(b) - weight(a));
  const weak = byWeight.filter((c) => cloMastery(student, c.id) < TARGET);
  const given: Record<CloId, number> = { CLO1: 0, CLO2: 0, CLO3: 0 };
  const turns: Record<CloId, number> = { CLO1: 0, CLO2: 0, CLO3: 0 };

  const pool = (c: Clo): ConceptId[] => {
    const low = c.concepts.filter((x) => student.mastery[x] < TARGET);
    return [...(low.length ? low : c.concepts)].sort((a, b) => student.mastery[a] - student.mastery[b]);
  };
  const concepts = (c: Clo): ConceptId[] => {
    const p = pool(c);
    const start = turns[c.id]++;
    return [...new Set(Array.from({ length: Math.min(2, p.length) }, (_, k) => p[(start + k) % p.length]))];
  };

  const days = studyDays(state.day).map((day) => {
    const minutes = capacityLeft(state, studentId, day);
    const spent = Object.values(given).reduce((a, b) => a + b, 0) || 1;
    const behind = [...CLOS].sort((a, b) => (weight(b) / total - given[b.id] / spent) - (weight(a) / total - given[a.id] / spent))[0];
    const clo = weekOf(day) === 9 && weak.length ? weak[(day - REVISION_START) % weak.length] : behind;
    given[clo.id] += minutes;
    return { day, minutes, clo: clo.id, concepts: concepts(clo) };
  });

  return {
    createdDay: state.day,
    reason: REASON[signal](byWeight[0].title.toLowerCase(), shortDate(EXAM_DAY)),
    leftOut: shortOfTime(state, studentId) ? [`Full coverage of “${byWeight[byWeight.length - 1].title}”: the time goes where the exam weighs most.`] : [],
    source: 'offline',
    days,
  };
}
