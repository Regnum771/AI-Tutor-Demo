import { describe, expect, it, vi } from 'vitest';
import { currentItems } from '../src/live/reducer';
import type { DemoState } from '../src/live/types';
import type { MessagesClient } from './agents/client';
import { failingClient, fakeClient } from './agents/fakeClient';
import { studyInput } from './agents/samples';
import { DemoSession } from './session';

/** Answers every planning request with a valid plan for the state at that moment. */
const planner = (get: () => DemoState): MessagesClient => ({
  create: (params, options) => fakeClient([[{ tool: 'propose_study_plan', input: studyInput(get()) }]]).client.create(params, options),
});
/** Never answers until aborted. */
const hanging: MessagesClient = {
  create: (_p, o) => new Promise((_, reject) => { o?.signal?.addEventListener('abort', () => reject(new Error('aborted'))); }),
};

const joined = async (session: DemoSession, id = 's17') => {
  session.studyOpen();
  session.studyPick(id);
  session.studySetup(30, 60);
  await session.settled();
  return session;
};
const offline = () => joined(new DemoSession(null));
const replans = (s: DemoSession) => s.state.study.s17.replans.filter((r) => r.signal !== 'setup');
const practise = async (session: DemoSession) => {
  session.studyPractice(null);
  while (session.state.phone.self) {
    session.phoneAnswer(currentItems(session.state)[session.state.phone.item].correct);
    const next = session.phoneNext();
    if (!next.ok) throw new Error(next.error);
    await next.done;
  }
};

describe('setup', () => {
  it('writes the first plan in the background and lands on Today', async () => {
    const session = await offline();
    expect(session.state.phone.screen).toBe('today');
    expect(session.state.study.s17).toMatchObject({ planning: null, pendingSignal: null, lastReplanDay: 40, band: 'Likely' });
    expect(session.state.study.s17.plan?.source).toBe('offline');
  });
  it('shows the agent’s thinking lines while it writes', async () => {
    const session: DemoSession = new DemoSession(planner(() => session.state));
    const seen: string[][] = [];
    session.subscribe((s) => { if (s.study.s17?.planning) seen.push(s.study.s17.planning.steps); });
    await joined(session);
    expect(seen.at(-1)?.length).toBeGreaterThan(0);
    expect(session.state.study.s17.plan?.source).toBe('agents');
  });
  it('does not make the teacher wait', () => {
    const session = new DemoSession(hanging);
    session.studyOpen();
    session.studyPick('s17');
    session.studySetup(30, 60);
    expect(session.state.busy).toBe(false);
    expect(session.ask('How is the class doing?', null).ok).toBe(true);
    session.reset();
  });
});

describe('replanning stays rare', () => {
  it('a day with a little practice replans nothing', async () => {
    const session = await offline();
    await practise(session);
    session.nextDay('right');
    await session.settled();
    expect(replans(session)).toEqual([]);
  });
  it('a skipped week replans exactly once', async () => {
    const session = await offline();
    session.nextWeek();
    await session.settled();
    expect(replans(session).map((r) => r.signal)).toEqual(['disengaged']);
  });
  it('holds a signal during the cooldown and replans when it ends, if still true', async () => {
    const session = await offline();
    session.nextWeek();
    await session.settled();
    for (let day = 48; day < 52; day++) {
      session.nextDay(null);
      await session.settled();
      expect(session.state.study.s17.pendingSignal, `day ${day}`).not.toBeNull();
      expect(replans(session)).toHaveLength(1);
    }
    session.nextDay(null);
    await session.settled();
    expect(session.state.day).toBe(52);
    expect(replans(session)).toHaveLength(2);
  });
  it('drops a held signal once the student is back', async () => {
    const session = await offline();
    session.nextWeek();
    await session.settled();
    session.nextDay(null);
    await session.settled();
    expect(session.state.study.s17.pendingSignal).toBe('disengaged');
    for (let i = 0; i < 3; i++) {
      await practise(session);
      session.nextDay('right');
      await session.settled();
    }
    expect(session.state.study.s17.pendingSignal).not.toBe('disengaged');
  });
  it('a mark swing goes straight through the cooldown', async () => {
    const session = await offline();
    session.simulateDrop();
    await session.settled();
    expect(replans(session).map((r) => r.signal)).toEqual(['markSwing']);
  });
  it('a pathway the teacher approves replans around it, without changing it', async () => {
    const session = await offline();
    const r = session.ask('Why did Minh Anh’s quiz score drop?', null);
    if (!r.ok) throw new Error(r.error);
    await r.done;
    const before = structuredClone(session.state.plans[0].sessions);
    session.approve('p1');
    await session.settled();
    expect(replans(session).map((x) => x.signal)).toEqual(['teacherPlan']);
    expect(session.state.plans[0].sessions).toEqual(before);
  });
  it('a teacher plan for someone not set up starts nothing', async () => {
    const session = new DemoSession(null);
    const r = session.ask('Why did Minh Anh’s quiz score drop?', null);
    if (!r.ok) throw new Error(r.error);
    await r.done;
    session.approve('p1');
    await session.settled();
    expect(session.state.study).toEqual({});
  });
});

describe('Next day never waits for an agent', () => {
  it('moves on while a plan is still being written', () => {
    const session = new DemoSession(hanging);
    session.studyOpen();
    session.studyPick('s17');
    session.studySetup(30, 60);
    expect(session.nextDay(null)).toEqual({ ok: true });
    expect(session.state.day).toBe(41);
    session.reset();
  });
  it('a signal raised while a plan is being written waits its turn', () => {
    const session = new DemoSession(hanging);
    session.studyOpen();
    session.studyPick('s17');
    session.studySetup(30, 60);
    session.simulateDrop();
    expect(session.state.study.s17.pendingSignal).toBe('markSwing');
    session.reset();
  });
});

/** A client whose requests wait until the test lets them settle. */
const gated = () => {
  const calls: { resolve: () => void; fail: () => void }[] = [];
  const client: MessagesClient = {
    create: (_p, o) => new Promise((resolve, reject) => {
      calls.push({ resolve: () => resolve(undefined as never), fail: () => reject(new Error('down')) });
      o?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }),
  };
  return { client, calls };
};

describe('signals across a run in flight', () => {
  it('a failed replan keeps a mark swing raised while it ran', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const g = gated();
    let hang = false;
    const session: DemoSession = new DemoSession({ create: (p, o) => (hang ? g.client : planner(() => session.state)).create(p, o) });
    await joined(session);
    hang = true;
    session.nextWeek();
    expect(session.state.study.s17.planning).not.toBeNull();
    session.simulateDrop();
    expect(session.state.study.s17.pendingSignal).toBe('markSwing');
    g.calls[0].fail();
    await session.settled();
    expect(session.state.study.s17).toMatchObject({ pendingSignal: 'markSwing', planning: null });
    warn.mockRestore();
  });
  it('two setup calls send one planning request', () => {
    const g = gated();
    const session = new DemoSession(g.client);
    session.studyOpen();
    session.studyPick('s17');
    session.studySetup(30, 60);
    session.studySetup(45, 60);
    expect(g.calls).toHaveLength(1);
    session.reset();
  });
  it('a plan landing after the day moved leaves a held mark swing to replan on the next day', async () => {
    const g = gated();
    let hang = true;
    const session: DemoSession = new DemoSession({ create: (p, o) => (hang ? g.client : planner(() => session.state)).create(p, o) });
    session.studyOpen();
    session.studyPick('s17');
    session.studySetup(30, 60);
    session.nextDay(null);
    session.simulateDrop();
    expect(session.state.study.s17.pendingSignal).toBe('markSwing');
    hang = false;
    // the setup run ends with its offline fallback once the request fails
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    g.calls[0].fail();
    await session.settled();
    expect(session.state.study.s17.plan).not.toBeNull();
    expect(session.state.study.s17.pendingSignal).toBe('markSwing');
    session.nextDay(null);
    await session.settled();
    expect(session.state.study.s17.pendingSignal).toBeNull();
    expect(replans(session).map((r) => r.signal)).toContain('markSwing');
    vi.restoreAllMocks();
  });
});

describe('when planning fails', () => {
  it('a failed replan keeps the plan and leaves the signal pending', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let fail = false;
    const session: DemoSession = new DemoSession({ create: (p, o) => (fail ? failingClient() : planner(() => session.state)).create(p, o) });
    await joined(session);
    const plan = session.state.study.s17.plan;
    fail = true;
    session.nextWeek();
    await session.settled();
    expect(session.state.study.s17.plan).toEqual(plan);
    expect(session.state.study.s17).toMatchObject({ pendingSignal: 'disengaged', planning: null });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it('setup still ends with a plan, tagged offline', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const session = await joined(new DemoSession(failingClient()));
    expect(session.state.study.s17.plan?.source).toBe('offline');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it('reset drops a plan being written and clears the study records', async () => {
    const session = new DemoSession(hanging);
    session.studyOpen();
    session.studyPick('s17');
    session.studySetup(30, 60);
    session.reset();
    await session.settled();
    expect(session.state).toMatchObject({ study: {}, day: 40 });
    expect(session.state.phone).toMatchObject({ screen: 'lock', studentId: null });
  });
});
