import type Anthropic from '@anthropic-ai/sdk';
import { fmt } from '../../src/live/clock';
import { planProblems } from '../../src/live/plans';
import { studentById } from '../../src/live/reducer';
import type { DemoState, Plan, PlanKind, PlanStatus } from '../../src/live/types';
import { fullDate, resolveDay } from '../../src/scenario/course';
import { BANK_CONCEPTS } from '../../src/scenario/practiceBank';
import type { AgentSpec, Check } from './loop';
import { planBrief, type Report } from './sas';
import { CONCEPT_IDS, obj, READ_TOOLS, readLabel, readTool, tool } from './tools';

export const SESSIONS_SCHEMA = {
  type: 'array',
  items: obj({
    time: { type: 'string', description: 'HH:MM, 24-hour.' },
    title: { type: 'string' },
    minutes: { type: 'integer' },
    concept: { type: 'string', enum: ['none', ...CONCEPT_IDS] },
    is_mastery_check: { type: 'boolean' },
    student_id: { type: 'string', description: 'checkIns: the student for this slot; otherwise "".' },
  }),
};

const PLAN_TOOL = tool('propose_plan', 'Propose the plan. Call this once, last.', {
  kind: { type: 'string', enum: ['pathway', 'classActivity', 'checkIns'] },
  title: { type: 'string', description: 'Short plan title, e.g. "Rebuild implication, then equivalence".' },
  student_ids: { type: 'array', items: { type: 'string' } },
  day: { type: 'string', description: '"Today", "Tomorrow" or a weekday name.' },
  sessions: SESSIONS_SCHEMA,
  rationale: { type: 'string', description: 'One sentence on why this plan fits the diagnosis.' },
  outcome: { type: 'string', description: 'What success looks like, e.g. "Logical equivalence mastery ≥ 0.75 within 3 sessions".' },
});

export const TAS_SYSTEM = `You are the Teaching Assistance Agent in Beyond. The Student Analysis Agent has diagnosed a question from the lecturer, Lam (Discrete Mathematics, DM-2026, Week 6: logical equivalence). Turn the diagnosis into one plan the lecturer can approve. All data is fictional demo data. Refer to students by name; do not assume anyone's pronouns.

Pick the kind:
- pathway: short adaptive practice on one student's phone. 2–4 sessions, at most 45 minutes in total, each on one concept, building prerequisites first. The last session is the mastery check on the target concept (is_mastery_check true). Sessions run 5–12 minutes. Use logical equivalence as the target unless the question is about something else. Include at least one practice session on the target concept before the mastery check, and do not repeat any other concept.
- classActivity: an in-class activity for a group with a shared gap (for example a 15-minute recap in Thursday's tutorial), listing the affected student ids. 1–2 sessions.
- checkIns: 15-minute conversations with up to 5 students who need the lecturer personally (for example those on the escalation list). One session per student, with student_id set.

Times are 24-hour HH:MM. For day "Today", every session must be after the current story time. Use concept "none" for sessions without a practice concept (class activities and check-ins).

If an open plan is given, change only what the lecturer asked and keep every other session exactly as it is. Do not add, remove or reorder sessions unless asked.

You may look things up with the read tools. Then call propose_plan. Always finish with propose_plan.`;

type Meta = { id: string; conversationId: string; status: PlanStatus; today: number };

const dayOf = (raw: unknown): string => {
  const d = String(raw ?? 'Today').trim();
  return /^today$/i.test(d) ? 'Today' : /^tomorrow$/i.test(d) ? 'Tomorrow' : d;
};

/** propose_plan input → Plan (not yet checked against the policy). */
export function toPlan(input: unknown, meta: Meta): Plan {
  const r = input as Record<string, unknown>;
  const kind: PlanKind = (['pathway', 'classActivity', 'checkIns'] as const).find((k) => k === r.kind) ?? 'pathway';
  const sessions = (Array.isArray(r.sessions) ? r.sessions : []).map((x) => {
    const s = x as Record<string, unknown>;
    return {
      time: String(s.time ?? ''),
      title: String(s.title ?? 'Session'),
      minutes: Number(s.minutes ?? 0),
      concept: CONCEPT_IDS.find((c) => c === s.concept) ?? null,
      isMasteryCheck: s.is_mastery_check === true,
      studentId: s.student_id ? String(s.student_id) : null,
    };
  });
  let studentIds = Array.isArray(r.student_ids) ? r.student_ids.map(String) : [];
  if (kind === 'checkIns' && studentIds.length === 0) studentIds = sessions.flatMap((s) => (s.studentId ? [s.studentId] : []));
  const day = dayOf(r.day);
  return {
    id: meta.id, kind, title: String(r.title ?? 'Plan'), studentIds, day, date: resolveDay(day, meta.today), baseline: null, sessions,
    rationale: String(r.rationale ?? ''), outcome: String(r.outcome ?? ''), status: meta.status, conversationId: meta.conversationId,
  };
}

export const checkPlan = (state: DemoState, planId: string, conversationId: string): Check<Plan> => (input) => {
  const plan = toPlan(input, { id: planId, conversationId, status: 'proposed', today: state.day });
  const problems = planProblems(plan, state);
  return problems.length
    ? { ok: false, error: `The plan breaks the policy: ${problems.join(' ')} Fix it and call propose_plan again.` }
    : { ok: true, value: plan };
};

/** Read-tool labels, attributed to this agent. */
export const tasLabel = (state: DemoState, name: string, input: Record<string, unknown>): string | null =>
  readLabel(state, name, input)?.replace('Student Analysis Agent', 'Teaching Assistance Agent') ?? null;

export const tasSpec = (state: DemoState, conversationId: string, planId: string): AgentSpec<Plan> => ({
  system: TAS_SYSTEM,
  tools: [...READ_TOOLS, PLAN_TOOL],
  finish: 'propose_plan',
  check: checkPlan(state, planId, conversationId),
  exec: (name, input) => readTool(state, name, input),
  label: (name, input) => tasLabel(state, name, input),
});

export function tasMessages(state: DemoState, question: string, report: Report, openPlan: Plan | null): Anthropic.Beta.BetaMessageParam[] {
  const focus = report.focus.kind === 'student'
    ? `student ${report.focus.studentId} (${studentById(state, report.focus.studentId)?.name ?? 'unknown'})`
    : report.focus.kind;
  const lines = [
    `Lecturer's question: ${question}`,
    `Diagnosis from the Student Analysis Agent:\n${report.blocks.map((b) => (b.kind === 'li' ? '- ' : '') + b.text).join('\n')}`,
    `Focus: ${focus}. Gap concepts: ${report.gaps.join(', ') || 'none named'}.`,
    `Students on the escalation list: ${state.students.filter((s) => s.escalated).map((s) => s.id).join(', ') || 'none'}.`,
    `Concepts with practice items (pathway sessions may use only these): ${BANK_CONCEPTS.join(', ')}.`,
    `Story time now: ${fullDate(state.day)}, ${fmt(state.clock)} (day "Today").`,
    `Open plan to revise: ${openPlan ? JSON.stringify(planBrief(openPlan)) : 'none'}.`,
  ];
  return [{ role: 'user', content: lines.join('\n\n') }];
}
