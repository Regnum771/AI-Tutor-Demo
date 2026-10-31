import { describe, expect, it } from 'vitest';
import { stateWithPlan } from '../../src/live/fixtures';
import { MASTERY_INITIAL } from '../../src/scenario/minhAnh';
import { adaptMessages, adaptSpec } from './adapt';
import { fakeClient } from './fakeClient';
import { runAgent } from './loop';
import { adaptInput, pathwaySessions, planInput, reportInput } from './samples';
import { SAS_SYSTEM, sasMessages, sasSpec, type Report } from './sas';
import { TAS_SYSTEM, tasMessages, tasSpec } from './tas';

const quiet = { onStep: () => {} };
const ask = [{ role: 'user' as const, content: 'x' }];

describe('Student Analysis Agent', () => {
  const state = stateWithPlan();

  it('reads the twin and returns a cited report', async () => {
    const { client } = fakeClient([[{ tool: 'get_student', input: { student_id: 's17' } }], [{ tool: 'report', input: reportInput() }]]);
    const steps: string[] = [];
    const r = await runAgent(client, sasSpec(state), sasMessages([], 'Why?', state, null), { onStep: (l) => steps.push(l) });
    expect(steps).toEqual(['Student Analysis Agent · reading Minh Anh’s learning twin']);
    expect(r).toMatchObject({ title: 'Minh Anh · implication gap', focus: { kind: 'student', studentId: 's17' }, needsPlan: true, revisePlan: false, gaps: ['implication'] });
    expect(r.followUps).toHaveLength(3);
    expect(r.blocks[0]).toEqual({ kind: 'p', text: 'Quiz 2 fell from **75% to 42%**.', cites: ['s17-quiz2'] });
  });
  it('sends invented evidence ids back once', async () => {
    const bad = reportInput({ blocks: [{ kind: 'p', text: 'x', cites: ['s17-made-up'] }] });
    const { client, calls } = fakeClient([[{ tool: 'report', input: bad }], [{ tool: 'report', input: reportInput() }]]);
    await runAgent(client, sasSpec(state), sasMessages([], 'Why?', state, null), quiet);
    expect(JSON.stringify(calls[1].messages.at(-1))).toContain('These evidence ids do not exist: s17-made-up');
  });
  it('rejects an unknown focus student', async () => {
    const { client, calls } = fakeClient([[{ tool: 'report', input: reportInput({ focus_student_id: 's99' }) }], [{ tool: 'report', input: reportInput() }]]);
    await runAgent(client, sasSpec(state), sasMessages([], 'Why?', state, null), quiet);
    expect(JSON.stringify(calls[1].messages.at(-1))).toContain('is not a student id');
  });
  it('keeps volatile context out of the cached system prompt', () => {
    const m = sasMessages([{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hello' }], 'And now?', state, state.plans[0]);
    expect(m).toHaveLength(3);
    expect(String(m[2].content)).toContain('Story time: 15:00');
    expect(String(m[2].content)).toContain('"id":"p1"');
    expect(String(m[2].content)).toContain('Lecturer: And now?');
    expect(SAS_SYSTEM).not.toContain('15:00');
  });
});

describe('Teaching Assistance Agent', () => {
  const state = stateWithPlan();

  it('tells the agent not to assume pronouns, like the other agents', () => {
    expect(TAS_SYSTEM).toContain("do not assume anyone's pronouns");
  });
  it('turns propose_plan into a proposed Plan', async () => {
    const { client } = fakeClient([[{ tool: 'propose_plan', input: planInput() }]]);
    const plan = await runAgent(client, tasSpec(state, 'c1', 'p9'), ask, quiet);
    expect(plan).toMatchObject({ id: 'p9', conversationId: 'c1', status: 'proposed', kind: 'pathway', studentIds: ['s17'] });
    expect(plan.sessions[0]).toEqual({ time: '15:30', title: 'Review implication', minutes: 8, concept: 'implication', isMasteryCheck: false, studentId: null });
  });
  it('sends policy problems back and accepts the fix', async () => {
    const early = planInput({ sessions: pathwaySessions('14:00') });
    const { client, calls } = fakeClient([[{ tool: 'propose_plan', input: early }], [{ tool: 'propose_plan', input: planInput() }]]);
    await runAgent(client, tasSpec(state, 'c1', 'p9'), ask, quiet);
    expect(JSON.stringify(calls[1].messages.at(-1))).toContain('Session 1 at 14:00 is not after now (15:00).');
  });
  it('fills check-in student ids from the sessions', async () => {
    const checkIns = planInput({
      kind: 'checkIns', student_ids: [], day: 'Friday',
      sessions: [{ time: '14:00', title: 'Check-in', minutes: 15, concept: 'none', is_mastery_check: false, student_id: 's29' }],
    });
    const { client } = fakeClient([[{ tool: 'propose_plan', input: checkIns }]]);
    const plan = await runAgent(client, tasSpec(state, 'c1', 'p9'), ask, quiet);
    expect(plan.studentIds).toEqual(['s29']);
    expect(plan.sessions[0].concept).toBeNull();
  });
  it('briefs the agent with the diagnosis, practice concepts and the open plan', () => {
    const report: Report = {
      title: 't', blocks: [{ kind: 'li', text: 'Converse on 6 items', cites: [] }], focus: { kind: 'student', studentId: 's17' },
      gaps: ['implication'], needsPlan: true, revisePlan: true, followUps: [],
    };
    const text = String(tasMessages(state, 'Make it shorter', report, state.plans[0])[0].content);
    expect(text).toContain('- Converse on 6 items');
    expect(text).toContain('student s17 (Nguyễn Minh Anh)');
    expect(text).toContain('equivLaws');
    expect(text).toContain('"id":"p1"');
  });
});

describe('Adapt', () => {
  const after = () => {
    const s = stateWithPlan('pathway', { status: 'done' });
    s.clock = 20 * 60 + 40;
    s.students[16].mastery.equivalence = 0.71;
    return s;
  };

  it('auto-approves a follow-up of up to 3 sessions', async () => {
    const s = after();
    const { client } = fakeClient([[{ tool: 'adapt_report', input: adaptInput(3) }]]);
    const r = await runAgent(client, adaptSpec(s, s.plans[0], 'p2'), adaptMessages(s, s.plans[0], MASTERY_INITIAL), quiet);
    expect(r.followUp).toMatchObject({ id: 'p2', status: 'autoApproved', day: 'Tomorrow', studentIds: ['s17'], conversationId: 'c1' });
    expect(r.blocks[0].text).toContain('0.35 → 0.71');
  });
  it('leaves a bigger follow-up for the teacher, and none when not needed', async () => {
    const s = after();
    const four = fakeClient([[{ tool: 'adapt_report', input: adaptInput(4) }]]);
    expect((await runAgent(four.client, adaptSpec(s, s.plans[0], 'p2'), ask, quiet)).followUp?.status).toBe('proposed');
    const none = fakeClient([[{ tool: 'adapt_report', input: adaptInput(0) }]]);
    expect((await runAgent(none.client, adaptSpec(s, s.plans[0], 'p2'), ask, quiet)).followUp).toBeNull();
  });
  it('tells the agent what changed tonight', () => {
    const s = after();
    const text = String(adaptMessages(s, s.plans[0], MASTERY_INITIAL)[0].content);
    expect(text).toContain('Logical equivalence 0.35 → 0.71');
    expect(text).toContain('call them Minh Anh');
  });
});
