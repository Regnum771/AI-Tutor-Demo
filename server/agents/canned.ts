import { fmt, parseTime } from '../../src/live/clock';
import { studentById } from '../../src/live/reducer';
import type { AssistantMsg, DemoState, LivePanel, Mastery, Plan, PlanSession } from '../../src/live/types';
import { COMPLEX } from '../../src/scenario/classroom';
import { conceptById, type ConceptId } from '../../src/scenario/knowledgeGraph';
import { MINH_ANH } from '../../src/scenario/minhAnh';
import { EXPECTED_OUTCOME, PATHWAY_PROPOSED, PATHWAY_UPDATED } from '../../src/scenario/orchestration';
import { CANNED_TOPICS, routePrompt, type ContextId } from '../../src/teacher/route';
import type { AdaptResult } from './adapt';

export interface Outcome { msg: AssistantMsg; title: string; sansTitle: boolean; plan: Plan | null }

const PATHWAY_CONCEPTS: ConceptId[] = ['negation', 'implication', 'implication', 'equivalence'];
const FOLLOW_UP_CONCEPTS: ConceptId[] = ['equivLaws', 'applications', 'equivLaws'];

const session = (time: string, title: string, minutes: number, concept: ConceptId | null, isMasteryCheck = false, studentId: string | null = null): PlanSession =>
  ({ time, title, minutes, concept, isMasteryCheck, studentId });

/** Moves "Today" times later so the first session starts at least 30 minutes after the story clock. */
function shifted(times: string[], clock: number): string[] {
  const shift = Math.max(0, clock + 30 - parseTime(times[0])!);
  return times.map((t) => fmt(parseTime(t)! + shift));
}

/** The draft's three proposals as real plans (offline mode still runs the whole loop). */
export function cannedPlan(state: DemoState, topic: ContextId, id: string, conversationId: string): Plan {
  const base = { id, conversationId, status: 'proposed' as const };
  if (topic === 'student') {
    const times = shifted(PATHWAY_PROPOSED.map((p) => p.when.replace('Today ', '')), state.clock);
    return {
      ...base, kind: 'pathway', title: 'Rebuild implication, then equivalence', studentIds: [MINH_ANH.id], day: 'Today',
      rationale: 'Almost every lost mark traces back to implication.', outcome: EXPECTED_OUTCOME,
      sessions: PATHWAY_PROPOSED.map((p, i) => session(times[i], p.title, p.mins, PATHWAY_CONCEPTS[i], i === PATHWAY_PROPOSED.length - 1)),
    };
  }
  if (topic === 'class') {
    const affected = state.students.filter((s) => s.status !== 'onTrack').map((s) => s.id);
    return {
      ...base, kind: 'classActivity', title: 'Group recap + adaptive practice', studentIds: affected, day: 'Thursday',
      rationale: 'Guided conceptual practice worked in 82% of similar cases.', outcome: 'Class mastery on equivalence ≥ 0.60 by Quiz 3',
      sessions: [session('10:00', '15-min recap in tutorial · whole class', 15, null), session('10:15', `Adaptive practice set · ${affected.length} students`, 20, null)],
    };
  }
  const people = COMPLEX.map((i) => state.students[i]);
  return {
    ...base, kind: 'checkIns', title: '15-minute check-ins', studentIds: people.map((p) => p.id), day: 'Friday',
    rationale: 'No mastery gain after 2 sessions: a conversation will help more than more practice.', outcome: 'A plan you’ve agreed with each student',
    sessions: people.map((p, i) => session(['14:00', '14:20', '14:40'][i], `Check-in · ${p.name}`, 15, null, false, p.id)),
  };
}

/** Offline answer: the draft's canned topic copy, with a real plan behind its panel. */
export function cannedAnswer(state: DemoState, text: string, ids: { planId: string; conversationId: string }): Outcome {
  const topic = routePrompt(text);
  const offline = (canned: AssistantMsg['canned'], followUps: string[], panel: LivePanel | null): AssistantMsg =>
    ({ role: 'assistant', source: 'offline', blocks: [], canned, followUps, panel, stamp: null });
  if (!topic) return { msg: offline('fallback', [], null), title: text.length > 40 ? `${text.slice(0, 39)}…` : text, sansTitle: false, plan: null };
  const plan = cannedPlan(state, topic, ids.planId, ids.conversationId);
  const panel: LivePanel = topic === 'student'
    ? { kind: 'student', studentId: MINH_ANH.id, planId: plan.id, highlight: null }
    : topic === 'class' ? { kind: 'class', planId: plan.id } : { kind: 'checkIns', planId: plan.id };
  return { msg: offline(topic, CANNED_TOPICS[topic].followUps, panel), title: CANNED_TOPICS[topic].title, sansTitle: false, plan };
}

/** Offline adapt: the result in one line and the video's follow-up, auto-approved. */
export function cannedAdapt(state: DemoState, plan: Plan, before: Mastery, followUpId: string): AdaptResult {
  const s = studentById(state, plan.studentIds[0])!;
  const target = plan.sessions.find((x) => x.isMasteryCheck)?.concept ?? 'equivalence';
  const reached = s.mastery[target] >= 0.75;
  const followUp: Plan = {
    id: followUpId, kind: 'pathway', title: 'Next: equivalence laws in practice', studentIds: [s.id], day: 'Tomorrow',
    rationale: 'Builds on tonight’s mastery check.', outcome: 'Equivalence laws mastery ≥ 0.60', status: 'autoApproved', conversationId: plan.conversationId,
    sessions: PATHWAY_UPDATED.map((p, i) => session(p.when.replace('Tomorrow ', ''), p.title, p.mins, FOLLOW_UP_CONCEPTS[i], i === PATHWAY_UPDATED.length - 1)),
  };
  return {
    blocks: [
      { kind: 'p', cites: [], text: `${s.short} finished tonight’s mastery check: ${conceptById(target).label.toLowerCase()} **${before[target].toFixed(2)} → ${s.mastery[target].toFixed(2)}**. ${reached ? `${s.short} has reached the target.` : 'Still short of the 0.75 target.'}` },
      { kind: 'p', cites: [], text: 'Next up: **equivalence laws in practice**. Within your policy, I’ve sent a 3-session follow-up for tomorrow.' },
    ],
    followUp,
  };
}
