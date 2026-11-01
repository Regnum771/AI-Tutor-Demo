import { stoppedSince } from '../live/study/signals';
import type { DemoState, PlanStatus } from '../live/types';
import { ASSESSMENTS, LECTURES, lectureBefore } from '../scenario/course';
import { FAQ, faqLog, type VoiceEntry } from '../scenario/voice';

export type CalendarEvent =
  | { kind: 'lecture'; day: number; time: '09:00'; title: string; lecture: number }
  | { kind: 'assessment'; day: number; title: string; assessment: string }
  | { kind: 'session'; day: number; time: string; title: string; planId: string; studentIds: string[] }
  | { kind: 'stopped'; day: number; studentId: string };

export interface CalendarWeek { week: number; days: { day: number; events: CalendarEvent[] }[] }

/** The weeks the calendar browses. */
export const FIRST_WEEK = 1;
export const LAST_WEEK = 10;

/** Plans that went ahead; a proposed or dismissed plan is not on the calendar. */
const SHOWN: PlanStatus[] = ['sent', 'autoApproved', 'approved', 'done'];
const timeOf = (e: CalendarEvent): string => ('time' in e ? e.time : '');

/** One week, Monday to Sunday: lectures, assessments, the sessions of plans that went ahead and stopped-practising flags. Untimed events first, then by time. Pure. */
export function calendarWeek(state: DemoState, week: number): CalendarWeek {
  const events: CalendarEvent[] = [
    ...LECTURES.map((l): CalendarEvent => ({ kind: 'lecture', day: l.day, time: '09:00', title: `Lecture ${l.n} · ${l.title}`, lecture: l.n })),
    ...ASSESSMENTS.map((a): CalendarEvent => ({ kind: 'assessment', day: a.day, title: a.title, assessment: a.id })),
    ...state.plans.filter((p) => SHOWN.includes(p.status)).flatMap((p) =>
      p.sessions.map((s): CalendarEvent => ({ kind: 'session', day: p.date, time: s.time, title: s.title, planId: p.id, studentIds: s.studentId ? [s.studentId] : p.studentIds })),
    ),
    ...Object.entries(state.study).flatMap(([studentId, rec]): CalendarEvent[] => {
      const day = stoppedSince(rec, state.day);
      return day === null ? [] : [{ kind: 'stopped', day, studentId }];
    }),
  ];
  const first = (week - 1) * 7;
  return {
    week,
    days: Array.from({ length: 7 }, (_, i) => first + i).map((day) => ({
      day,
      events: events.filter((e) => e.day === day).sort((a, b) => timeOf(a).localeCompare(timeOf(b))),
    })),
  };
}

const stamp = (v: VoiceEntry) => v.day * 1440 + Number(v.time.slice(0, 2)) * 60 + Number(v.time.slice(3));

/** The FAQ log's messages placed after Lecture `n` (their `lectureBefore` is that lecture), oldest first. */
export const lectureQuestions = (n: number): VoiceEntry[] =>
  FAQ.flatMap((f) => faqLog(f.id)).filter((v) => lectureBefore(v.day, v.time)?.n === n).sort((a, b) => stamp(a) - stamp(b));

/** An assessment's marks, lowest first: Quiz 1 and Quiz 2 from the seed for every student, later ones from study records. Percentages. */
export function assessmentMarks(state: DemoState, id: string): { studentId: string; mark: number }[] {
  return state.students
    .flatMap((s) => {
      const mark = id === 'quiz1' ? s.quiz.q1 : id === 'quiz2' ? s.quiz.q2 : state.study[s.id]?.marks.find((m) => m.assessment === id)?.mark;
      return mark === undefined ? [] : [{ studentId: s.id, mark }];
    })
    .sort((a, b) => a.mark - b.mark);
}
