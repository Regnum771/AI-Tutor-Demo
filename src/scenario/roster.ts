import type { Evidence, Mastery, StudentProfile } from '../live/types';
import { COMPLEX, STUDENTS, groupOf, type Status } from './classroom';
import { CONCEPTS, type ConceptId } from './knowledgeGraph';
import { MASTERY_INITIAL, MINH_ANH } from './minhAnh';
import { MESSAGES } from './sources';

const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number) => Math.min(0.97, Math.max(0.08, v));

/** How far each concept sits from the Week 6 topic (logical equivalence): prerequisites higher, later topics lower. */
const LIFT: Record<ConceptId, number> = {
  propositions: 0.22, negation: 0.14, conjunction: 0.16, disjunction: 0.13, implication: -0.02, biconditional: -0.01,
  truthTables: 0.08, expressions: 0.06, equivalence: 0, deMorgan: -0.03, equivLaws: -0.05, applications: -0.08,
};
const jitter = (i: number, ci: number) => (((i * 31 + ci * 17) % 9) - 4) / 100;

function masteryFor(i: number, topic: number): Mastery {
  const m = {} as Mastery;
  CONCEPTS.forEach((c, ci) => {
    m[c.id] = c.id === 'equivalence' ? topic : round2(clamp(topic + LIFT[c.id] + jitter(i, ci)));
  });
  return m;
}

const quizFor = (i: number, topic: number) => {
  const q2 = Math.round(30 + topic * 65);
  return { q1: Math.min(100, q2 + ((i * 7) % 9) - 2), q2 };
};

function baseEvidence(id: string, index: number, status: Status, m: Mastery, q: { q1: number; q2: number }): Evidence[] {
  const lmsDone = Math.max(1, Math.min(6, Math.round(m.equivalence * 7)));
  const present = 6 - (index % 3 === 0 && status !== 'onTrack' ? 1 : 0);
  return [
    { id: `${id}-quiz1`, kind: 'quiz', source: 'Assessments', text: `Quiz 1: ${q.q1}%`, when: 'Week 3' },
    { id: `${id}-quiz2`, kind: 'quiz', source: 'Assessments', text: `Quiz 2: ${q.q2}%`, when: 'Week 6' },
    {
      id: `${id}-quiz2-q4`, kind: 'quiz', source: 'Quiz 2 responses', when: 'Week 6', concept: 'implication',
      text: m.implication < 0.5 ? 'Q4 (p → q ≡ ?): chose the converse q → p' : 'Q4 (p → q ≡ ?): correct',
    },
    { id: `${id}-lms`, kind: 'activity', source: 'LMS activity log', text: `${lmsDone} of 6 Week 5–6 activities complete`, when: 'Week 6' },
    { id: `${id}-attendance`, kind: 'attendance', source: 'Attendance', text: `Attended ${present} of 6 tutorials`, when: 'Week 6' },
  ];
}

interface Quirk {
  /** Replaces the text of a base entry, keyed by its slug (the part after `<id>-`). */
  replace?: Record<string, string>;
  extra?: (Omit<Evidence, 'id'> & { slug: string })[];
  quiz?: { q1: number; q2: number };
  practicePerWeek?: number;
}

/** Hand-written stories so free questions have interesting answers. Keys are student indexes. */
const QUIRKS: Record<number, Quirk> = {
  7: {
    replace: { attendance: 'Attended 6 of 6 tutorials', lms: '0 of 6 Week 5–6 activities submitted · last submission in Week 4' },
    extra: [{ slug: 'ta', kind: 'taNote', source: 'TA note · Linh', text: 'Present every week, sits at the back, has not spoken in tutorial since Week 3', when: 'Week 6' }],
    practicePerWeek: 0.2,
  },
  12: {
    extra: [{ slug: 'ta', kind: 'taNote', source: 'TA note · Linh', text: 'Family situation this month (shared in confidence); keep messages low-pressure', when: 'Week 5' }],
  },
  26: {
    extra: [{ slug: 'email', kind: 'message', source: 'Email', text: "Asks about De Morgan's laws from Quiz 2", when: 'Week 6', concept: 'deMorgan' }],
  },
  28: {
    extra: [
      { slug: 'adaptive', kind: 'activity', source: 'Beyond practice', text: 'Adaptive pathway: 2 cycles completed, no mastery gain (0.29 → 0.30)', when: 'Week 6' },
      { slug: 'ta', kind: 'taNote', source: 'TA note · Hưng', text: 'Works hard in tutorial but freezes on truth tables', when: 'Week 6' },
    ],
  },
  30: {
    extra: [{ slug: 'ta', kind: 'taNote', source: 'TA note · Hưng', text: 'Top quiz scores but silent in discussion; may be ready for challenge tasks', when: 'Week 6' }],
    quiz: { q1: 94, q2: 96 },
  },
  41: {
    replace: { attendance: 'Attended 3 of 6 tutorials · missed the last three' },
    extra: [{ slug: 'whatsapp', kind: 'message', source: 'WhatsApp', text: 'No reply to two check-in messages', when: 'Week 6' }],
  },
  45: {
    extra: [{ slug: 'officehours', kind: 'activity', source: 'Office hours', text: 'Came to office hours in Week 5; Quiz 2 up from Quiz 1', when: 'Week 5' }],
    quiz: { q1: 38, q2: 55 },
  },
  50: {
    extra: [{ slug: 'trend', kind: 'record', source: 'Academic records', text: 'Mastery falling across 3 topics since Week 4', when: 'Week 6' }],
    quiz: { q1: 61, q2: 38 },
  },
};

const MINH_ANH_EVIDENCE: Evidence[] = [
  { id: 's17-quiz1', kind: 'quiz', source: 'Assessments', text: 'Quiz 1: 75%', when: 'Week 3' },
  { id: 's17-quiz2', kind: 'quiz', source: 'Assessments', text: 'Quiz 2: 42% (down from 75%)', when: 'Week 6' },
  { id: 's17-quiz2-q4', kind: 'quiz', source: 'Quiz 2 responses', text: 'Chose the converse q → p on 6 implication items across two quizzes', when: 'Week 6', concept: 'implication' },
  { id: 's17-zalo-1', kind: 'message', source: 'Zalo', text: `“${MESSAGES[0].vi}” (${MESSAGES[0].evidence})`, when: 'Week 6', concept: 'implication' },
  { id: 's17-zalo-2', kind: 'message', source: 'Zalo', text: `“${MESSAGES[3].vi}” (${MESSAGES[3].evidence})`, when: 'Week 6', concept: 'truthTables' },
  { id: 's17-lms', kind: 'activity', source: 'LMS activity log', text: 'Truth-table lab and implication worksheet still open · last login 6 days ago', when: 'Week 6' },
  { id: 's17-attendance', kind: 'attendance', source: 'Attendance', text: 'Attended 5 of 6 tutorials · absent from tutorial 5', when: 'Week 5' },
  { id: 's17-records', kind: 'record', source: 'Academic records', text: 'Intro to Logic: C+ (68%)', when: 'Last year' },
];

const pct = (n: number, of: number) => Math.round((n / of) * 100);
const entry = (s: StudentProfile, slug: string) => s.evidence.find((e) => e.id === `${s.id}-${slug}`)?.text ?? '';
/** Tutorials attended, read from the student's own attendance entry. */
export const attendedOf = (s: StudentProfile): number => Number(/Attended (\d) of 6/.exec(entry(s, 'attendance'))?.[1] ?? 0);
/** Whether the student's own Quiz 2 Q4 entry records the converse mistake. */
export const choseConverse = (s: StudentProfile): boolean => /converse/i.test(entry(s, 'quiz2-q4'));

/** Class-level evidence computed from the profiles, so class figures and student records always agree. */
export function classEvidence(students: StudentProfile[]): Evidence[] {
  const n = students.length;
  const avg = Math.round(students.reduce((a, s) => a + s.quiz.q2, 0) / n);
  const converse = students.filter(choseConverse).length;
  const visits = students.reduce((a, s) => a + attendedOf(s), 0);
  const deMorgan = students.filter((s) => s.mastery.deMorgan < 0.5).length;
  return [
    { id: 'class-quiz2-q4', kind: 'quiz', source: 'Quiz 2 responses', text: `Q4 (p → q ≡ ?): ${converse} of ${n} chose the converse q → p (${pct(converse, n)}%)`, when: 'Week 6', concept: 'implication' },
    { id: 'class-quiz2-avg', kind: 'quiz', source: 'LMS gradebook', text: `Quiz 2 class average ${avg}%`, when: 'Week 6' },
    { id: 'class-attendance', kind: 'attendance', source: 'Attendance', text: `Tutorials so far: ${visits} of ${n * 6} attendances (${pct(visits, n * 6)}%)`, when: 'Week 6' },
    { id: 'class-demorgan', kind: 'record', source: 'Learning twins', text: `De Morgan's laws: ${deMorgan} of ${n} students below 0.50 mastery`, when: 'Week 6', concept: 'deMorgan' },
  ];
}

/** The 55 fictional students as full profiles. Deterministic; reproduces the scripted Classroom figures. */
export function buildRoster(): StudentProfile[] {
  return STUDENTS.map((s) => {
    const isMinhAnh = s.index === MINH_ANH.index;
    const quirk = QUIRKS[s.index];
    const mastery = isMinhAnh ? { ...MASTERY_INITIAL } : masteryFor(s.index, s.mastery);
    const quiz = isMinhAnh ? { q1: MINH_ANH.scorePrev, q2: MINH_ANH.scoreNow } : quirk?.quiz ?? quizFor(s.index, s.mastery);
    let evidence = isMinhAnh ? MINH_ANH_EVIDENCE.map((e) => ({ ...e })) : baseEvidence(s.id, s.index, s.status, mastery, quiz);
    if (quirk?.replace) {
      const replace = quirk.replace;
      evidence = evidence.map((e) => {
        const text = replace[e.id.slice(s.id.length + 1)];
        return text ? { ...e, text } : e;
      });
    }
    for (const { slug, ...e } of quirk?.extra ?? []) evidence.push({ ...e, id: `${s.id}-${slug}` });
    return {
      index: s.index,
      id: s.id,
      name: s.name,
      short: isMinhAnh ? MINH_ANH.short : s.name.split(' ').slice(-1)[0],
      group: groupOf(s.index),
      status: s.status,
      escalated: COMPLEX.includes(s.index),
      mastery,
      quiz,
      practicePerWeek: isMinhAnh ? 1.5 : quirk?.practicePerWeek ?? Math.round((1 + s.mastery * 3) * 10) / 10,
      evidence,
    };
  });
}
