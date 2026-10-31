import { describe, expect, it } from 'vitest';
import { TONIGHT } from '../src/live/clock';
import { sessionItems } from '../src/scenario/practiceBank';
import type { MessagesClient } from './agents/client';
import { fakeClient } from './agents/fakeClient';
import { reportInput } from './agents/samples';
import { DemoSession } from './session';

const MA = 'Why did Minh Anh’s quiz score drop?';
const asked = async (session: DemoSession, text = MA, id: string | null = null) => {
  const r = session.ask(text, id);
  if (!r.ok) throw new Error(r.error);
  await r.done;
  return r.conversationId;
};

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
    const client: MessagesClient = { create: async (p, o) => { await gate; return inner.create(p, o); } };
    const session = new DemoSession(client);
    const r = session.ask(MA, null);
    session.reset();
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
    for (const item of sessionItems('equivalence', true)) {
      expect(session.phoneAnswer(item.correct)).toEqual({ ok: true });
      const next = session.phoneNext();
      if (!next.ok) throw new Error(next.error);
      await next.done;
    }
    const s = session.state;
    expect(s.clock).toBe(TONIGHT);
    expect(s.phone).toMatchObject({ screen: 'progress', updated: true, lastDone: 'p1', planId: 'p2' });
    expect(s.plans.find((p) => p.id === 'p2')?.status).toBe('autoApproved');
    expect(s.conversations[0].msgs.at(-1)).toMatchObject({ role: 'assistant', stamp: '20:40' });
    expect(s.busy).toBe(false);
  });
  it('reports reducer errors', () => {
    const session = new DemoSession(null);
    expect(session.approve('nope')).toEqual({ ok: false, error: 'Only a proposed plan can be approved.' });
    expect(session.phoneNext()).toEqual({ ok: false, error: 'Answer the item first.' });
  });
});
