import { describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { lectureBefore } from '../scenario/course';
import { VOICE } from '../scenario/voice';
import { assessmentMarks, calendarWeek, lectureQuestions } from './calendar';

const all = (w: ReturnType<typeof calendarWeek>) => w.days.flatMap((d) => d.events);

describe('calendar model', () => {
  it('lays out a week Monday to Sunday with its lecture and assessments', () => {
    const w = calendarWeek(seedState(), 6);
    expect(w.week).toBe(6);
    expect(w.days.map((d) => d.day)).toEqual([35, 36, 37, 38, 39, 40, 41]);
    expect(w.days[1].events).toEqual([{ kind: 'lecture', day: 36, time: '09:00', title: 'Lecture 6 · Logical equivalence and De Morgan', lecture: 6 }]);
    expect(w.days[3].events).toEqual([{ kind: 'assessment', day: 38, title: 'Quiz 2', assessment: 'quiz2' }]);
    expect(calendarWeek(seedState(), 10).days[1].events).toEqual([{ kind: 'assessment', day: 64, title: 'Final exam', assessment: 'exam' }]);
  });
  it('shows the sessions of plans that went ahead, on the plan’s date, untimed events first', () => {
    expect(calendarWeek(stateWithPlan(), 6).days[5].events).toEqual([]);
    expect(calendarWeek(stateWithPlan('pathway', { status: 'dismissed' }), 6).days[5].events).toEqual([]);
    expect(calendarWeek(stateWithPlan('pathway', { status: 'sent' }), 6).days[5].events).toEqual([
      { kind: 'session', day: 40, time: '15:30', title: 'Review implication', planId: 'p1', studentIds: ['s17'] },
      { kind: 'session', day: 40, time: '20:00', title: 'Mastery check', planId: 'p1', studentIds: ['s17'] },
    ]);
    const friday = calendarWeek(stateWithPlan('checkIns', { status: 'approved' }), 7).days[4].events;
    expect(friday.map((e) => e.kind)).toEqual(['assessment', 'session', 'session']);
    expect(friday.flatMap((e) => (e.kind === 'session' ? [e.studentIds] : []))).toEqual([['s29'], ['s42']]);
    expect(all(calendarWeek(stateWithPlan('classActivity', { status: 'done' }), 7)).filter((e) => e.kind === 'session')).toHaveLength(1);
  });
  it('flags a student who stopped practising on the first day of the stretch, only while it lasts', () => {
    const s = seedState();
    const rec = ensureRecord(s, 's17');
    for (const d of [36, 37, 38, 39, 40, 41]) rec.days[d] = { planned: 30, done: d === 36 ? 12 : 0, check: null };
    s.day = 42;
    expect(all(calendarWeek(s, 6)).filter((e) => e.kind === 'stopped')).toEqual([{ kind: 'stopped', day: 40, studentId: 's17' }]);
    rec.days[41].done = 20;
    expect(all(calendarWeek(s, 6)).some((e) => e.kind === 'stopped')).toBe(false);
  });
  it('finds the student questions placed after a lecture, oldest first', () => {
    const q = lectureQuestions(5);
    expect(q.length).toBeGreaterThan(0);
    expect(q).toHaveLength(VOICE.filter((v) => v.faqId && lectureBefore(v.day, v.time)?.n === 5).length);
    expect(q.every((v) => lectureBefore(v.day, v.time)?.n === 5)).toBe(true);
    const stamps = q.map((v) => v.day * 1440 + Number(v.time.slice(0, 2)) * 60 + Number(v.time.slice(3)));
    expect(stamps).toEqual([...stamps].sort((a, b) => a - b));
    expect(lectureQuestions(7)).toEqual([]);
  });
  it('lists an assessment’s marks once there are any', () => {
    const s = seedState();
    expect(assessmentMarks(s, 'quiz2')).toHaveLength(55);
    expect(assessmentMarks(s, 'quiz2').find((m) => m.studentId === 's17')?.mark).toBe(42);
    expect(assessmentMarks(s, 'quiz3')).toEqual([]);
    ensureRecord(s, 's17').marks.push({ assessment: 'quiz3', mark: 22, day: 52 });
    expect(assessmentMarks(s, 'quiz3')).toEqual([{ studentId: 's17', mark: 22 }]);
  });
});
