import type Anthropic from '@anthropic-ai/sdk';
import { fmt } from '../../src/live/clock';
import type { DemoState, LiveBlock, Plan } from '../../src/live/types';
import { fullDate } from '../../src/scenario/course';
import type { ConceptId } from '../../src/scenario/knowledgeGraph';
import type { AgentSpec, Check } from './loop';
import { CONCEPT_IDS, obj, READ_TOOLS, readLabel, readTool, tool } from './tools';

export type Focus = { kind: 'student'; studentId: string } | { kind: 'class' } | { kind: 'none' };

export interface Report {
  title: string;
  blocks: LiveBlock[];
  focus: Focus;
  gaps: ConceptId[];
  needsPlan: boolean;
  revisePlan: boolean;
  followUps: string[];
}

export interface Turn { role: 'user' | 'assistant'; text: string }

export const BLOCKS_SCHEMA = {
  type: 'array',
  description: 'Short paragraphs ("p") and bullets ("li").',
  items: obj({
    kind: { type: 'string', enum: ['p', 'li'] },
    text: { type: 'string', description: 'Plain text; **bold** allowed for key figures.' },
    cites: { type: 'array', items: { type: 'string' }, description: 'Evidence ids behind this block, exactly as the tools returned them.' },
  }),
};

const REPORT_TOOL = tool('report', 'Give your answer to the lecturer. Call this once, last.', {
  title: { type: 'string', description: '3–6 word conversation title, e.g. "Minh Anh · implication gap".' },
  blocks: BLOCKS_SCHEMA,
  focus_kind: { type: 'string', enum: ['student', 'class', 'none'] },
  focus_student_id: { type: 'string', description: 'The student id when focus_kind is "student", otherwise "".' },
  gaps: { type: 'array', items: { type: 'string', enum: CONCEPT_IDS } },
  needs_plan: { type: 'boolean', description: 'True when an intervention plan should be drafted now.' },
  revise_plan: { type: 'boolean', description: 'True when the lecturer asks to change the plan open in this conversation.' },
  follow_ups: { type: 'array', items: { type: 'string' }, description: '2–3 short questions the lecturer might ask next.' },
});

export const SAS_SYSTEM = `You are the Student Analysis Agent in Beyond, a teaching assistant for Lam (Nguyễn Thanh Lam), who lectures Discrete Mathematics (DM-2026, 55 students, Week 6: logical equivalence). All data is fictional demo data.

Answer the lecturer's question from the class data. Look things up with the tools; never invent students, figures or events. Student ids look like s17; evidence ids look like s17-quiz2-q4 or class-quiz2-q4.

Write for a busy lecturer: lead with the answer in one or two sentences, then 2–4 bullets of evidence, then one sentence on what to do next. Keep the whole answer under 140 words. Put the evidence ids behind each factual claim in that block's cites. Use **bold** for the key figures. Refer to students by name; do not assume anyone's pronouns.

Mastery runs from 0 to 1; below 0.50 on a focus concept is a gap. The Week 6 topic figure is logical equivalence. Students on the escalation list need the lecturer personally, not more automated practice.

Set needs_plan only when the lecturer asks what to do, asks for a plan, asks who needs them personally, or asks why a student or group is struggling. A factual lookup (a score, a count, a list) never sets needs_plan. A plan is drafted separately by the Teaching Assistance Agent and is limited to 4 sessions and 45 minutes in total. Never describe a plan’s length or contents in your answer; only say one is ready. If the lecturer asks for more than the limit, say so. If a plan is already open or running for that student, leave needs_plan false unless the lecturer asks for a new one. Set revise_plan when the lecturer asks to change the plan open in this conversation. Use focus_kind "student" for a question about one student, "class" for the class or a group, and "none" otherwise.

For questions about the exam, passing or readiness, use get_exam_outlook. Its score and band are an estimate, so say so; never state a pass or fail as fact. To find who may not pass, use find_students with status examRisk. To name who chose the converse on Quiz 2 Q4, use find_students with mistake converse.

When you have the answer, call the report tool. Always finish with report.`;

export function evidenceIds(state: DemoState): Set<string> {
  return new Set([...state.classEvidence.map((e) => e.id), ...state.students.flatMap((s) => s.evidence.map((e) => e.id))]);
}

type RawBlock = { kind?: unknown; text?: unknown; cites?: unknown };

/** Model blocks → LiveBlocks; rejects empty answers and cited ids that do not exist. */
export function checkBlocks(state: DemoState, raw: unknown): { ok: true; value: LiveBlock[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'blocks must contain at least one paragraph.' };
  const blocks: LiveBlock[] = (raw as RawBlock[]).map((b) => ({
    kind: b.kind === 'li' ? 'li' : 'p',
    text: String(b.text ?? ''),
    cites: Array.isArray(b.cites) ? b.cites.map(String) : [],
  }));
  if (blocks.some((b) => !b.text.trim())) return { ok: false, error: 'Every block needs text.' };
  const known = evidenceIds(state);
  const unknown = blocks.flatMap((b) => b.cites).filter((id) => !known.has(id));
  if (unknown.length) return { ok: false, error: `These evidence ids do not exist: ${unknown.join(', ')}. Cite only ids returned by the tools.` };
  return { ok: true, value: blocks };
}

export const checkReport = (state: DemoState): Check<Report> => (input) => {
  const r = input as Record<string, unknown>;
  const blocks = checkBlocks(state, r.blocks);
  if (!blocks.ok) return blocks;
  let focus: Focus = { kind: 'none' };
  if (r.focus_kind === 'student') {
    if (!state.students.some((s) => s.id === r.focus_student_id)) return { ok: false, error: `focus_student_id "${String(r.focus_student_id)}" is not a student id.` };
    focus = { kind: 'student', studentId: String(r.focus_student_id) };
  } else if (r.focus_kind === 'class') focus = { kind: 'class' };
  return {
    ok: true,
    value: {
      title: String(r.title ?? '').trim() || 'Conversation',
      blocks: blocks.value,
      focus,
      gaps: (Array.isArray(r.gaps) ? r.gaps : []).filter((g): g is ConceptId => CONCEPT_IDS.includes(g as ConceptId)),
      needsPlan: r.needs_plan === true,
      revisePlan: r.revise_plan === true,
      followUps: (Array.isArray(r.follow_ups) ? r.follow_ups : []).map(String).filter(Boolean).slice(0, 3),
    },
  };
};

export const sasSpec = (state: DemoState): AgentSpec<Report> => ({
  system: SAS_SYSTEM,
  tools: [...READ_TOOLS, REPORT_TOOL],
  finish: 'report',
  check: checkReport(state),
  exec: (name, input) => readTool(state, name, input),
  label: (name, input) => readLabel(state, name, input),
});

export const planBrief = (p: Plan) => ({ id: p.id, kind: p.kind, title: p.title, day: p.day, studentIds: p.studentIds, sessions: p.sessions, status: p.status });

/** Earlier turns as plain text, then the question with the volatile context, all after the cached prefix. */
export function sasMessages(history: Turn[], question: string, state: DemoState, openPlan: Plan | null): Anthropic.Beta.BetaMessageParam[] {
  const context = `Story time: ${fmt(state.clock)} on ${fullDate(state.day)}.\nOpen plan in this conversation: ${openPlan ? JSON.stringify(planBrief(openPlan)) : 'none'}.`;
  return [...history.map((t) => ({ role: t.role, content: t.text })), { role: 'user', content: `${context}\n\nLecturer: ${question}` }];
}
