import type Anthropic from '@anthropic-ai/sdk';
import { capacityLeft, shortOfTime, teacherMinutes } from '../../src/live/study/capacity';
import { cardsToday } from '../../src/live/study/cards';
import { cloMastery, forecast, minutesNeeded, PASS, projection, TARGET_MASTERY as TARGET } from '../../src/live/study/estimate';
import type { DemoState, ReplanSignal, StudyPlan, StudyPlanDay } from '../../src/live/types';
import { ASSESSMENTS, CLOS, EXAM_DAY, LECTURES, lectureBefore, nextLecture, nextTest, shortDate, studyDays, taughtBy, weekOf } from '../../src/scenario/course';
import { conceptById, EDGES, type ConceptId } from '../../src/scenario/knowledgeGraph';
import { cannedStudyPlan } from './cannedStudy';
import { AgentError, runAgent, type AgentSpec, type Check } from './loop';
import type { Deps } from './orchestrate';
import { CONCEPT_IDS, obj, tool } from './tools';

const STEP = 'Study Planning Agent ·';

const STUDY_TOOL = tool('propose_study_plan', 'Hand in the study plan. Call this once, last.', {
  reason: { type: 'string', description: 'One sentence for the student: what this plan focuses on, and why.' },
  left_out: { type: 'array', items: { type: 'string' }, description: 'What is deliberately dropped because time cannot cover everything. Empty when nothing is.' },
  days: {
    type: 'array',
    items: obj({
      day: { type: 'integer', description: 'The day number from the calendar.' },
      minutes: { type: 'integer' },
      clo: { type: 'string', enum: CLOS.map((c) => c.id) },
      concepts: { type: 'array', items: { type: 'string', enum: CONCEPT_IDS } },
    }),
  },
});

export const STUDY_SYSTEM = `You are the Study Planning Agent in Beyond. You write one student's study plan from today to the day before the final exam of Discrete Mathematics. All data is fictional demo data.

Balance three things: the time the student really has, how likely they are to pass, and what most needs revising. Exam and assessment dates are fixed.

Rules:
- Give exactly one entry for every day in the calendar, in order. Never go over a day's available minutes. A rest day has 0 minutes.
- Each entry names one learning outcome (CLO) and 1 to 3 of that CLO's concepts.
- Use only concepts already lectured by that day. A lecture's concepts can be used from the day it is given; the calendar marks each lecture.
- Prioritise by exam share and weakness. Build on prerequisites: a concept comes after the concepts it depends on.
- Before an assessment, favour the CLOs it tests.
- Week 9 is revision week: give minutes to every CLO still below 0.75.
- Teacher sessions are fixed, and their minutes are already taken off the calendar. Plan around them; you cannot change them.
- Do not fill every minute if less will do. A plan the student can keep to beats a full one.
- left_out names what you are deliberately dropping when time cannot cover everything. Leave it empty otherwise. Be honest: never imply everything fits when it does not.

Write reason as one short sentence to the student, in plain English, without figures and without mentioning the forecast, a band or the chance of passing. Use the student's name if you use a name at all; do not assume anyone's pronouns.

Always finish with propose_study_plan.`;

const WHY: Record<ReplanSignal, string> = {
  setup: 'This is the student’s first plan.',
  markSwing: 'A new mark moved sharply against the previous one.',
  disengaged: 'The student has mostly stopped practising.',
  bandChange: 'Progress changed noticeably.',
  teacherPlan: 'The lecturer has just sent the student a plan.',
};

/** What is wrong with a plan, as messages the agent can act on. */
export function studyPlanProblems(state: DemoState, studentId: string, plan: StudyPlan): string[] {
  const student = state.students.find((s) => s.id === studentId)!;
  const wanted = studyDays(state.day);
  const out: string[] = [];
  if (!plan.reason.trim()) out.push('Give a reason.');
  if (plan.days.length !== wanted.length || wanted.some((d, i) => plan.days[i].day !== d)) {
    out.push(`Give exactly one entry for each day from ${state.day} to ${EXAM_DAY - 1}, in order, and nothing after that.`);
    return out;
  }
  for (const d of plan.days) {
    const clo = CLOS.find((c) => c.id === d.clo);
    const left = capacityLeft(state, studentId, d.day);
    if (d.minutes < 0) out.push(`Day ${d.day} has negative minutes.`);
    if (d.minutes > left) out.push(`Day ${d.day} has ${d.minutes} minutes but only ${left} are available.`);
    if (d.concepts.length > 3) out.push(`Day ${d.day} has more than 3 concepts.`);
    if (d.minutes > 0 && d.concepts.length === 0) out.push(`Day ${d.day} has minutes but no concepts.`);
    if (d.concepts.some((c) => !clo?.concepts.includes(c))) out.push(`Day ${d.day} has a concept outside ${d.clo}.`);
    const taught = taughtBy(d.day);
    for (const c of d.concepts) {
      const lecture = LECTURES.find((l) => l.concepts.includes(c));
      if (lecture && !taught.includes(c)) out.push(`Day ${d.day}: ${conceptById(c).label} is not taught until Lecture ${lecture.n} on ${shortDate(lecture.day)}.`);
    }
  }
  const below = CLOS.filter((c) => cloMastery(student, c.id) < TARGET);
  const room = plan.days.filter((d) => weekOf(d.day) === 9 && capacityLeft(state, studentId, d.day) > 0).length;
  if (room >= below.length) {
    for (const c of below) {
      if (!plan.days.some((d) => weekOf(d.day) === 9 && d.clo === c.id && d.minutes > 0)) out.push(`Week 9 needs minutes for ${c.id}, which is still below ${TARGET}.`);
    }
  }
  const planned = plan.days.reduce((a, d) => a + d.minutes, 0);
  if (plan.leftOut.length === 0 && (shortOfTime(state, studentId) || planned < 0.6 * minutesNeeded(student))) {
    out.push('The plan does not cover what the student needs: plan more minutes where time is available, or say what you are dropping in left_out.');
  }
  return out;
}

export const studySpec = (state: DemoState, studentId: string): AgentSpec<StudyPlan> => {
  const check: Check<StudyPlan> = (input) => {
    const r = input as { reason: string; left_out: string[]; days: StudyPlanDay[] };
    const plan: StudyPlan = { createdDay: state.day, reason: r.reason, leftOut: r.left_out, source: 'agents', days: r.days };
    const problems = studyPlanProblems(state, studentId, plan);
    return problems.length ? { ok: false, error: `The plan needs fixing: ${problems.join(' ')} Call propose_study_plan again.` } : { ok: true, value: plan };
  };
  return {
    system: STUDY_SYSTEM,
    tools: [STUDY_TOOL],
    finish: 'propose_study_plan',
    check,
    exec: (name) => { throw new Error(`Unknown tool ${name}.`); },
    label: () => null,
  };
};

export function studyMessages(state: DemoState, studentId: string, signal: ReplanSignal): Anthropic.Beta.BetaMessageParam[] {
  const s = state.students.find((x) => x.id === studentId)!;
  const rec = state.study[studentId];
  const est = forecast(s, rec);
  const teacher = teacherMinutes(state, studentId);
  const label = (c: ConceptId) => conceptById(c).label;
  const weakest = [...CONCEPT_IDS].sort((a, b) => s.mastery[a] - s.mastery[b]).slice(0, 5);
  const recent = Object.entries(rec.days).filter(([d]) => Number(d) >= state.day - 7 && Number(d) < state.day).map(([, v]) => v.done);
  const { due } = cardsToday(rec, state.day, []);
  const available = studyDays(state.day).reduce((a, d) => a + capacityLeft(state, studentId, d), 0);
  const calendar = studyDays(state.day).map((d) => {
    const parts = [`${d} · ${shortDate(d)}${weekOf(d) === 9 ? ' (revision week)' : ''}: ${capacityLeft(state, studentId, d)} min available`];
    const l = LECTURES.find((x) => x.day === d);
    if (l) parts.push(`Lecture ${l.n} (${l.concepts.join(', ') || 'revision'})`);
    if (teacher[d]) parts.push(`teacher session takes ${teacher[d]} min`);
    const a = ASSESSMENTS.find((x) => x.day === d);
    if (a) parts.push(`${a.title} on ${a.clos.join(', ')}`);
    return parts.join(' · ');
  });
  const held = lectureBefore(state.day, '09:00');
  const coming = nextLecture(state.day, '09:00');
  const test = nextTest(state.day);
  const lines = [
    `Student: ${s.name} (${s.id}; call them ${s.short}).`,
    `Why this plan is being written: ${WHY[signal]}`,
    ...(rec.plan ? [`The current plan’s reason: ${rec.plan.reason}`] : []),
    `Forecast: ${est.value.toFixed(1)} out of 10 (${est.band}); ${rec.plan ? `${projection(s, rec, state.day).toFixed(1)} if the current plan is kept; ` : ''}the pass mark is ${PASS.toFixed(1)}. The final exam is on ${shortDate(EXAM_DAY)}.`,
    `${held ? `Lectures so far: ${held.n === 1 ? '1' : `1–${held.n}`} (latest: Lecture ${held.n} · ${held.title}, ${shortDate(held.day)}).` : 'No lectures yet.'} ${coming ? `Next lecture: Lecture ${coming.n} · ${coming.title}, ${shortDate(coming.day)}.` : 'No lectures are left.'}`,
    ...(test ? [`Next assessment: ${test.title} on ${shortDate(test.day)}, covering ${test.clos.join(', ')}.`] : []),
    `Time the student reported: ${rec.reported?.weekday} min on weekdays, ${rec.reported?.weekend} min at weekends. Actually done on recent days: ${recent.join(', ') || 'no data yet'}.`,
    'Learning outcomes:',
    ...CLOS.map((c) => `- ${c.id} ${c.title}: mastery ${cloMastery(s, c.id).toFixed(2)}, ${Math.round(c.share * 100)}% of the exam. Concepts: ${c.concepts.join(', ')}.`),
    `Weakest concepts: ${weakest.map((c) => `${label(c)} (${c}) ${s.mastery[c].toFixed(2)}`).join(', ')}.`,
    `Marks this term: ${rec.marks.map((m) => `${m.assessment} ${m.mark}`).join(', ') || 'none since Quiz 2'}. Cards due today: ${due.length}.`,
    `Reaching 0.75 on every concept would take about ${minutesNeeded(s)} minutes; ${available} are available.${shortOfTime(state, studentId) ? ' That is not enough: left_out must say what you are dropping.' : ''}`,
    `Prerequisites (first, then what it unlocks): ${EDGES.map(([a, b]) => `${a} → ${b}`).join(', ')}.`,
    'Calendar (day number · date: minutes available):',
    ...calendar,
  ];
  return [{ role: 'user', content: lines.join('\n') }];
}

const warn = (e: unknown) => console.warn(`[beyond] study planning failed: ${e instanceof Error ? e.message : e}`);

/**
 * The student's plan. The offline planner steps in when there is no client, at setup, or when the agent cannot produce
 * a valid plan. If a replan fails for any other reason, the result is null: the student keeps the current plan.
 */
export async function planStudy(state: DemoState, studentId: string, signal: ReplanSignal, deps: Pick<Deps, 'client' | 'onStep' | 'signal'>): Promise<StudyPlan | null> {
  const offline = () => cannedStudyPlan(state, studentId, signal);
  if (!deps.client) return offline();
  deps.onStep(`${STEP} reading progress and practice`);
  deps.onStep(`${STEP} checking the exam calendar`);
  deps.onStep(`${STEP} writing the plan`);
  try {
    return await runAgent(deps.client, studySpec(state, studentId), studyMessages(state, studentId, signal), deps);
  } catch (e) {
    if (deps.signal?.aborted) throw e;
    warn(e);
    return signal === 'setup' || e instanceof AgentError ? offline() : null;
  }
}
