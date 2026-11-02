import { describe, expect, it, vi } from 'vitest';
import { TONIGHT } from '../src/live/clock';
import { sessionItems } from '../src/scenario/practiceBank';
import type { MessagesClient } from './agents/client';
import { fakeClient } from './agents/fakeClient';
import { planInput, reportInput } from './agents/samples';
import { playOpenSession } from './playSession';
import { DemoSession } from './session';

const MA = 'Why did Minh Anh’s quiz score drop?';
const asked = async (session: DemoSession, text = MA, id: string | null = null) => {
  const r = session.ask(text, id);
  if (!r.ok) throw new Error(r.error);
  await r.done;
  return r.conversationId;
};

/** The offline Minh Anh story, answering every item correctly first try. */
async function perfectRun(skip: boolean) {
  const session = new DemoSession(null);
  await asked(session);
  session.approve('p1');
  session.phonePlan();
  if (skip) session.phoneSkip();
  const plan = session.state.plans[0];
  for (const i of plan.sessions.keys()) {
    if (session.state.phone.done.includes(i)) continue;
    expect(session.phoneOpen(i)).toEqual({ ok: true });
    await playOpenSession(session);
  }
  return session.state;
}

describe('DemoSession', () => {
  it('runs an ask in the background and records answer, title and plan', async () => {
    const session = new DemoSession(null);
    let published = 0;
    session.subscribe(() => published++);
    const r = session.ask(MA, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.conversationId).toBe('c1');
    expect(session.state.busy).toBe(true);
    expect(session.state.conversations[0].pending).toEqual({ steps: [] });
    await r.done;
    const c = session.state.conversations[0];
    expect(c).toMatchObject({ title: 'Minh Anh’s Quiz 2 drop', pending: null });
    expect(c.msgs).toHaveLength(2);
    expect(session.state.plans.map((p) => p.id)).toEqual(['p1']);
    expect(session.state.busy).toBe(false);
    expect(published).toBeGreaterThanOrEqual(2);
  });
  it('caps the question length', async () => {
    const session = new DemoSession(null);
    expect(session.ask('x'.repeat(501), null)).toEqual({ ok: false, status: 400, error: 'Please keep questions under 500 characters.' });
    expect(session.state.conversations).toEqual([]);
    const r = session.ask('x'.repeat(500), null);
    expect(r.ok).toBe(true);
    if (r.ok) await r.done;
  });
  it('rejects empty questions and a second ask while busy', async () => {
    const session = new DemoSession(null);
    expect(session.ask('  ', null)).toMatchObject({ ok: false, status: 400 });
    const r = session.ask(MA, null);
    expect(session.ask('And the class?', null)).toMatchObject({ ok: false, status: 409 });
    if (r.ok) await r.done;
  });
  it('streams agent steps into the pending conversation', async () => {
    const { client } = fakeClient([[{ tool: 'get_student', input: { student_id: 's17' } }], [{ tool: 'report', input: reportInput({ needs_plan: false }) }]]);
    const session = new DemoSession(client);
    const steps: string[][] = [];
    session.subscribe((s) => steps.push(s.conversations[0]?.pending?.steps ?? []));
    await asked(session);
    expect(steps.some((x) => x.includes('Student Analysis Agent · reading Minh Anh’s learning twin'))).toBe(true);
    expect(session.state.conversations[0].title).toBe('Minh Anh · implication gap');
  });
  it('continues a conversation when given its id, and keeps its first title', async () => {
    const session = new DemoSession(null);
    const id = await asked(session);
    await asked(session, 'What gap is the class facing this week?', id);
    expect(session.state.conversations).toHaveLength(1);
    expect(session.state.conversations[0].msgs).toHaveLength(4);
    expect(session.state.conversations[0].title).toBe('Minh Anh’s Quiz 2 drop');
  });
  it('reset aborts a run and drops its late result', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { client: inner } = fakeClient([[{ tool: 'report', input: reportInput({ needs_plan: false }) }]]);
    const signals: (AbortSignal | undefined)[] = [];
    const client: MessagesClient = { create: async (p, o) => { signals.push(o?.signal); await gate; return inner.create(p, o); } };
    const session = new DemoSession(client);
    const r = session.ask(MA, null);
    session.reset();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.aborted).toBe(true);
    release();
    if (r.ok) await r.done;
    expect(session.state).toMatchObject({ epoch: 1, conversations: [], plans: [], busy: false });
  });
  it('approve → phone → mastery check → adapt delivers the follow-up', async () => {
    const session = new DemoSession(null);
    await asked(session);
    expect(session.approve('p1')).toEqual({ ok: true });
    expect(session.state.phone).toMatchObject({ planId: 'p1', screen: 'lock' });
    session.phonePlan();
    session.phoneSkip();
    expect(session.phoneOpen(3)).toEqual({ ok: true });
    await playOpenSession(session);
    const s = session.state;
    expect(s.clock).toBe(TONIGHT);
    expect(s.phone).toMatchObject({ screen: 'progress', updated: true, lastDone: 'p1', planId: 'p2' });
    expect(s.plans.find((p) => p.id === 'p2')?.status).toBe('autoApproved');
    expect(s.conversations[0].msgs.at(-1)).toMatchObject({ role: 'assistant', stamp: '20:40' });
    expect(s.busy).toBe(false);
  });
  it('Finish starts the adapt run, and its follow-up lands while the review is open', async () => {
    const session = new DemoSession(null);
    await asked(session);
    session.approve('p1');
    session.phonePlan();
    session.phoneSkip();
    session.phoneOpen(3);
    for (const [i, item] of sessionItems('equivalence', true).entries()) {
      session.phoneAnswer(item.correct);
      if (i < 2) session.phoneNext();
    }
    const finished = session.phoneFinish();
    if (!finished.ok) throw new Error(finished.error);
    expect(session.state.phone.screen).toBe('review');
    await finished.done;
    expect(session.state.phone).toMatchObject({ screen: 'review', planId: 'p2', updated: true });
    expect(session.state.phone.sheet).toHaveLength(3);
    expect(session.phoneContinue()).toEqual({ ok: true });
    expect(session.state.phone).toMatchObject({ screen: 'progress', planId: 'p2', sheet: [] });
  });
  it('a perfect offline run reaches the target, with or without Skip', async () => {
    for (const skip of [false, true]) {
      const s = await perfectRun(skip);
      expect(s.students.find((x) => x.id === 's17')!.mastery.equivalence).toBeGreaterThanOrEqual(0.75);
      const last = s.conversations[0].msgs.at(-1);
      if (last?.role !== 'assistant') throw new Error('no adapt message');
      expect(last.blocks[0].text).toContain('has reached the target');
    }
  });
  it('a second offline question in a conversation does not add a plan', async () => {
    const session = new DemoSession(null);
    const id = await asked(session);
    await asked(session, 'Show me her full history', id);
    expect(session.state.plans.map((p) => p.id)).toEqual(['p1']);
    expect(session.state.conversations[0].msgs.at(-1)).toMatchObject({ panel: { planId: 'p1' } });
  });
  describe('a revision that lands late', () => {
    const revising = () => {
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const { client: inner } = fakeClient([
        [{ tool: 'report', input: reportInput() }], [{ tool: 'propose_plan', input: planInput() }],
        [{ tool: 'report', input: reportInput({ needs_plan: false, revise_plan: true }) }], [{ tool: 'propose_plan', input: planInput({ title: 'Revised' }) }],
      ]);
      let n = 0;
      const client: MessagesClient = { create: async (p, o) => { if (++n === 3) await gate; return inner.create(p, o); } };
      return { session: new DemoSession(client), release };
    };
    it('replaces a plan that is still proposed', async () => {
      const { session, release } = revising();
      const id = await asked(session);
      const r = session.ask('Make it shorter', id);
      release();
      if (r.ok) await r.done;
      expect(session.state.plans).toHaveLength(1);
      expect(session.state.plans[0]).toMatchObject({ title: 'Revised', status: 'proposed' });
    });
    it('does not overwrite a plan approved in the meantime', async () => {
      const { session, release } = revising();
      const id = await asked(session);
      const r = session.ask('Make it shorter', id);
      expect(session.approve('p1')).toEqual({ ok: true });
      release();
      if (r.ok) await r.done;
      expect(session.state.plans).toHaveLength(1);
      expect(session.state.plans[0]).toMatchObject({ title: 'Rebuild implication, then equivalence', status: 'sent' });
    });
  });
  it('reports reducer errors', () => {
    const session = new DemoSession(null);
    expect(session.approve('nope')).toEqual({ ok: false, error: 'Only a proposed plan can be approved.' });
    expect(session.phoneNext()).toEqual({ ok: false, error: 'No practice open.' });
  });
  it('drops a failing subscriber without failing the command or the others', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const session = new DemoSession(null);
    const seen: number[] = [];
    session.subscribe(() => { throw new Error('gone'); });
    session.subscribe((s) => seen.push(s.epoch));
    session.reset();
    session.reset();
    expect(seen).toEqual([1, 2]);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
