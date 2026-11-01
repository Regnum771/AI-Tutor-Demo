import type Anthropic from '@anthropic-ai/sdk';
import { fmt } from '../../src/live/clock';
import { classKpis, topicMastery } from '../../src/live/mastery';
import type { DemoState, EvidenceKind, StudentProfile } from '../../src/live/types';
import { examOutlook, examRisk } from '../../src/live/study/outlook';
import { fullDate } from '../../src/scenario/course';
import { GROUPS } from '../../src/scenario/classroom';
import { CONCEPTS, conceptById, type ConceptId } from '../../src/scenario/knowledgeGraph';
import { TWIN_FOCUS } from '../../src/scenario/minhAnh';
import { choseConverse } from '../../src/scenario/roster';

export const CONCEPT_IDS: ConceptId[] = CONCEPTS.map((c) => c.id);

/** Strict object schema: every property required, nothing else allowed. */
export const obj = (properties: Record<string, unknown>) => ({
  type: 'object' as const, properties, required: Object.keys(properties), additionalProperties: false,
});

export const tool = (name: string, description: string, properties: Record<string, unknown>): Anthropic.Beta.BetaTool => ({
  name, description, input_schema: obj(properties), strict: true,
});

const EVIDENCE_KINDS: EvidenceKind[] = ['quiz', 'activity', 'attendance', 'message', 'taNote', 'record', 'practice'];

export const READ_TOOLS: Anthropic.Beta.BetaTool[] = [
  tool('get_class_overview', 'Class KPIs, average mastery per concept, Week 6 topic mastery per tutorial group, the escalation list and class-level evidence (with ids you can cite).', {}),
  tool('find_students', 'List students matching filters (use "" or -1 to leave a filter out). Returns id, name, group, status, escalation and topic mastery, plus the filtered concept value. "examRisk" means students with a study plan whose exam estimate is At risk or Unlikely. mistake "converse" names the students whose own Quiz 2 Q4 response chose the converse q → p.', {
    status: { type: 'string', enum: ['', 'onTrack', 'support', 'highRisk', 'escalated', 'examRisk'] },
    concept: { type: 'string', enum: ['', ...CONCEPT_IDS] },
    below: { type: 'number', description: 'With concept: only students below this mastery (0–1). -1 for no limit.' },
    name: { type: 'string', description: 'Part of a name (accents optional), or "".' },
    mistake: { type: 'string', enum: ['', 'converse'], description: 'converse: only students whose Quiz 2 Q4 answer chose the converse q → p.' },
  }),
  tool('get_student', "One student's learning twin: mastery per concept, status, quiz scores, practice per week, gaps (focus concepts below 0.50) and plans.", {
    student_id: { type: 'string' },
  }),
  tool('get_evidence', "A student's evidence entries (quiz items, LMS activity, attendance, messages, TA notes, records, practice). Cite entries by id.", {
    student_id: { type: 'string' },
    kind: { type: 'string', enum: ['', ...EVIDENCE_KINDS] },
  }),
  tool('compare_students', 'Mastery per concept for several students side by side.', {
    student_ids: { type: 'array', items: { type: 'string' } },
  }),
  tool('get_exam_outlook', "A student's road to the final exam: projected score and band (estimates), mastery per learning outcome (CLO), minutes planned and done against the current plan, assessment marks so far (for example Quiz 3), the next assessment, and the last change to the study plan with its reason. setUp is false until the student has set up on the phone.", {
    student_id: { type: 'string' },
  }),
];

const round2 = (v: number) => Math.round(v * 100) / 100;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();

function studentOf(state: DemoState, id: unknown): StudentProfile {
  const s = state.students.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown student id ${String(id)}. Use find_students to look ids up.`);
  return s;
}

function overview(state: DemoState) {
  const k = classKpis(state.students);
  return {
    course: 'Discrete Mathematics · DM-2026 · Week 6 (logical equivalence)',
    now: fmt(state.clock),
    date: fullDate(state.day),
    students: k.students,
    needSupport: k.needSupport,
    highRisk: k.highRisk,
    avgTopicMastery: k.avgMastery,
    escalated: state.students.filter((s) => s.escalated).map((s) => ({ id: s.id, name: s.name })),
    conceptAverages: Object.fromEntries(CONCEPT_IDS.map((c) => [c, round2(mean(state.students.map((s) => s.mastery[c])))])),
    topicMasteryByGroup: Object.fromEntries(GROUPS.map((g) => [g, round2(mean(state.students.filter((s) => s.group === g).map((s) => topicMastery(s.mastery))))])),
    evidence: state.classEvidence,
  };
}

function find(state: DemoState, input: Record<string, unknown>) {
  let list = state.students;
  const status = String(input.status ?? '');
  if (status === 'escalated') list = list.filter((s) => s.escalated);
  else if (status === 'examRisk') list = examRisk(state);
  else if (status) list = list.filter((s) => s.status === status);
  const name = fold(String(input.name ?? ''));
  if (name) list = list.filter((s) => fold(s.name).includes(name));
  const concept = CONCEPT_IDS.find((c) => c === input.concept);
  const below = Number(input.below ?? -1);
  if (concept && below >= 0) list = list.filter((s) => s.mastery[concept] < below);
  if (input.mistake === 'converse') list = list.filter(choseConverse);
  return list.map((s) => ({
    id: s.id, name: s.name, group: s.group, status: s.status, escalated: s.escalated, topicMastery: topicMastery(s.mastery),
    ...(concept ? { [concept]: s.mastery[concept] } : {}),
  }));
}

function twin(state: DemoState, s: StudentProfile) {
  return {
    id: s.id, name: s.name, group: s.group, status: s.status, escalated: s.escalated, mastery: s.mastery,
    quiz: s.quiz, practicePerWeek: s.practicePerWeek,
    gaps: TWIN_FOCUS.filter((c) => s.mastery[c] < 0.5),
    evidenceCount: s.evidence.length,
    plans: state.plans.filter((p) => p.studentIds.includes(s.id)).map((p) => ({ id: p.id, kind: p.kind, title: p.title, status: p.status })),
  };
}

/** Executes a read tool against a state snapshot. Throws (→ error tool result) on bad input. */
export function readTool(state: DemoState, name: string, input: Record<string, unknown>): unknown {
  switch (name) {
    case 'get_class_overview': return overview(state);
    case 'find_students': return find(state, input);
    case 'get_student': return twin(state, studentOf(state, input.student_id));
    case 'get_evidence': {
      const s = studentOf(state, input.student_id);
      // The phone's result and planId stay out of what agents read.
      return s.evidence.filter((e) => !input.kind || e.kind === input.kind).map(({ result: _result, planId: _planId, ...e }) => e);
    }
    case 'get_exam_outlook': return examOutlook(state, studentOf(state, input.student_id));
    case 'compare_students':
      return (Array.isArray(input.student_ids) ? input.student_ids : []).map((id) => {
        const s = studentOf(state, id);
        return { id: s.id, name: s.name, mastery: s.mastery };
      });
    default: throw new Error(`Unknown tool ${name}.`);
  }
}

const KIND_LABEL: Record<EvidenceKind, string> = {
  quiz: 'quiz responses', activity: 'LMS activity', attendance: 'attendance', message: 'messages', taNote: 'TA notes', record: 'academic records', practice: 'practice results',
};

/** The thinking line shown for a read tool call. */
export function readLabel(state: DemoState, name: string, input: Record<string, unknown>): string | null {
  const who = (id: unknown) => state.students.find((s) => s.id === id)?.short ?? 'a student';
  const p = 'Student Analysis Agent ·';
  switch (name) {
    case 'get_class_overview': return `${p} reading the class overview`;
    case 'find_students': {
      const concept = CONCEPT_IDS.find((c) => c === input.concept);
      return concept && Number(input.below) >= 0 ? `${p} finding students below ${Number(input.below)} on ${conceptById(concept).label}` : `${p} searching the class`;
    }
    case 'get_student': return `${p} reading ${who(input.student_id)}’s learning twin`;
    case 'get_evidence': return `${p} reading ${who(input.student_id)}’s ${KIND_LABEL[input.kind as EvidenceKind] ?? 'evidence'}`;
    case 'compare_students': return `${p} comparing ${Array.isArray(input.student_ids) ? input.student_ids.length : 0} learning twins`;
    case 'get_exam_outlook': return `${p} reading ${who(input.student_id)}’s road to the exam`;
    default: return null;
  }
}
