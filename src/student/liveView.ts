import { planById, studentById } from '../live/reducer';
import type { DemoState, Plan } from '../live/types';
import { relativeDay } from '../scenario/course';
import { conceptById, type ConceptId } from '../scenario/knowledgeGraph';

export interface PlanView {
  name: string;
  heading: string;
  topic: string;
  objectives: string[];
  items: { title: string; when: string; mins: number }[];
  done: number[];
  next: number | null;
  canSkip: boolean;
}

export interface ProgressView {
  concept: string;
  from: number;
  to: number;
  accuracy: number;
  items: { title: string; when: string }[];
  done: number;
  remaining: string | null;
  backLabel: string;
}

const conceptsOf = (plan: Plan): ConceptId[] => [...new Set(plan.sessions.flatMap((s) => (s.concept ? [s.concept] : [])))];
const targetOf = (plan: Plan): ConceptId => plan.sessions.find((s) => s.isMasteryCheck)?.concept ?? 'equivalence';

/** The plan screen for the plan on the phone. */
export function planView(state: DemoState): PlanView | null {
  const plan = planById(state, state.phone.planId);
  if (!plan) return null;
  const student = studentById(state, plan.studentIds[0])!;
  const { done } = state.phone;
  const next = plan.sessions.findIndex((_, i) => !done.includes(i));
  const check = plan.sessions.findIndex((s) => s.isMasteryCheck);
  return {
    name: student.short,
    heading: `Learning pathway · ${relativeDay(plan.date, state.day).toLowerCase()}`,
    topic: conceptById(targetOf(plan)).label,
    objectives: conceptsOf(plan).slice(-2).map((c) => conceptById(c).label),
    items: plan.sessions.map((s) => ({ title: s.title, when: `${relativeDay(plan.date, state.day)} ${s.time}`, mins: s.minutes })),
    done,
    next: next < 0 ? null : next,
    canSkip: plan.date === state.day && plan.sessions.some((_, i) => i < check && !done.includes(i)),
  };
}

/** Lock-screen notification copy for the plan on the phone. */
export function notificationCopy(state: DemoState): { title: string; body: string } | null {
  const plan = planById(state, state.phone.planId);
  if (!plan) return null;
  const labels = conceptsOf(plan).slice(-2).map((c) => conceptById(c).label.toLowerCase());
  return {
    title: state.phone.updated ? 'Your plan was updated' : 'Your personalized plan is ready',
    body: `${plan.sessions.length} short sessions ${relativeDay(plan.date, state.day).toLowerCase()} to strengthen ${labels.join(' & ')}.`,
  };
}

/** The progress screen after a mastery check: the finished plan's target concept, before → now. */
export function progressView(state: DemoState): ProgressView | null {
  const plan = planById(state, state.phone.lastDone ?? state.phone.planId);
  if (!plan) return null;
  const student = studentById(state, plan.studentIds[0])!;
  const target = targetOf(plan);
  const practice = student.evidence.filter((e) => e.kind === 'practice' && e.planId === plan.id && e.result !== 'skipped');
  const correct = practice.filter((e) => e.result === 'correct').length;
  return {
    concept: conceptById(target).label,
    from: Math.round((plan.baseline?.[target] ?? student.mastery[target]) * 100),
    to: Math.round(student.mastery[target] * 100),
    accuracy: practice.length ? Math.round((correct / practice.length) * 100) : 0,
    items: plan.sessions.map((s) => ({ title: s.title, when: s.time })),
    done: plan.sessions.length,
    remaining: state.phone.updated ? 'Next steps are ready for tomorrow' : null,
    backLabel: state.phone.updated ? 'See tomorrow’s plan' : 'Back to plan',
  };
}
