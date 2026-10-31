import type Anthropic from '@anthropic-ai/sdk';
import { fmt } from '../../src/live/clock';
import { planProblems, withinFollowUpPolicy } from '../../src/live/plans';
import { studentById } from '../../src/live/reducer';
import type { DemoState, LiveBlock, Mastery, Plan } from '../../src/live/types';
import { conceptById, type ConceptId } from '../../src/scenario/knowledgeGraph';
import { TWIN_FOCUS } from '../../src/scenario/minhAnh';
import { BANK_CONCEPTS } from '../../src/scenario/practiceBank';
import type { AgentSpec, Check } from './loop';
import { BLOCKS_SCHEMA, checkBlocks } from './sas';
import { SESSIONS_SCHEMA, tasLabel, toPlan } from './tas';
import { CONCEPT_IDS, obj, READ_TOOLS, readTool, tool } from './tools';

export interface AdaptResult { blocks: LiveBlock[]; followUp: Plan | null }

const ADAPT_TOOL = tool('adapt_report', 'Report the result to the lecturer and decide on a follow-up. Call this once, last.', {
  blocks: BLOCKS_SCHEMA,
  follow_up_needed: { type: 'boolean' },
  follow_up: obj({
    title: { type: 'string' },
    day: { type: 'string', description: 'Use "Tomorrow".' },
    sessions: SESSIONS_SCHEMA,
    rationale: { type: 'string' },
    outcome: { type: 'string' },
  }),
});

export const ADAPT_SYSTEM = `You are the Teaching Assistance Agent in Beyond. A student has just finished the mastery check of a plan the lecturer, Lam, approved. All data is fictional demo data.

Write the short unprompted update the lecturer sees: two short paragraphs, under 70 words in total. First the result, with the key figure in **bold**; then what happens next. The target is 0.75 on the plan's target concept. Use the student's name; do not assume anyone's pronouns. Use cites: [] unless you cite an evidence id the tools returned.

If a focus concept is still below 0.50, or the target was missed, set follow_up_needed and give a pathway for "Tomorrow" (times between 09:00 and 20:00): 2–3 sessions of 5–12 minutes on concepts with practice items, building on tonight's work, with the mastery check last. Otherwise set follow_up_needed false and leave follow_up with empty strings and no sessions.

Always finish with adapt_report.`;

export const checkAdapt = (state: DemoState, plan: Plan, followUpId: string): Check<AdaptResult> => (input) => {
  const r = input as Record<string, unknown>;
  const blocks = checkBlocks(state, r.blocks);
  if (!blocks.ok) return blocks;
  if (r.follow_up_needed !== true) return { ok: true, value: { blocks: blocks.value, followUp: null } };
  const draft = toPlan({ ...(r.follow_up as object), kind: 'pathway', student_ids: plan.studentIds }, { id: followUpId, conversationId: plan.conversationId, status: 'proposed' });
  const problems = planProblems(draft, state);
  if (problems.length) return { ok: false, error: `The follow-up breaks the policy: ${problems.join(' ')} Fix it and call adapt_report again.` };
  return { ok: true, value: { blocks: blocks.value, followUp: withinFollowUpPolicy(draft, state) ? { ...draft, status: 'autoApproved' } : draft } };
};

export const adaptSpec = (state: DemoState, plan: Plan, followUpId: string): AgentSpec<AdaptResult> => ({
  system: ADAPT_SYSTEM,
  tools: [...READ_TOOLS, ADAPT_TOOL],
  finish: 'adapt_report',
  check: checkAdapt(state, plan, followUpId),
  exec: (name, input) => readTool(state, name, input),
  label: (name, input) => tasLabel(state, name, input),
});

export function adaptMessages(state: DemoState, plan: Plan, before: Mastery): Anthropic.Beta.BetaMessageParam[] {
  const s = studentById(state, plan.studentIds[0])!;
  const label = (c: ConceptId) => conceptById(c).label;
  const changes = CONCEPT_IDS.filter((c) => s.mastery[c] !== before[c]).map((c) => `${label(c)} ${before[c].toFixed(2)} → ${s.mastery[c].toFixed(2)}`);
  const target = plan.sessions.find((x) => x.isMasteryCheck)?.concept ?? 'equivalence';
  const lines = [
    `${s.name} (${s.id}; call them ${s.short}) just finished the mastery check of “${plan.title}”.`,
    `Target concept: ${label(target)} (target 0.75), now ${s.mastery[target].toFixed(2)}.`,
    `Mastery changes tonight: ${changes.join('; ') || 'none'}.`,
    `Focus concepts still below 0.50: ${TWIN_FOCUS.filter((c) => s.mastery[c] < 0.5).map(label).join(', ') || 'none'}.`,
    `Story time now: ${fmt(state.clock)}. Concepts with practice items: ${BANK_CONCEPTS.join(', ')}.`,
    'Policy: a pathway follow-up of at most 3 sessions is sent without asking; anything bigger waits for the lecturer.',
  ];
  return [{ role: 'user', content: lines.join('\n') }];
}
