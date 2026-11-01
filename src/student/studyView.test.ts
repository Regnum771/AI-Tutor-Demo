import { describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { approvePlan, type Result } from '../live/reducer';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { reviewCard } from '../live/study/cards';
import type { DemoState, StudyPlan } from '../live/types';
import { CARDS } from '../scenario/cards';
import { cardsView, morningCopy, pickList, practiseView, rowLabel, semesterView, todayView } from './studyView';

const ok = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const PLAN: StudyPlan = {
  createdDay: 40, reason: 'Implication first.', leftOut: ['Evaluate-level questions'], source: 'agents',
  days: Array.from({ length: 24 }, (_, i) => ({ day: 40 + i, minutes: 20, clo: 'CLO1' as const, concepts: ['implication' as const] })),
};
const ready = (): DemoState => {
  const s = seedState();
  const rec = ensureRecord(s, 's17');
  rec.reported = { weekday: 30, weekend: 60 };
  rec.plan = PLAN;
  s.phone = { ...s.phone, studentId: 's17', screen: 'today' };
  return s;
};

describe('study views', () => {
  it('lists Minh Anh first of the 55 students', () => {
    const list = pickList(seedState());
    expect(list).toHaveLength(55);
    expect(list[0]).toMatchObject({ id: 's17', name: 'Nguyễn Minh Anh' });
  });
  it('builds Today: countdown, estimate, reason and rows', () => {
    const v = todayView(ready())!;
    expect(v).toMatchObject({ name: 'Minh Anh', examIn: 'Final exam in 24 days', band: 'At risk', reason: 'Implication first.', offline: false, planning: null, examDay: false });
    expect(v.rows.map(rowLabel)).toEqual(['4 flip cards', 'Practise implication']);
  });
  it('shows the agent’s lines while the first plan is written', () => {
    const s = ready();
    Object.assign(s.study.s17, { plan: null, planning: { steps: ['Study Planning Agent · writing the plan'] } });
    expect(todayView(s)).toMatchObject({ planning: ['Study Planning Agent · writing the plan'], reason: null });
  });
  it('builds the morning notification with no agent', () => {
    const s = ready();
    s.phone.morning = true;
    expect(morningCopy(s)).toEqual({ title: 'Today’s calendar', body: '20 min · 4 cards, implication practice · Assignment 2 in 6 days' });
    s.day = 51;
    expect(morningCopy(s)?.body).toContain('Quiz 3 tomorrow');
    s.phone.morning = false;
    expect(morningCopy(s)).toBeNull();
  });
  it('morning copy shows no minutes on the exam day and puts a lecturer session first', () => {
    const s = ready();
    s.phone.morning = true;
    s.day = 64;
    expect(morningCopy(s)?.body).toBe('Final exam today');
    const t = ok(approvePlan(stateWithPlan(), 'p1'));
    ensureRecord(t, 's17').reported = { weekday: 30, weekend: 60 };
    t.study.s17.plan = PLAN;
    t.plans[0].date = t.day;
    t.phone = { ...t.phone, studentId: 's17', screen: 'lock', morning: true };
    expect(morningCopy(t)?.body).toMatch(/^2 sessions from your lecturer · /);
  });
  it('shows each CLO with the student’s Bloom level', () => {
    const s = ready();
    expect(practiseView(s)).toMatchObject([
      { id: 'CLO1', level: 'Understand', share: 40 },
      { id: 'CLO2', level: 'Understand', share: 40 },
      { id: 'CLO3', level: 'Apply', share: 20 },
    ]);
  });
  it('serves due cards before new ones, and says when none are left', () => {
    const s = ready();
    const due = CARDS.find((c) => c.concept === 'negation')!;
    s.study.s17.cards[due.id] = reviewCard(undefined, 'good', 38);
    expect(cardsView(s)).toMatchObject({ card: { id: due.id }, left: 5 });
    for (const c of CARDS) s.study.s17.cards[c.id] = reviewCard(undefined, 'easy', 40);
    expect(cardsView(s)).toMatchObject({ card: null, left: 0 });
  });
  it('lays out the weeks to the exam, marks and why the plan changed', () => {
    const s = ready();
    const rec = s.study.s17;
    rec.marks.push({ assessment: 'quiz3', mark: 22, day: 52 });
    rec.replans.push({ day: 40, signal: 'setup', reason: 'First.' }, { day: 52, signal: 'markSwing', reason: 'More equivalence.' });
    const v = semesterView(s)!;
    expect(v.weeks.map((w) => w.week)).toEqual([6, 7, 8, 9, 10]);
    expect(v.weeks[1].assessments).toEqual([{ title: 'Assignment 2', date: 'Fri 6 Nov', mark: null }]);
    expect(v.weeks[2].assessments[0]).toMatchObject({ title: 'Quiz 3', mark: 22 });
    expect(v.weeks[3]).toMatchObject({ revision: true, minutes: 140 });
    expect(v.changes).toEqual([{ date: 'Thu 12 Nov', why: 'A mark moved sharply', reason: 'More equivalence.' }]);
    expect(v.leftOut).toEqual(['Evaluate-level questions']);
  });
  it('puts a teacher’s plan at the top of Today', () => {
    const r = approvePlan(stateWithPlan('pathway', { day: 'Today', date: 40 }), 'p1');
    if (!r.ok) throw new Error(r.error);
    const rec = ensureRecord(r.state, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    rec.plan = PLAN;
    expect(todayView(r.state)!.rows[0]).toMatchObject({ kind: 'plan', title: 'Review implication' });
  });
});
