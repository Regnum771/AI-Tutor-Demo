import { describe, expect, it, vi } from 'vitest';
import { planFor } from '../../src/live/fixtures';
import { seedState } from '../../src/live/seed';
import { capacityLeft } from '../../src/live/study/capacity';
import { minutesNeeded } from '../../src/live/study/estimate';
import { ensureRecord } from '../../src/live/study/record';
import type { DemoState, StudyPlan } from '../../src/live/types';
import { CLOS, EXAM_DAY, studyDays } from '../../src/scenario/course';
import { CONCEPTS, EDGES } from '../../src/scenario/knowledgeGraph';
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
  it('needs Week 9 to cover each CLO below 0.75 while enough Week 9 days are ahead', () => {
    const s = ready();
    const one = days(s).map((d) => ({ ...d, clo: 'CLO1', concepts: ['implication'] }));
    expect(check(s, studyInput(s, 's17', { days: one }))).toMatchObject({ ok: false, error: expect.stringContaining('Week 9') });
    s.day = 58;
    const late = days(s).map((d) => ({ ...d, clo: 'CLO1', concepts: ['implication'] }));
    expect(check(s, studyInput(s, 's17', { days: late }))).toMatchObject({ ok: false, error: expect.stringContaining('Week 9') });
    const few = lowTime();
    few.day = 62;
    const f = days(few).map((d) => ({ ...d, clo: 'CLO1', concepts: ['implication'] }));
    expect(check(few, studyInput(few, 's17', { days: f, left_out: ['Most of the revision'] })).ok).toBe(true);
  });
  it('needs left_out when time is short', () => {
    const s = lowTime();
    expect(check(s, studyInput(s))).toMatchObject({ ok: false, error: expect.stringContaining('left_out') });
    expect(check(s, studyInput(s, 's17', { left_out: ['Evaluate-level questions on real problems'] })).ok).toBe(true);
  });
  it('rejects a near-empty plan unless it says what is dropped', () => {
    const s = ready();
    for (const c of CONCEPTS) s.students[16].mastery[c.id] = 0.3;
    const sparse = days(s).map((d, i) => {
      const clo = CLOS[d.day % 3];
      return { ...d, clo: clo.id, concepts: [clo.concepts[0]], minutes: i === 0 ? 7 : d.day >= 56 && d.day <= 58 ? 1 : 0 };
    });
    const r = check(s, studyInput(s, 's17', { days: sparse }));
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('left_out') });
    if (!r.ok) expect(r.error).toContain('plan more');
    expect(check(s, studyInput(s, 's17', { days: sparse, left_out: ['Most of CLO2'] })).ok).toBe(true);
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
  const total = (p: StudyPlan) => p.days.reduce((a, d) => a + d.minutes, 0);
  const capacity = (s: DemoState) => studyDays(s.day).reduce((a, d) => a + capacityLeft(s, 's17', d), 0);
  it('always passes the agent’s own checks', () => {
    expect(clean(ready())).toEqual([]);
    expect(clean(lowTime())).toEqual([]);
    const later = ready();
    later.day = 52;
    expect(clean(later)).toEqual([]);
    const teacher = ready();
    teacher.plans.push(planFor('pathway', { status: 'sent', date: 42 }));
    expect(clean(teacher)).toEqual([]);
    const strong = ready();
    for (const c of CONCEPTS) strong.students[16].mastery[c.id] = 0.92;
    strong.day = 57;
    expect(clean(strong)).toEqual([]);
    const week9 = ready();
    week9.day = 57;
    expect(clean(week9)).toEqual([]);
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
  it('does not fill every minute for a student who needs nothing', () => {
    const s = ready();
    for (const c of CONCEPTS) s.students[16].mastery[c.id] = 0.92;
    const plan = cannedStudyPlan(s, 's17', 'setup');
    for (const d of plan.days) expect(d.minutes).toBe(Math.min(10, capacityLeft(s, 's17', d.day)));
  });
  it('sizes the plan to about 1.2 times the need, not the whole capacity', () => {
    const s = ready();
    const need = minutesNeeded(s.students[16]);
    const t = total(cannedStudyPlan(s, 's17', 'setup'));
    expect(t).toBeGreaterThanOrEqual(Math.round(need * 1.2));
    expect(t).toBeLessThan(capacity(s));
    expect(t).toBeLessThan(need * 1.2 + 60);
  });
  it('uses all the capacity when the student is short of time', () => {
    const s = lowTime();
    expect(total(cannedStudyPlan(s, 's17', 'setup'))).toBe(capacity(s));
  });
  it('spends the days before an assessment on the CLOs it tests', () => {
    const plan = cannedStudyPlan(ready(), 's17', 'setup');
    for (const d of [43, 44, 45]) expect(plan.days.find((x) => x.day === d)?.clo).toBe('CLO2');
    const s = ready();
    for (const c of CLOS[0].concepts) s.students[16].mastery[c] = 0.95;
    s.day = 49;
    const p = cannedStudyPlan(s, 's17', 'setup');
    for (const d of [49, 50, 51]) expect(['CLO2', 'CLO3']).toContain(p.days.find((x) => x.day === d)?.clo);
  });
  it('names the CLO that really gets least of what it needs', () => {
    const s = seedState();
    ensureRecord(s, 's29').reported = { weekday: 10, weekend: 15 };
    const st = s.students.find((x) => x.id === 's29')!;
    const plan = cannedStudyPlan(s, 's29', 'setup');
    const need = (id: string) => CLOS.find((c) => c.id === id)!.concepts.reduce((a, c) => a + Math.max(0, 0.75 - st.mastery[c]), 0) * 120;
    const given = (id: string) => plan.days.filter((d) => d.clo === id).reduce((a, d) => a + d.minutes, 0);
    const expected = CLOS.filter((c) => need(c.id) > 0).sort((a, b) => given(a.id) / need(a.id) - given(b.id) / need(b.id))[0];
    expect(plan.leftOut).toEqual([`Full coverage of “${expected.title}”: there is not enough time for all of it, so it gets less for now.`]);
  });
  it('quotes the CLO title as written in the reason', () => {
    expect(cannedStudyPlan(ready(), 's17', 'setup').reason).toMatch(/with the most time on “[A-Z]/);
  });
  it('rotates Week 9 only over days that have minutes', () => {
    const s = ready();
    const base = planFor('pathway');
    for (const day of [56, 59, 62]) s.plans.push({ ...base, id: `p${day}`, status: 'sent', date: day, sessions: [{ ...base.sessions[0], minutes: 500 }] });
    s.day = 50;
    for (const day of [56, 59, 62]) expect(capacityLeft(s, 's17', day)).toBe(0);
    expect(clean(s)).toEqual([]);
  });
  it('passes the agent’s checks for every student across capacities and days', () => {
    const t0 = Date.now();
    for (const [wd, we] of [[10, 15], [30, 60]]) {
      for (const day of [40, 50, 57]) {
        const s = seedState();
        s.day = day;
        for (const st of s.students) ensureRecord(s, st.id).reported = { weekday: wd, weekend: we };
        for (const st of s.students) expect(studyPlanProblems(s, st.id, cannedStudyPlan(s, st.id, 'setup')), `${st.id} ${wd}/${we} day ${day}`).toEqual([]);
      }
    }
    expect(Date.now() - t0).toBeLessThan(1000);
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
  it('lists the prerequisites and gives the weakest concepts with their ids', () => {
    const [a, b] = EDGES[0];
    const text = String(studyMessages(ready(), 's17', 'setup')[0].content);
    expect(text).toContain(`${a} → ${b}`);
    const weakest = text.split('\n').find((l) => l.startsWith('Weakest concepts'))!;
    expect(weakest).toMatch(/[a-zA-Z]+ \([a-zA-Z]+\) \d\.\d\d/);
  });
  it('leaves today out of the recently done minutes', () => {
    const s = ready();
    const rec = ensureRecord(s, 's17');
    rec.days[s.day] = { ...rec.days[s.day], done: 777 };
    rec.days[s.day - 1] = { ...rec.days[s.day - 1], done: 33 };
    const text = String(studyMessages(s, 's17', 'setup')[0].content);
    expect(text).toContain('33');
    expect(text).not.toContain('777');
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = ready();
    const bad = studyInput(s, 's17', { days: [] });
    const fake = fakeClient([CALL(bad), CALL(bad)]);
    expect((await planStudy(s, 's17', 'setup', deps(fake.client)))?.source).toBe('offline');
    expect(fake.calls).toHaveLength(2);
    expect((await planStudy(s, 's17', 'bandChange', deps(fakeClient([CALL(bad), CALL(bad)]).client)))?.source).toBe('offline');
    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[beyond\] study planning failed: /);
    warn.mockRestore();
  });
  it('falls back at setup, but a failed replan keeps the current plan', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = ready();
    expect((await planStudy(s, 's17', 'setup', deps(failingClient())))?.source).toBe('offline');
    expect(await planStudy(s, 's17', 'disengaged', deps(failingClient()))).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
  it('plans offline with no client', async () => {
    const plan: StudyPlan | null = await planStudy(ready(), 's17', 'markSwing', deps(null));
    expect(plan?.source).toBe('offline');
  });
});
