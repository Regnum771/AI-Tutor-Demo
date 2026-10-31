import { describe, expect, it, vi } from 'vitest';
import { TONIGHT } from '../../src/live/clock';
import { stateWithPlan } from '../../src/live/fixtures';
import { planProblems } from '../../src/live/plans';
import { seedState } from '../../src/live/seed';
import { MASTERY_INITIAL } from '../../src/scenario/minhAnh';
import { cannedPlan } from './canned';
import { failingClient, fakeClient } from './fakeClient';
import { adaptAfterCheck, answer, historyOf, type Deps } from './orchestrate';
import { adaptInput, planInput, reportInput } from './samples';

const deps = (over: Partial<Deps> = {}): Deps & { steps: string[] } => {
  const steps: string[] = [];
  return { client: null, newPlanId: () => 'p1', onStep: (l) => steps.push(l), steps, ...over };
};
const MA = 'Why did Minh Anh’s quiz score drop?';

describe('answer', () => {
  it('runs SAS then TAS and points the panel at the new plan', async () => {
    const { client } = fakeClient([[{ tool: 'report', input: reportInput() }], [{ tool: 'propose_plan', input: planInput() }]]);
    const d = deps({ client });
    const out = await answer(seedState(), [], 'c1', MA, d);
    expect(d.steps).toEqual(['Teaching Assistance Agent · drafting a plan']);
    expect(out).toMatchObject({ title: 'Minh Anh · implication gap', sansTitle: true, plan: { id: 'p1', conversationId: 'c1' } });
    expect(out.msg).toMatchObject({ source: 'agents', canned: null, panel: { kind: 'student', studentId: 's17', planId: 'p1' } });
    expect(out.msg.followUps).toHaveLength(3);
  });
  it('answers without a plan when none is needed', async () => {
    const { client } = fakeClient([[{ tool: 'report', input: reportInput({ needs_plan: false }) }]]);
    const out = await answer(seedState(), [], 'c1', 'How is Minh Anh?', deps({ client }));
    expect(out.plan).toBeNull();
    expect(out.msg.panel).toEqual({ kind: 'student', studentId: 's17', planId: null, highlight: null });
  });
  it('revises the open plan in place', async () => {
    const state = stateWithPlan();
    const { client } = fakeClient([[{ tool: 'report', input: reportInput({ needs_plan: false, revise_plan: true }) }], [{ tool: 'propose_plan', input: planInput() }]]);
    const newPlanId = vi.fn(() => 'p7');
    const d = deps({ client, newPlanId });
    const out = await answer(state, state.conversations[0].msgs, 'c1', 'Make it shorter', d);
    expect(out.plan?.id).toBe('p1');
    expect(newPlanId).not.toHaveBeenCalled();
    expect(d.steps).toEqual(['Teaching Assistance Agent · revising the plan']);
  });
  it('says so when no plan fits the policy', async () => {
    const early = planInput({ sessions: [{ time: '09:00', title: 'x', minutes: 8, concept: 'implication', is_mastery_check: true, student_id: '' }] });
    const { client } = fakeClient([[{ tool: 'report', input: reportInput() }], [{ tool: 'propose_plan', input: early }], [{ tool: 'propose_plan', input: early }]]);
    const out = await answer(seedState(), [], 'c1', MA, deps({ client }));
    expect(out.plan).toBeNull();
    expect(out.msg.blocks.at(-1)?.text).toBe('I couldn’t draft a plan within your policy.');
  });
  it('falls back to canned answers offline or on API errors', async () => {
    for (const client of [null, failingClient()]) {
      const out = await answer(seedState(), [], 'c1', MA, deps({ client }));
      expect(out.msg).toMatchObject({ source: 'offline', canned: 'student', panel: { kind: 'student', studentId: 's17', planId: 'p1' } });
      expect(out.title).toBe('Minh Anh’s Quiz 2 drop');
      expect(out.plan?.kind).toBe('pathway');
    }
    const other = await answer(seedState(), [], 'c1', 'Tell me a joke', deps());
    expect(other.msg.canned).toBe('fallback');
    expect(other.plan).toBeNull();
  });
});

describe('canned plans', () => {
  it('are valid for all three topics, also later in the day', () => {
    const state = seedState();
    for (const topic of ['student', 'class', 'attention'] as const) expect(planProblems(cannedPlan(state, topic, 'p1', 'c1'), state)).toEqual([]);
    state.clock = 17 * 60;
    const late = cannedPlan(state, 'student', 'p1', 'c1');
    expect(planProblems(late, state)).toEqual([]);
    expect(late.sessions[0].time).toBe('17:30');
  });
});

describe('adaptAfterCheck', () => {
  const after = () => {
    const s = stateWithPlan('pathway', { status: 'done' });
    s.clock = TONIGHT;
    s.phone.before = { ...MASTERY_INITIAL };
    s.students[16].mastery.equivalence = 0.71;
    return s;
  };
  it('offline: canned update and an auto-approved 3-session follow-up', async () => {
    const out = await adaptAfterCheck(after(), 'p1', deps({ newPlanId: () => 'p2' }));
    expect(out.msg).toMatchObject({ source: 'offline', stamp: '20:40', panel: { kind: 'student', studentId: 's17', planId: 'p2' } });
    expect(out.msg.blocks[0].text).toContain('**0.35 → 0.71**');
    expect(out.followUp).toMatchObject({ id: 'p2', status: 'autoApproved', day: 'Tomorrow' });
    expect(planProblems(out.followUp!, after())).toEqual([]);
  });
  it('online: the agent decides, here with no follow-up', async () => {
    const { client } = fakeClient([[{ tool: 'adapt_report', input: adaptInput(0) }]]);
    const d = deps({ client, newPlanId: () => 'p2' });
    const out = await adaptAfterCheck(after(), 'p1', d);
    expect(out.followUp).toBeNull();
    expect(out.msg).toMatchObject({ source: 'agents', panel: { planId: 'p1' } });
    expect(d.steps).toEqual(['Teaching Assistance Agent · reviewing tonight’s mastery check']);
  });
});

describe('historyOf', () => {
  it('turns the conversation into plain-text turns', () => {
    expect(historyOf(stateWithPlan().conversations[0].msgs)).toEqual([
      { role: 'user', text: 'Why did Minh Anh’s quiz score drop?' },
      { role: 'assistant', text: 'Quiz 2 fell from **75% to 42%**.\n- She picked the converse on 6 items.' },
    ]);
  });
});
