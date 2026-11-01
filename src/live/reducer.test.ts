import { describe, expect, it } from 'vitest';
import { sessionItems } from '../scenario/practiceBank';
import { planFor, stateWithPlan } from './fixtures';
import { afterAnswer } from './mastery';
import {
  approvePlan, currentItems, deliver, dismissPlan, editPlan, phoneAnswer, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result,
} from './reducer';
import type { DemoState } from './types';

const ok = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const ma = (s: DemoState) => s.students[16];
const lastMsg = (s: DemoState) => s.conversations[0].msgs.at(-1)!;

describe('plan transitions', () => {
  it('approving a pathway sends it to the phone and confirms in the conversation', () => {
    const before = stateWithPlan();
    const s = ok(approvePlan(before, 'p1'));
    expect(s.plans[0].status).toBe('sent');
    expect(s.phone).toMatchObject({ planId: 'p1', screen: 'lock', done: [], updated: false });
    expect(s.plans[0].baseline).toEqual(ma(s).mastery);
    const msg = lastMsg(s);
    expect(msg.role === 'assistant' && msg.source).toBe('system');
    expect(msg.role === 'assistant' && msg.blocks[0].text).toContain('Sent to Minh Anh’s phone');
    expect(before.plans[0].status).toBe('proposed');
  });
  it('approving a class activity or check-ins records it and never touches the phone', () => {
    for (const kind of ['classActivity', 'checkIns'] as const) {
      const s = ok(approvePlan(stateWithPlan(kind), 'p1'));
      expect(s.plans[0].status).toBe('approved');
      expect(s.phone.planId).toBeNull();
      expect(lastMsg(s).role).toBe('assistant');
    }
  });
  it('only a proposed plan can be approved, edited or dismissed', () => {
    const sent = ok(approvePlan(stateWithPlan(), 'p1'));
    expect(approvePlan(sent, 'p1').ok).toBe(false);
    expect(editPlan(sent, 'p1', 0, { time: '16:00' }).ok).toBe(false);
    expect(dismissPlan(sent, 'p1').ok).toBe(false);
    expect(approvePlan(sent, 'nope').ok).toBe(false);
  });
  it('edits a time, rejects a bad time, and keeps the mastery check', () => {
    const s = ok(editPlan(stateWithPlan(), 'p1', 1, { time: '20:30' }));
    expect(s.plans[0].sessions[1].time).toBe('20:30');
    expect(editPlan(s, 'p1', 1, { time: '8.30' })).toEqual({ ok: false, error: 'Time must be HH:MM.' });
    expect(editPlan(s, 'p1', 1, { remove: true })).toEqual({ ok: false, error: 'The mastery check stays in the plan.' });
    expect(ok(editPlan(s, 'p1', 0, { remove: true })).plans[0].sessions).toHaveLength(1);
  });
  it('dismissing sets the plan aside with a one-line acknowledgement', () => {
    const s = ok(dismissPlan(stateWithPlan(), 'p1'));
    expect(s.plans[0].status).toBe('dismissed');
    const msg = lastMsg(s);
    expect(msg.role === 'assistant' && msg.source).toBe('system');
  });
});

describe('phone flow', () => {
  const sent = () => ok(approvePlan(stateWithPlan(), 'p1'));

  it('tapping the notification shows the plan; opening a session moves the clock to it', () => {
    const s = ok(phoneOpen(ok(phoneShowPlan(sent())), 0));
    expect(s.phone).toMatchObject({ screen: 'practice', session: 0, item: 0 });
    expect(s.clock).toBe(15 * 60 + 30);
    expect(currentItems(s).map((i) => i.id)).toEqual(['implication-1', 'implication-2']);
  });
  it('a wrong answer shows the hint and leaves mastery; a right one after it gains 15%', () => {
    let s = ok(phoneOpen(sent(), 0));
    s = ok(phoneAnswer(s, 0));
    expect(s.phone).toMatchObject({ result: 'wrong', lastOption: 0, hinted: true });
    expect(ma(s).mastery.implication).toBe(0.31);
    expect(phoneNext(s).ok).toBe(false);
    s = ok(phoneAnswer(s, 1));
    expect(s.phone.result).toBe('right');
    expect(ma(s).mastery.implication).toBe(afterAnswer(0.31, true, true));
    expect(ma(s).evidence.at(-1)).toMatchObject({ kind: 'practice', concept: 'implication', when: '15:30' });
    expect(phoneAnswer(s, 1).ok).toBe(false);
  });
  it('tapping the same wrong option again is not a new attempt; a different wrong option is', () => {
    let s = ok(phoneOpen(sent(), 0));
    const item = currentItems(s)[0];
    const wrongs = item.options.map((_, i) => i).filter((i) => i !== item.correct);
    s = ok(phoneAnswer(s, wrongs[0]));
    expect(phoneAnswer(s, wrongs[0]).ok).toBe(false);
    const again = ok(phoneAnswer(s, wrongs[1]));
    expect(ma(again).evidence.length).toBe(ma(s).evidence.length + 1);
  });
  it('finishing a practice session returns to the plan; finishing the check reports it', () => {
    let s = ok(phoneOpen(sent(), 0));
    for (const item of sessionItems('implication', false)) {
      s = ok(phoneAnswer(s, item.correct));
      s = ok(phoneNext(s));
    }
    expect(s.phone).toMatchObject({ screen: 'plan', done: [0], session: null });
    s = ok(phoneOpen(s, 1));
    expect(s.clock).toBe(20 * 60);
    const check = sessionItems('equivalence', true);
    let last: Result = { ok: true, state: s };
    for (const item of check) {
      s = ok(phoneAnswer(s, item.correct));
      last = phoneNext(s);
      s = ok(last);
    }
    expect(last.ok && last.finishedCheck).toBe(true);
    expect(s.phone).toMatchObject({ screen: 'progress', done: [0, 1], lastDone: 'p1' });
    expect(s.clock).toBe(20 * 60 + 40);
    expect(s.plans[0].status).toBe('done');
    expect(ma(s).status).toBe('onTrack');
    expect(phoneOpen(s, 0).ok).toBe(false);
  });
  it('skip to tonight marks earlier sessions done with seeded results', () => {
    const s = ok(phoneSkip(ok(phoneShowPlan(sent()))));
    expect(s.phone.done).toEqual([0]);
    expect(s.clock).toBe(20 * 60);
    expect(ma(s).mastery.implication).toBeGreaterThan(0.31);
    expect(ma(s).evidence.filter((e) => e.kind === 'practice')).toHaveLength(2);
  });
});

describe('dates', () => {
  it('a follow-up keeps its own baseline, and opening it moves the story to its date', () => {
    const first = ok(approvePlan(stateWithPlan(), 'p1'));
    const s = structuredClone(first);
    s.students[16].mastery.equivalence = 0.65;
    const follow = planFor('pathway', { id: 'p2', day: 'Tomorrow', date: 41, status: 'autoApproved' });
    s.plans.push(follow);
    deliver(s, s.plans[1], true);
    expect(s.plans[1].baseline?.equivalence).toBe(0.65);
    expect(s.plans[0].baseline?.equivalence).toBe(0.35);
    const opened = ok(phoneOpen(s, 0));
    expect(opened.day).toBe(41);
    expect(opened.clock).toBe(15 * 60 + 30);
  });
});
