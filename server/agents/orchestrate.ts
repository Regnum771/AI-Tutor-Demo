import { fmt } from '../../src/live/clock';
import { planById, studentById } from '../../src/live/reducer';
import type { AssistantMsg, ChatMsg, DemoState, LiveBlock, LivePanel, Plan } from '../../src/live/types';
import { CANNED_TOPICS } from '../../src/teacher/route';
import { adaptMessages, adaptSpec, type AdaptResult } from './adapt';
import { cannedAdapt, cannedAnswer, type Outcome } from './canned';
import type { MessagesClient } from './client';
import { runAgent } from './loop';
import { sasMessages, sasSpec, type Focus, type Turn } from './sas';
import { tasMessages, tasSpec } from './tas';

export interface Deps {
  client: MessagesClient | null;
  newPlanId(): string;
  onStep(line: string): void;
  signal?: AbortSignal;
}

const ASKS_FOR_PLAN = /\b(plan|intervention|what should i do|schedule|follow-?up)\b/i;
const NO_PLAN = 'I couldn’t draft a plan within your policy.';

const warn = (what: string, e: unknown) => console.warn(`[beyond] ${what} failed, answering offline:`, e instanceof Error ? e.message : e);

const textOf = (m: ChatMsg): string => {
  if (m.role === 'teacher') return m.text;
  if (m.canned) return `[Answered offline about: ${m.canned === 'fallback' ? 'nothing specific' : CANNED_TOPICS[m.canned].title}]`;
  return m.blocks.map((b) => (b.kind === 'li' ? '- ' : '') + b.text).join('\n');
};

export const historyOf = (msgs: ChatMsg[]): Turn[] => msgs.map((m) => ({ role: m.role === 'teacher' ? 'user' : 'assistant', text: textOf(m) }));

/** The plan still waiting for approval in a conversation, if any. */
export const openPlanOf = (state: DemoState, conversationId: string): Plan | null =>
  [...state.plans].reverse().find((p) => p.conversationId === conversationId && p.status === 'proposed') ?? null;

function panelFor(focus: Focus, plan: Plan | null): LivePanel | null {
  if (plan?.kind === 'checkIns') return { kind: 'checkIns', planId: plan.id };
  if (focus.kind === 'student') return { kind: 'student', studentId: focus.studentId, planId: plan?.kind === 'pathway' ? plan.id : null, highlight: null };
  if (focus.kind === 'class' || plan?.kind === 'classActivity') return { kind: 'class', planId: plan?.kind === 'classActivity' ? plan.id : null };
  if (plan?.kind === 'pathway') return { kind: 'student', studentId: plan.studentIds[0], planId: plan.id, highlight: null };
  return null;
}

/** One teacher question: SAS, then TAS when a plan is wanted; canned answers when the agents are unavailable. */
export async function answer(state: DemoState, history: ChatMsg[], conversationId: string, text: string, deps: Deps): Promise<Outcome> {
  const offline = () => cannedAnswer(state, text, { planId: deps.newPlanId(), conversationId });
  if (!deps.client) return offline();
  const openPlan = openPlanOf(state, conversationId);
  try {
    const report = await runAgent(deps.client, sasSpec(state), sasMessages(historyOf(history), text, state, openPlan), deps);
    let plan: Plan | null = null;
    const extra: LiveBlock[] = [];
    if (report.needsPlan || report.revisePlan || ASKS_FOR_PLAN.test(text)) {
      const revising = report.revisePlan && openPlan !== null;
      deps.onStep(revising ? 'Teaching Assistance Agent · revising the plan' : 'Teaching Assistance Agent · drafting a plan');
      try {
        plan = await runAgent(deps.client, tasSpec(state, conversationId, revising ? openPlan.id : deps.newPlanId()), tasMessages(state, text, report, revising ? openPlan : null), deps);
      } catch (e) {
        if (deps.signal?.aborted) throw e;
        extra.push({ kind: 'p', text: NO_PLAN, cites: [] });
      }
    }
    return {
      msg: { role: 'assistant', source: 'agents', blocks: [...report.blocks, ...extra], canned: null, followUps: report.followUps, panel: panelFor(report.focus, plan), stamp: null },
      title: report.title,
      sansTitle: report.focus.kind === 'student',
      plan,
    };
  } catch (e) {
    if (deps.signal?.aborted) throw e;
    warn('agents', e);
    return offline();
  }
}

/** After a mastery check: the unprompted update and, maybe, a follow-up plan. */
export async function adaptAfterCheck(state: DemoState, planId: string, deps: Deps): Promise<{ msg: AssistantMsg; followUp: Plan | null }> {
  const plan = planById(state, planId)!;
  const before = state.phone.before ?? studentById(state, plan.studentIds[0])!.mastery;
  const followUpId = deps.newPlanId();
  let result: AdaptResult | null = null;
  let source: AssistantMsg['source'] = 'agents';
  if (deps.client) {
    try {
      deps.onStep('Teaching Assistance Agent · reviewing tonight’s mastery check');
      result = await runAgent(deps.client, adaptSpec(state, plan, followUpId), adaptMessages(state, plan, before), deps);
    } catch (e) {
      if (deps.signal?.aborted) throw e;
      warn('adapt', e);
    }
  }
  if (!result) {
    result = cannedAdapt(state, plan, before, followUpId);
    source = 'offline';
  }
  return {
    msg: {
      role: 'assistant', source, blocks: result.blocks, canned: null, followUps: [], stamp: fmt(state.clock),
      panel: { kind: 'student', studentId: plan.studentIds[0], planId: result.followUp?.id ?? plan.id, highlight: null },
    },
    followUp: result.followUp,
  };
}
