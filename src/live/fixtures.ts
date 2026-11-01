import { resolveDay, START_DAY } from '../scenario/course';
import { seedState } from './seed';
import type { DemoState, LivePanel, Plan, PlanKind } from './types';
import type { LiveCtx } from './LiveContext';

type PlanBase = Omit<Plan, 'id' | 'status' | 'conversationId' | 'date' | 'baseline'>;

const BASE: Record<PlanKind, () => PlanBase> = {
  pathway: () => ({
    kind: 'pathway', title: 'Rebuild implication, then equivalence', studentIds: ['s17'], day: 'Today',
    rationale: 'Implication is the root gap.', outcome: 'Logical equivalence mastery ≥ 0.75',
    sessions: [
      { time: '15:30', title: 'Review implication', minutes: 8, concept: 'implication', isMasteryCheck: false, studentId: null },
      { time: '20:00', title: 'Mastery check', minutes: 10, concept: 'equivalence', isMasteryCheck: true, studentId: null },
    ],
  }),
  classActivity: () => ({
    kind: 'classActivity', title: 'Group recap', studentIds: ['s8', 's13'], day: 'Thursday',
    rationale: 'A shared gap.', outcome: 'Class mastery ≥ 0.60',
    sessions: [{ time: '10:00', title: '15-min recap in tutorial', minutes: 15, concept: null, isMasteryCheck: false, studentId: null }],
  }),
  checkIns: () => ({
    kind: 'checkIns', title: '15-minute check-ins', studentIds: ['s29', 's42'], day: 'Friday',
    rationale: 'Both are on the escalation list.', outcome: 'An agreed plan with each student',
    sessions: [
      { time: '14:00', title: 'Check-in', minutes: 15, concept: null, isMasteryCheck: false, studentId: 's29' },
      { time: '14:20', title: 'Check-in', minutes: 15, concept: null, isMasteryCheck: false, studentId: 's42' },
    ],
  }),
};

/** A valid proposed plan of each kind: id p1, conversation c1. */
export const planFor = (kind: PlanKind, over: Partial<Plan> = {}): Plan => {
  const base = BASE[kind]();
  return { ...base, date: resolveDay(base.day, START_DAY), baseline: null, id: 'p1', status: 'proposed', conversationId: 'c1', ...over };
};

const PANEL: Record<PlanKind, LivePanel> = {
  pathway: { kind: 'student', studentId: 's17', planId: 'p1', highlight: null },
  classActivity: { kind: 'class', planId: 'p1' },
  checkIns: { kind: 'checkIns', planId: 'p1' },
};

/** Seed state plus conversation c1 (one question, one agent answer) holding plan p1. */
export function stateWithPlan(kind: PlanKind = 'pathway', over: Partial<Plan> = {}): DemoState {
  const s = seedState();
  s.plans.push(planFor(kind, over));
  s.conversations.push({
    id: 'c1', title: 'Minh Anh · implication gap', sansTitle: true, pending: null,
    msgs: [
      { role: 'teacher', text: 'Why did Minh Anh’s quiz score drop?' },
      {
        role: 'assistant', source: 'agents', canned: null, stamp: null,
        blocks: [
          { kind: 'p', text: 'Quiz 2 fell from **75% to 42%**.', cites: ['s17-quiz2'] },
          { kind: 'li', text: 'She picked the converse on 6 items.', cites: ['s17-quiz2-q4'] },
        ],
        followUps: ['What gap is the class facing this week?', 'Show me her full history'],
        panel: PANEL[kind],
      },
    ],
  });
  return s;
}

/** A live context over `state` whose actions do nothing (tests). */
export const ctxFor = (state: DemoState, activeId: string | null = 'c1'): LiveCtx => ({
  state, activeId, post: async () => ({ ok: true }), openConversation: () => {}, showPanel: () => {}, toast: () => {},
});
