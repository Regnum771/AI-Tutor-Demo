import { describe, expect, it, vi } from 'vitest';
import { TONIGHT } from '../../src/live/clock';
import { stateWithPlan } from '../../src/live/fixtures';
import { planProblems } from '../../src/live/plans';
import { seedState } from '../../src/live/seed';
import { MASTERY_INITIAL } from '../../src/scenario/minhAnh';
import { cannedAnswer, cannedPlan } from './canned';
import { failingClient, fakeClient } from './fakeClient';
import { adaptAfterCheck, answer, historyOf, type Deps } from './orchestrate';
import { adaptInput, planInput, reportInput } from './samples';

const deps = (over: Partial<Deps> = {}): Deps & { steps: string[] } => {
  const steps: string[] = [];
  return { client: null, newPlanId: () => 'p1', onStep: (l) => steps.push(l), steps, ...over };
};
const MA = 'Why did Minh Anh’s quiz score drop?';
const CLASS_PLAN = planInput({
  kind: 'classActivity', student_ids: ['s8', 's13'], day: 'Thursday',
  sessions: [{ time: '10:00', title: 'Recap', minutes: 15, concept: 'none', is_mastery_check: false, student_id: '' }],
});

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
  it('routes the panel on the plan first, whatever the focus', async () => {
    const pathway = fakeClient([[{ tool: 'report', input: reportInput({ focus_kind: 'class', focus_student_id: '' }) }], [{ tool: 'propose_plan', input: planInput() }]]);
    expect((await answer(seedState(), [], 'c1', MA, deps({ client: pathway.client }))).msg.panel).toEqual({ kind: 'student', studentId: 's17', planId: 'p1', highlight: null });
    const cls = fakeClient([[{ tool: 'report', input: reportInput() }], [{ tool: 'propose_plan', input: CLASS_PLAN }]]);
    expect((await answer(seedState(), [], 'c1', MA, deps({ client: cls.client }))).msg.panel).toEqual({ kind: 'class', planId: 'p1' });
  });
  it('keeps the open plan when a plan is wanted on the same subject', async () => {
    const state = stateWithPlan();
    const { client, calls } = fakeClient([[{ tool: 'report', input: reportInput({ needs_plan: true, revise_plan: false }) }]]);
    const newPlanId = vi.fn(() => 'p7');
    const out = await answer(state, state.conversations[0].msgs, 'c1', MA, deps({ client, newPlanId }));
    expect(calls).toHaveLength(1);
    expect(out.plan).toBeNull();
    expect(newPlanId).not.toHaveBeenCalled();
    expect(out.msg.panel).toEqual({ kind: 'student', studentId: 's17', planId: 'p1', highlight: null });
  });
  it('drafts a check-ins plan beside an open class activity', async () => {
    const state = stateWithPlan('classActivity');
    const checkIns = planInput({ kind: 'checkIns', student_ids: ['s8'], day: 'Thursday', sessions: [{ time: '10:00', title: 'Check in', minutes: 10, concept: 'none', is_mastery_check: false, student_id: 's8' }] });
    const { client, calls } = fakeClient([[{ tool: 'report', input: reportInput({ focus_kind: 'class', focus_student_id: '', needs_plan: true }) }], [{ tool: 'propose_plan', input: checkIns }]]);
    const out = await answer(state, state.conversations[0].msgs, 'c1', 'Who needs me personally?', deps({ client, newPlanId: () => 'p7' }));
    expect(out.plan?.id).toBe('p7');
    expect(JSON.stringify(calls[1])).toContain('Open plan to revise: none');
  });
  it('drafts a class activity beside open check-ins', async () => {
    const state = stateWithPlan('checkIns');
    const { client } = fakeClient([[{ tool: 'report', input: reportInput({ focus_kind: 'class', focus_student_id: '', needs_plan: true }) }], [{ tool: 'propose_plan', input: CLASS_PLAN }]]);
    const out = await answer(state, state.conversations[0].msgs, 'c1', 'What gap is the class facing?', deps({ client, newPlanId: () => 'p7' }));
    expect(out.plan?.id).toBe('p7');
  });
  it('shows no panel when nothing is in focus', async () => {
    const state = stateWithPlan();
    const { client } = fakeClient([[{ tool: 'report', input: reportInput({ focus_kind: 'none', focus_student_id: '', needs_plan: false }) }]]);
    const out = await answer(state, state.conversations[0].msgs, 'c1', 'Thanks', deps({ client }));
    expect(out.plan).toBeNull();
    expect(out.msg.panel).toBeNull();
  });
  it.each([
    ['Make a plan for Minh Anh', true], ['Can you draft an intervention?', true], ['What should I do?', true],
    ['I need to know how the plan went', false], ['Give me an update on the plan', false],
    ['Did you make the plan I approved?', false], ['How did the plan go?', false],
  ])('plan request wording: %s', async (text, drafts) => {
    const script = [[{ tool: 'report', input: reportInput({ needs_plan: false }) }], ...(drafts ? [[{ tool: 'propose_plan', input: planInput() }]] : [])];
    const { client, calls } = fakeClient(script);
    await answer(seedState(), [], 'c1', text, deps({ client }));
    expect(calls).toHaveLength(drafts ? 2 : 1);
  });
  it('drafts a new plan for another student and leaves the open one alone', async () => {
    const state = stateWithPlan();
    const { client } = fakeClient([[{ tool: 'report', input: reportInput({ focus_student_id: 's29' }) }], [{ tool: 'propose_plan', input: planInput({ student_ids: ['s29'] }) }]]);
    const out = await answer(state, state.conversations[0].msgs, 'c1', 'And s29?', deps({ client, newPlanId: () => 'p7' }));
    expect(out.plan).toMatchObject({ id: 'p7', studentIds: ['s29'] });
    expect(out.msg.panel).toEqual({ kind: 'student', studentId: 's29', planId: 'p7', highlight: null });
    expect(state.plans.map((p) => p.id)).toEqual(['p1']);
  });
  it('a follow-up question keeps the open plan’s card', async () => {
    const state = stateWithPlan();
    const { client } = fakeClient([[{ tool: 'report', input: reportInput({ needs_plan: false }) }]]);
    const out = await answer(state, state.conversations[0].msgs, 'c1', 'How is Minh Anh?', deps({ client }));
    expect(out.plan).toBeNull();
    expect(out.msg.panel).toEqual({ kind: 'student', studentId: 's17', planId: 'p1', highlight: null });
  });
  it('does not attach the open plan to a question about someone else', async () => {
    const state = stateWithPlan();
    const { client } = fakeClient([[{ tool: 'report', input: reportInput({ needs_plan: false, focus_student_id: 's29' }) }]]);
    const out = await answer(state, state.conversations[0].msgs, 'c1', 'And s29?', deps({ client }));
    expect(out.msg.panel).toEqual({ kind: 'student', studentId: 's29', planId: null, highlight: null });
  });
  it('only a request for a plan starts the planner', async () => {
    const asking = fakeClient([[{ tool: 'report', input: reportInput({ needs_plan: false }) }]]);
    const d = deps({ client: asking.client });
    await answer(seedState(), [], 'c1', 'How did the plan go?', d);
    expect(asking.calls).toHaveLength(1);
    expect(d.steps).toEqual([]);
    const draft = fakeClient([[{ tool: 'report', input: reportInput({ needs_plan: false }) }], [{ tool: 'propose_plan', input: planInput() }]]);
    expect((await answer(seedState(), [], 'c1', 'Please draft a plan for Minh Anh', deps({ client: draft.client }))).plan?.id).toBe('p1');
  });
  it('says so when no plan fits the policy', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const early = planInput({ sessions: [{ time: '09:00', title: 'x', minutes: 8, concept: 'implication', is_mastery_check: true, student_id: '' }] });
    const { client } = fakeClient([[{ tool: 'report', input: reportInput() }], [{ tool: 'propose_plan', input: early }], [{ tool: 'propose_plan', input: early }]]);
    const out = await answer(seedState(), [], 'c1', MA, deps({ client }));
    expect(out.plan).toBeNull();
    expect(out.msg.blocks.at(-1)?.text).toBe('I couldn’t draft a plan within your policy.');
    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0][0])).toMatch(/^\[beyond\] plan drafting failed: /);
    warn.mockRestore();
  });
  it('falls back to canned answers offline or on API errors', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const client of [null, failingClient()]) {
      const out = await answer(seedState(), [], 'c1', MA, deps({ client }));
      expect(out.msg).toMatchObject({ source: 'offline', canned: 'student', panel: { kind: 'student', studentId: 's17', planId: 'p1' } });
      expect(out.title).toBe('Minh Anh’s Quiz 2 drop');
      expect(out.plan?.kind).toBe('pathway');
    }
    const other = await answer(seedState(), [], 'c1', 'Tell me a joke', deps());
    expect(other.msg.canned).toBe('fallback');
    expect(other.plan).toBeNull();
    expect(warn.mock.calls).toEqual([['[beyond] agents failed, answering offline: connect ECONNREFUSED']]);
    warn.mockRestore();
  });
});

describe('offline answers', () => {
  it('reuse the plan already in the conversation instead of drafting another', () => {
    const state = seedState();
    const first = cannedAnswer(state, MA, { planId: 'p1', conversationId: 'c1' });
    state.plans.push(first.plan!);
    const again = cannedAnswer(state, 'Show me her full history', { planId: 'p2', conversationId: 'c1' });
    expect(again.plan).toBeNull();
    expect(again.msg.panel).toEqual({ kind: 'student', studentId: 's17', planId: 'p1', highlight: null });
  });
  it('draft a fresh plan for another topic, another conversation or after a dismissal', () => {
    const state = seedState();
    state.plans.push(cannedAnswer(state, MA, { planId: 'p1', conversationId: 'c1' }).plan!);
    expect(cannedAnswer(state, 'What gap is the class facing this week?', { planId: 'p2', conversationId: 'c1' }).plan?.id).toBe('p2');
    expect(cannedAnswer(state, MA, { planId: 'p2', conversationId: 'c2' }).plan?.id).toBe('p2');
    state.plans[0].status = 'dismissed';
    expect(cannedAnswer(state, MA, { planId: 'p2', conversationId: 'c1' }).plan?.id).toBe('p2');
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
    s.plans[0].baseline = { ...MASTERY_INITIAL };
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
  it('offline: a plan for another day gets no further follow-up', async () => {
    const s = after();
    s.plans[0].day = 'Tomorrow';
    const out = await adaptAfterCheck(s, 'p1', deps({ newPlanId: () => 'p2' }));
    expect(out.followUp).toBeNull();
    expect(out.msg.blocks).toHaveLength(1);
    expect(out.msg.blocks[0].text).toContain('finished the mastery check');
    expect(out.msg.blocks[0].text).not.toContain('tonight');
    expect(out.msg.panel).toMatchObject({ planId: 'p1' });
  });
  it('offline: a plan for today says tonight and offers the follow-up', async () => {
    const out = await adaptAfterCheck(after(), 'p1', deps({ newPlanId: () => 'p2' }));
    expect(out.msg.blocks).toHaveLength(2);
    expect(out.msg.blocks[0].text).toContain('finished tonight’s mastery check');
  });
  it('logs a failed adapt run and answers offline', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await adaptAfterCheck(after(), 'p1', deps({ client: failingClient(), newPlanId: () => 'p2' }));
    expect(out.msg.source).toBe('offline');
    expect(warn.mock.calls).toEqual([['[beyond] adapt failed, answering offline: connect ECONNREFUSED']]);
    warn.mockRestore();
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
