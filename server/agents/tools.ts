import type Anthropic from '@anthropic-ai/sdk';
import { fmt } from '../../src/live/clock';
import { classKpis, topicMastery } from '../../src/live/mastery';
import type { DemoState, EvidenceKind, StudentProfile } from '../../src/live/types';
import { examOutlook, examRisk } from '../../src/live/study/outlook';
import { forecast } from '../../src/live/study/estimate';
import { fullDate, LECTURES, lectureLabel, shortDate } from '../../src/scenario/course';
import { GROUPS } from '../../src/scenario/classroom';
import { CONCEPTS, conceptById, type ConceptId } from '../../src/scenario/knowledgeGraph';
import { TWIN_FOCUS } from '../../src/scenario/minhAnh';
import { FAQ, faqLog, faqStats, voiceEvidenceId } from '../../src/scenario/voice';
import { choseConverse } from '../../src/scenario/roster';
import { classEngagement, engagement, isReleased, RESOURCES } from '../../src/scenario/materials';

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
  tool('get_student', "One student's learning twin: mastery per concept, status, quiz scores (percent), practice per week, gaps (focus concepts below 0.50) and plans. Also gpa (4-point scale), history (previous subjects, 10-point grades with letters) and forecast (out of 10 now, with its band; an estimate). Mastery is 0 to 1.", {
    student_id: { type: 'string' },
  }),
  tool('get_evidence', "A student's evidence entries (quiz items, LMS activity, attendance, messages, TA notes, records, practice). Cite entries by id.", {
    student_id: { type: 'string' },
    kind: { type: 'string', enum: ['', ...EVIDENCE_KINDS] },
  }),
  tool('compare_students', 'Mastery per concept for several students side by side.', {
    student_ids: { type: 'array', items: { type: 'string' } },
  }),
  tool('get_exam_outlook', "A student's road to the final exam: forecast out of 10 now (pass 4.0), the forecast if the current plan is kept, and the band (all estimates), mastery per learning outcome (CLO), minutes planned and done against the current plan, practisedLast7Days (minutes done and planned over the last 7 days; little or nothing done means the student has stopped practising), assessment marks so far (for example Quiz 3), the next assessment, and the last change to the study plan with its reason. setUp is false until the student has set up on the phone.", {
    student_id: { type: 'string' },
  }),
  tool('get_class_questions', 'What students have been asking on Zalo, email, WhatsApp and the LMS forum, grouped into FAQ entries: the question, what confuses them, the concept, how many students and messages, when they ask relative to the lectures, and the evidence ids of the messages (cite these).', {}),
  tool('get_lecture_materials', "The course's learning materials (slides, recordings, worksheets, readings, short videos) with their resource ids (cite these): lecture and its date, kind, title, concepts, Bloom level, minutes, source, released (false before the lecture) and classEngagement (opened of 55, and meanFraction: the mean share worked through by those who opened it). With student_id, each also carries that student's opened and fraction. Readings name a textbook section and have no link. Use -1 or \"\" to leave a filter out.", {
    lecture: { type: 'number', description: 'Lecture 1–9, or -1 for every lecture.' },
    concept: { type: 'string', enum: ['', ...CONCEPT_IDS] },
    student_id: { type: 'string', description: 'A student id such as s17, or "".' },
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
    gpa: s.gpa,
    history: s.history,
    forecast: forecast(s, state.study[s.id]),
    gaps: TWIN_FOCUS.filter((c) => s.mastery[c] < 0.5),
    evidenceCount: s.evidence.length,
    plans: state.plans.filter((p) => p.studentIds.includes(s.id)).map((p) => ({ id: p.id, kind: p.kind, title: p.title, status: p.status })),
  };
}

function materials(state: DemoState, input: Record<string, unknown>) {
  const lecture = Number(input.lecture ?? -1);
  if (lecture !== -1 && !LECTURES.some((l) => l.n === lecture)) throw new Error(`Unknown lecture ${String(input.lecture)}. Lectures run from 1 to ${LECTURES.length}; use -1 for every lecture.`);
  const concept = String(input.concept ?? '');
  if (concept && !CONCEPT_IDS.includes(concept as ConceptId)) throw new Error(`Unknown concept ${concept}. Use one of ${CONCEPT_IDS.join(', ')}, or "" for any.`);
  const student = input.student_id ? studentOf(state, input.student_id) : null;
  const time = fmt(state.clock);
  return RESOURCES
    .filter((r) => (lecture === -1 || r.lecture === lecture) && (!concept || r.concepts.includes(concept as ConceptId)))
    .map((r) => ({
      id: r.id, lecture: r.lecture, lectureDate: shortDate(LECTURES[r.lecture - 1].day), kind: r.kind, title: r.title, concepts: r.concepts,
      bloom: r.bloom, minutes: r.minutes, source: r.source,
      released: isReleased(r, state.day, time),
      classEngagement: classEngagement(r.id, state.day),
      ...(student ? engagement(r.id, student.index, state.day) : {}),
    }));
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
      return s.evidence
        .filter((e) => !input.kind || e.kind === input.kind)
        .map(({ result: _result, planId: _planId, ...e }) => (e.day !== undefined && e.time ? { ...e, lecture: lectureLabel(e.day, e.time) } : e));
    }
    case 'get_exam_outlook': return examOutlook(state, studentOf(state, input.student_id));
    case 'compare_students':
      return (Array.isArray(input.student_ids) ? input.student_ids : []).map((id) => {
        const s = studentOf(state, id);
        return { id: s.id, name: s.name, mastery: s.mastery };
      });
    case 'get_class_questions':
      return FAQ.map((f) => {
        const stats = faqStats(f.id);
        return { ...f, ...stats, latestDate: shortDate(stats.latestDay), evidenceIds: faqLog(f.id).map(voiceEvidenceId) };
      }).sort((a, b) => b.students - a.students || b.messages - a.messages);
    case 'get_lecture_materials': return materials(state, input);
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
    case 'get_class_questions': return `${p} reading what students are asking`;
    case 'get_lecture_materials': return Number(input.lecture) > 0 ? `${p} reading the materials for Lecture ${Number(input.lecture)}` : `${p} reading the learning materials`;
    default: return null;
  }
}
