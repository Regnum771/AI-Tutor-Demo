import { capacityLeft, shortOfTime } from '../../src/live/study/capacity';
import { cloMastery, minutesNeeded, TARGET_MASTERY as TARGET } from '../../src/live/study/estimate';
import type { DemoState, ReplanSignal, StudyPlan } from '../../src/live/types';
import { CLOS, EXAM_DAY, nextAssessment, nextTest, shortDate, studyDays, taughtBy, weekOf, type Clo, type CloId } from '../../src/scenario/course';
import type { ConceptId } from '../../src/scenario/knowledgeGraph';

const MAINTENANCE = 10; // minutes a day that keep a strong student's practice alive
const NEED_MARGIN = 1.2;

const REASON: Record<ReplanSignal, (focus: string, exam: string) => string> = {
  setup: (focus, exam) => `This plan works back from the exam on ${exam}, with the most time on ${focus}.`,
  markSwing: (focus) => `Your latest mark changed the picture, so more time now goes to ${focus}.`,
  disengaged: (focus) => `The last few days were quieter, so this plan is lighter and stays on ${focus}.`,
  bandChange: (focus) => `Your exam outlook changed, so more time now goes to ${focus}.`,
  teacherPlan: (focus) => `Your lecturer sent you a plan, so your own study now fits around it, with the rest on ${focus}.`,
};

/** Capacity shared out by exam share × gap, with Week 9 spread across the CLOs still below target. Each day uses only lectured concepts. */
export function cannedStudyPlan(state: DemoState, studentId: string, signal: ReplanSignal): StudyPlan {
  const student = state.students.find((s) => s.id === studentId)!;
  const weight = (c: Clo) => c.share * Math.max(0.05, TARGET - cloMastery(student, c.id));
  const total = CLOS.reduce((a, c) => a + weight(c), 0);
  const byWeight = [...CLOS].sort((a, b) => weight(b) - weight(a));
  const weak = byWeight.filter((c) => cloMastery(student, c.id) < TARGET);
  const given: Record<CloId, number> = { CLO1: 0, CLO2: 0, CLO3: 0 };
  const turns: Record<CloId, number> = { CLO1: 0, CLO2: 0, CLO3: 0 };

  const taughtIn = (c: Clo, day: number): ConceptId[] => {
    const taught = taughtBy(day);
    return c.concepts.filter((x) => taught.includes(x));
  };
  const pool = (c: Clo, day: number): ConceptId[] => {
    const taught = taughtIn(c, day);
    const low = taught.filter((x) => student.mastery[x] < TARGET);
    return [...(low.length ? low : taught)].sort((a, b) => student.mastery[a] - student.mastery[b]);
  };
  const concepts = (c: Clo, day: number): ConceptId[] => {
    const p = pool(c, day);
    const start = turns[c.id]++;
    return [...new Set(Array.from({ length: Math.min(2, p.length) }, (_, k) => p[(start + k) % p.length]))];
  };

  const available = studyDays(state.day).reduce((a, d) => a + capacityLeft(state, studentId, d), 0);
  const scale = available ? Math.min(1, (minutesNeeded(student) * NEED_MARGIN) / available) : 0;
  const week9 = studyDays(state.day).filter((d) => weekOf(d) === 9 && capacityLeft(state, studentId, d) > 0);

  const days = studyDays(state.day).map((day) => {
    const left = capacityLeft(state, studentId, day);
    const minutes = Math.min(left, Math.max(MAINTENANCE, Math.round(left * scale)));
    const spent = Object.values(given).reduce((a, b) => a + b, 0) || 1;
    const soon = nextAssessment(day);
    const tested = soon && soon.day !== EXAM_DAY && soon.day - day <= 3 ? CLOS.filter((c) => soon.clos.includes(c.id) && cloMastery(student, c.id) < TARGET) : [];
    // A CLO waits until something in it has been lectured.
    const ready = (list: Clo[]) => list.filter((c) => taughtIn(c, day).length > 0);
    const open = ready(tested).length ? ready(tested) : ready(CLOS).length ? ready(CLOS) : CLOS;
    const behind = [...open].sort((a, b) => (weight(b) / total - given[b.id] / spent) - (weight(a) / total - given[a.id] / spent))[0];
    const chosen = weekOf(day) === 9 && weak.length && minutes > 0 ? weak[week9.indexOf(day) % weak.length] : behind;
    // A day whose CLO has nothing lectured yet takes a CLO the next test covers.
    const clo = taughtIn(chosen, day).length ? chosen : CLOS.find((c) => nextTest(day)?.clos.includes(c.id) && taughtIn(c, day).length > 0) ?? chosen;
    given[clo.id] += minutes;
    return { day, minutes, clo: clo.id, concepts: concepts(clo, day) };
  });

  // What loses out: the CLO with the lowest share of the time its concepts need (120 minutes per 1.0 of gap).
  const need = (c: Clo) => c.concepts.reduce((a, x) => a + Math.max(0, TARGET - student.mastery[x]), 0) * 120;
  const lossy = CLOS.filter((c) => need(c) > 0).sort((a, b) => given[a.id] / need(a) - given[b.id] / need(b))[0];

  return {
    createdDay: state.day,
    reason: REASON[signal](`“${byWeight[0].title}”`, shortDate(EXAM_DAY)),
    leftOut: shortOfTime(state, studentId) && lossy ? [`Full coverage of “${lossy.title}”: there is not enough time for all of it, so it gets less for now.`] : [],
    source: 'offline',
    days,
  };
}
