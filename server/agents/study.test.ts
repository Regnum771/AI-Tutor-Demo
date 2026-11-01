import { describe, expect, it } from 'vitest';
import { planFor } from '../../src/live/fixtures';
import { seedState } from '../../src/live/seed';
import { ensureRecord } from '../../src/live/study/record';
import type { DemoState, StudyPlan } from '../../src/live/types';
import { EXAM_DAY } from '../../src/scenario/course';
import { CONCEPTS } from '../../src/scenario/knowledgeGraph';
import { cannedStudyPlan } from './cannedStudy';
import { failingClient, fakeClient } from './fakeClient';
import { studyInput } from './samples';
import { STUDY_SYSTEM, planStudy, studyMessages, studyPlanProblems, studySpec } from './study';

const ready = (weekday = 30, weekend = 60): DemoState => {
  const s = seedState();
  ensureRecord(s, 's17').reported = { weekday, weekend };
  return s;
};
const lowTime = () => {
  const s = ready(5, 5);
  for (const c of CONCEPTS) s.students[16].mastery[c.id] = 0.1;
  return s;
};
const check = (s: DemoState, input: Record<string, unknown>) => studySpec(s, 's17').check(input);
const days = (s: DemoState) => (studyInput(s).days as { day: number; minutes: number; clo: string; concepts: string[] }[]);
const deps = (client: Parameters<typeof planStudy>[3]['client']) => ({ client, onStep: () => {} });
const CALL = (input: Record<string, unknown>) => [{ tool: 'propose_study_plan', input }];

describe('study plan checks', () => {
  it('accepts a plan that fits', () => {
    const s = ready();
    const r = check(s, studyInput(s));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ createdDay: 40, source: 'agents', leftOut: [] });
  });
  it('rejects a day over capacity', () => {
    const s = ready();
    const d = days(s);
    d[2].minutes = 500;
    expect(check(s, studyInput(s, 's17', { days: d }))).toMatchObject({ ok: false, error: expect.stringContaining('available') });
  });
  it('needs every day to the exam and nothing after it', () => {
    const s = ready();
    expect(check(s, studyInput(s, 's17', { days: days(s).slice(1) })).ok).toBe(false);
    expect(check(s, studyInput(s, 's17', { days: [...days(s), { day: EXAM_DAY, minutes: 10, clo: 'CLO1', concepts: ['negation'] }] })).ok).toBe(false);
  });
  it('rejects a concept outside the day’s CLO, and more than 3 concepts', () => {
    const s = ready();
    const wrong = days(s);
    wrong[0] = { ...wrong[0], clo: 'CLO1', concepts: ['applications'] };
    expect(check(s, studyInput(s, 's17', { days: wrong })).ok).toBe(false);
    const many = days(s);
    many[0] = { ...many[0], clo: 'CLO1', concepts: ['negation', 'conjunction', 'disjunction', 'implication'] };
    expect(check(s, studyInput(s, 's17', { days: many })).ok).toBe(false);
  });
  it('needs Week 9 to cover each CLO below 0.75 while it is still ahead', () => {
    const s = ready();
    const one = days(s).map((d) => ({ ...d, clo: 'CLO1', concepts: ['implication'] }));
    expect(check(s, studyInput(s, 's17', { days: one }))).toMatchObject({ ok: false, error: expect.stringContaining('Week 9') });
    s.day = 58;
    const late = days(s).map((d) => ({ ...d, clo: 'CLO1', concepts: ['implication'] }));
    expect(check(s, studyInput(s, 's17', { days: late })).ok).toBe(true);
  });
  it('needs left_out when time is short', () => {
    const s = lowTime();
    expect(check(s, studyInput(s))).toMatchObject({ ok: false, error: expect.stringContaining('left_out') });
    expect(check(s, studyInput(s, 's17', { left_out: ['Evaluate-level questions on real problems'] })).ok).toBe(true);
  });
  it('plans around a teacher’s sessions', () => {
    const s = ready();
    s.plans.push(planFor('pathway', { status: 'sent', date: 42 }));
    const d = days(s);
    d[2].minutes = 13;
    expect(check(s, studyInput(s, 's17', { days: d })).ok).toBe(false);
  });
});

describe('offline planner', () => {
  const clean = (s: DemoState) => studyPlanProblems(s, 's17', cannedStudyPlan(s, 's17', 'setup'));
  it('always passes the agent’s own checks', () => {
    expect(clean(ready())).toEqual([]);
    expect(clean(lowTime())).toEqual([]);
    const later = ready();
    later.day = 52;
    expect(clean(later)).toEqual([]);
    const teacher = ready();
    teacher.plans.push(planFor('pathway', { status: 'sent', date: 42 }));
    expect(clean(teacher)).toEqual([]);
  });
  it('is tagged offline and says what it drops when time is short', () => {
    const plan = cannedStudyPlan(lowTime(), 's17', 'setup');
    expect(plan.source).toBe('offline');
    expect(plan.leftOut.length).toBeGreaterThan(0);
  });
  it('spends more on the bigger, weaker CLOs', () => {
    const plan = cannedStudyPlan(ready(), 's17', 'setup');
    const minutes = (clo: string) => plan.days.filter((d) => d.clo === clo).reduce((a, d) => a + d.minutes, 0);
    expect(minutes('CLO2')).toBeGreaterThan(minutes('CLO1'));
  });
});

describe('the prompt', () => {
  it('states the rules and never assumes pronouns', () => {
    expect(STUDY_SYSTEM).toContain('exactly one entry for every day');
    expect(STUDY_SYSTEM).toContain('left_out');
    expect(STUDY_SYSTEM).toContain("do not assume anyone's pronouns");
  });
  it('gives the agent the calendar, the estimate and the reason for the plan', () => {
    const s = ready();
    s.plans.push(planFor('pathway', { status: 'sent', date: 42 }));
    const text = String(studyMessages(s, 's17', 'markSwing')[0].content);
    expect(text).toContain('Nguyễn Minh Anh');
    expect(text).toContain('Sat 31 Oct');
    expect(text).toContain('Quiz 3');
    expect(text).toContain('teacher session takes 18 min');
    expect(text).toContain('At risk');
    expect(text).toContain('A new mark moved sharply');
  });
});

describe('planStudy', () => {
  it('uses the agent’s plan and shows thinking lines', async () => {
    const s = ready();
    const { client } = fakeClient([CALL(studyInput(s))]);
    const steps: string[] = [];
    const plan = await planStudy(s, 's17', 'setup', { client, onStep: (l) => steps.push(l) });
    expect(plan?.source).toBe('agents');
    expect(steps.every((l) => l.startsWith('Study Planning Agent ·'))).toBe(true);
    expect(steps.length).toBeGreaterThan(1);
  });
  it('retries an invalid plan once, then falls back to the offline planner', async () => {
    const s = ready();
    const bad = studyInput(s, 's17', { days: [] });
    const fake = fakeClient([CALL(bad), CALL(bad)]);
    expect((await planStudy(s, 's17', 'setup', deps(fake.client)))?.source).toBe('offline');
    expect(fake.calls).toHaveLength(2);
    expect((await planStudy(s, 's17', 'bandChange', deps(fakeClient([CALL(bad), CALL(bad)]).client)))?.source).toBe('offline');
  });
  it('falls back at setup, but a failed replan keeps the current plan', async () => {
    const s = ready();
    expect((await planStudy(s, 's17', 'setup', deps(failingClient())))?.source).toBe('offline');
    expect(await planStudy(s, 's17', 'disengaged', deps(failingClient()))).toBeNull();
  });
  it('plans offline with no client', async () => {
    const plan: StudyPlan | null = await planStudy(ready(), 's17', 'markSwing', deps(null));
    expect(plan?.source).toBe('offline');
  });
});
