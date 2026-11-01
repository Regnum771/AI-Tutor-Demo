import { fmt } from '../live/clock';
import { studentById } from '../live/reducer';
import { cardsToday } from '../live/study/cards';
import { cloMastery } from '../live/study/estimate';
import { todayList, type TodayRow } from '../live/study/today';
import type { DemoState, ReplanSignal, StudyRecord } from '../live/types';
import type { Card } from '../scenario/cards';
import { ASSESSMENTS, CLOS, EXAM_DAY, fullDate, isAssignment, nextAssessment, nextAssignment, nextLecture, nextTest, shortDate, weekOf, type Assessment, type CloId } from '../scenario/course';
import type { SubjectGrade } from '../scenario/grades';
import { conceptById } from '../scenario/knowledgeGraph';
import { MINH_ANH } from '../scenario/minhAnh';

export interface TodayView {
  name: string;
  date: string;
  examIn: string;
  examDay: boolean;
  /** "GPA 2.30 of 4". */
  gpa: string;
  /** This course's marks so far, oldest first: "Quiz 1 75% · Quiz 2 42%". Percentages. */
  marks: string;
  /** "Lecture 7 · Equivalence laws · Tue 3 Nov"; null after the last lecture. */
  nextLecture: string | null;
  /** The next quiz or the exam: "Quiz 3 · Thu 12 Nov · in 12 days · CLO2, CLO3". */
  nextAssessment: string | null;
  /** "Assignment 2 · due Fri 6 Nov", then its mark once its day has passed: "Assignment 2 · 61%". */
  assignment: string | null;
  reason: string | null;
  offline: boolean;
  /** Agent steps while a plan is being written with none on the phone yet. */
  planning: string[] | null;
  /** A new plan is being written behind the current one. */
  replanning: boolean;
  budget: number;
  done: number;
  rows: TodayRow[];
}

export interface PractiseRow { id: CloId; title: string; level: string; share: number; mastery: number }

export interface SemesterWeek {
  week: number;
  from: string;
  minutes: number;
  focus: CloId[];
  revision: boolean;
  assessments: { title: string; date: string; mark: number | null }[];
}

export interface SemesterView {
  weeks: SemesterWeek[];
  leftOut: string[];
  changes: { date: string; why: string; reason: string }[];
  /** Previous subjects, 10-point grades with letters. */
  previous: SubjectGrade[];
}

const WHY: Partial<Record<ReplanSignal, string>> = {
  markSwing: 'A mark moved sharply',
  disengaged: 'Practice dropped off',
  bandChange: 'Your progress changed',
  teacherPlan: 'Your lecturer sent a plan',
};

const countdown = (a: Assessment, today: number) => {
  const n = a.day - today;
  return n === 0 ? `${a.title} today` : n === 1 ? `${a.title} tomorrow` : `${a.title} in ${n} days`;
};

const inDays = (day: number, today: number) => {
  const n = day - today;
  return n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`;
};

/** Quiz 1 and Quiz 2 from the seed, then the record's marks, oldest first. */
const marksLine = (q: { q1: number; q2: number }, rec: StudyRecord): string =>
  [
    `Quiz 1 ${q.q1}%`,
    `Quiz 2 ${q.q2}%`,
    ...[...rec.marks].sort((a, b) => a.day - b.day).map((m) => `${ASSESSMENTS.find((a) => a.id === m.assessment)?.title ?? m.assessment} ${m.mark}%`),
  ].join(' · ');

/** The assignment due next; once none is due, the last one with its mark. */
function assignmentLine(today: number, rec: StudyRecord): string | null {
  const due = nextAssignment(today);
  if (due) return `${due.title} · due ${shortDate(due.day)}`;
  const last = ASSESSMENTS.filter((a) => isAssignment(a) && a.day < today).at(-1);
  if (!last) return null;
  const mark = rec.marks.find((m) => m.assessment === last.id)?.mark;
  return mark === undefined ? `${last.title} · ${shortDate(last.day)}` : `${last.title} · ${mark}%`;
}

const recordOf = (state: DemoState) => {
  const id = state.phone.studentId;
  const rec = id ? state.study[id] : undefined;
  return id && rec?.reported ? { id, rec, student: studentById(state, id)! } : null;
};

/** Minh Anh first, then the class in roster order. */
export const pickList = (state: DemoState): { id: string; name: string }[] =>
  [...state.students].sort((a, b) => Number(b.id === MINH_ANH.id) - Number(a.id === MINH_ANH.id)).map((s) => ({ id: s.id, name: s.name }));

export function rowLabel(row: TodayRow): string {
  if (row.kind === 'plan') return row.title;
  if (row.kind === 'cards') return `${row.count} flip cards`;
  return `Practise ${row.concepts.map((c) => conceptById(c).label.toLowerCase()).join(', ')}`;
}

export function todayView(state: DemoState): TodayView | null {
  const r = recordOf(state);
  if (!r) return null;
  const { budget, done, rows } = todayList(state, r.id);
  const exam = ASSESSMENTS.find((a) => a.day === EXAM_DAY)!;
  const test = nextTest(state.day);
  const lecture = nextLecture(state.day, fmt(state.clock));
  return {
    name: r.student.short,
    date: fullDate(state.day),
    examIn: countdown(exam, state.day),
    examDay: state.day >= EXAM_DAY,
    gpa: `GPA ${r.student.gpa.toFixed(2)} of 4`,
    marks: marksLine(r.student.quiz, r.rec),
    nextLecture: lecture && `Lecture ${lecture.n} · ${lecture.title} · ${shortDate(lecture.day)}`,
    nextAssessment: test && `${test.title} · ${shortDate(test.day)} · ${inDays(test.day, state.day)} · ${test.clos.join(', ')}`,
    assignment: assignmentLine(state.day, r.rec),
    reason: r.rec.plan?.reason ?? null,
    offline: r.rec.plan?.source === 'offline',
    planning: r.rec.planning && !r.rec.plan ? r.rec.planning.steps : null,
    replanning: r.rec.planning !== null && r.rec.plan !== null,
    budget,
    done: Math.round(done),
    rows,
  };
}

/** "Today's calendar", built from the plan and the rules. No agent is involved. */
export function morningCopy(state: DemoState): { title: string; body: string } | null {
  const r = state.phone.morning ? recordOf(state) : null;
  if (!r) return null;
  const { budget, rows } = todayList(state, r.id);
  const cards = rows.find((x) => x.kind === 'cards');
  const practice = rows.find((x) => x.kind === 'practice');
  const sessions = rows.filter((x) => x.kind === 'plan').length;
  const lecturer = sessions > 0 ? `${sessions} session${sessions === 1 ? '' : 's'} from your lecturer` : null;
  const work = [
    cards?.kind === 'cards' ? `${cards.count} cards` : null,
    practice?.kind === 'practice' ? `${conceptById(practice.concepts[0]).label.toLowerCase()} practice` : null,
  ].filter(Boolean).join(', ');
  const next = nextAssessment(state.day);
  return { title: 'Today’s calendar', body: [lecturer, state.day >= EXAM_DAY ? null : `${budget} min`, work, next && countdown(next, state.day)].filter(Boolean).join(' · ') };
}

export function practiseView(state: DemoState): PractiseRow[] {
  const r = recordOf(state);
  if (!r) return [];
  return CLOS.map((c) => ({
    id: c.id, title: c.title, level: c.levels[r.rec.bloom[c.id]], share: Math.round(c.share * 100), mastery: Math.round(cloMastery(r.student, c.id) * 100),
  }));
}

export function cardsView(state: DemoState): { card: Card | null; left: number } {
  const r = recordOf(state);
  if (!r) return { card: null, left: 0 };
  const { due, fresh } = cardsToday(r.rec, state.day, todayList(state, r.id).concepts);
  const queue = [...due, ...fresh];
  return { card: queue[0] ?? null, left: queue.length };
}

export function semesterView(state: DemoState): SemesterView | null {
  const r = recordOf(state);
  if (!r) return null;
  const plan = r.rec.plan;
  const weeks: SemesterWeek[] = [];
  for (let week = weekOf(state.day); week <= weekOf(EXAM_DAY); week++) {
    const days = plan?.days.filter((d) => weekOf(d.day) === week && d.day >= state.day) ?? [];
    weeks.push({
      week,
      from: shortDate((week - 1) * 7),
      minutes: days.reduce((a, d) => a + d.minutes, 0),
      focus: [...new Set(days.filter((d) => d.minutes > 0).map((d) => d.clo))],
      revision: week === 9,
      assessments: ASSESSMENTS.filter((a) => weekOf(a.day) === week).map((a) => ({
        title: a.title, date: shortDate(a.day), mark: r.rec.marks.find((m) => m.assessment === a.id)?.mark ?? (a.id === 'quiz2' ? r.student.quiz.q2 : null),
      })),
    });
  }
  const changes = [...r.rec.replans].reverse().flatMap((c) => {
    const why = WHY[c.signal];
    return why ? [{ date: shortDate(c.day), why, reason: c.reason }] : [];
  });
  return { weeks, leftOut: plan?.leftOut ?? [], changes, previous: r.student.history };
}
