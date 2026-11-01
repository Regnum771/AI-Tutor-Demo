import { describe, expect, it } from 'vitest';
import { planFor, playOut, stateWithPlan } from './fixtures';
import { afterAnswer } from './mastery';
import {
  approvePlan, currentItems, deliver, dismissPlan, editPlan, phoneAgain, phoneAnswer, phoneContinue, phoneFinish, phoneGoto, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, slotCount, type Result,
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
    expect(s.phone.sheet[0]).toMatchObject({ tries: [0], rightOn: null });
    expect(ma(s).mastery.implication).toBe(0.31);
    s = ok(phoneAnswer(s, 1));
    expect(s.phone.sheet[0]).toMatchObject({ tries: [0, 1], rightOn: 2 });
    expect(ma(s).mastery.implication).toBe(afterAnswer(0.31, true, 2));
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
  it('opening a session fills the sheet with every question', () => {
    const s = ok(phoneOpen(sent(), 0));
    expect(s.phone.sheet.map((q) => q.itemId)).toEqual(['implication-1', 'implication-2']);
    expect(s.phone.sheet[0]).toEqual({ itemId: 'implication-1', tries: [], rightOn: null, reopened: false });
    expect(slotCount(s)).toBe(2);
  });
  it('the sheet survives going back and forth, in any order', () => {
    let s = ok(phoneOpen(sent(), 0));
    s = ok(phoneAnswer(s, 0));
    s = ok(phoneNext(s));
    expect(s.phone.item).toBe(1);
    const second = currentItems(s)[1];
    s = ok(phoneAnswer(s, second.correct));
    s = ok(phoneGoto(s, 0));
    expect(s.phone.item).toBe(0);
    expect(s.phone.sheet[0].tries).toEqual([0]);
    expect(s.phone.sheet[1].rightOn).toBe(1);
  });
  it('goes only to slots of the open session', () => {
    expect(phoneGoto(sent(), 0)).toEqual({ ok: false, error: 'No practice open.' });
    const s = ok(phoneOpen(sent(), 0));
    expect(phoneGoto(s, 2)).toEqual({ ok: false, error: 'No such question.' });
    expect(phoneGoto(s, -1).ok).toBe(false);
    expect(phoneGoto(s, 0.5).ok).toBe(false);
  });
  it('a third try earns 5%, a fourth nothing, and the evidence says which try', () => {
    let s = ok(phoneOpen(sent(), 0));
    const item = currentItems(s)[0];
    const wrongs = item.options.map((_, i) => i).filter((i) => i !== item.correct);
    s = ok(phoneAnswer(ok(phoneAnswer(s, wrongs[0])), wrongs[1]));
    s = ok(phoneAnswer(s, item.correct));
    expect(ma(s).mastery.implication).toBe(afterAnswer(0.31, true, 3));
    expect(ma(s).evidence.at(-1)).toMatchObject({ result: 'correct', tries: 3, planId: 'p1' });
    expect(ma(s).evidence.at(-1)?.text).toContain('correct on try 3');
    let later = ok(phoneOpen(sent(), 0));
    for (const o of [wrongs[0], wrongs[1], wrongs[2]]) later = ok(phoneAnswer(later, o));
    later = ok(phoneAnswer(later, item.correct));
    expect(ma(later).mastery.implication).toBe(0.31);
    expect(later.phone.sheet[0].rightOn).toBe(4);
  });
  it('Answer again clears the options and earns no more credit, right or wrong', () => {
    let s = ok(phoneOpen(sent(), 0));
    const item = currentItems(s)[0];
    const wrong = item.correct === 0 ? 1 : 0;
    expect(phoneAgain(s)).toEqual({ ok: false, error: 'Answer the item first.' });
    s = ok(phoneAnswer(s, item.correct));
    const gained = ma(s).mastery.implication;
    expect(phoneAnswer(s, wrong)).toEqual({ ok: false, error: 'Already answered.' });
    s = ok(phoneAgain(s));
    expect(s.phone.sheet[0].reopened).toBe(true);
    s = ok(phoneAnswer(s, wrong));
    expect(s.phone.sheet[0]).toEqual({ itemId: item.id, tries: [item.correct, wrong], rightOn: 1, reopened: false });
    expect(ma(s).evidence.at(-1)).toMatchObject({ kind: 'practice', planId: 'p1' });
    expect(ma(s).evidence.at(-1)?.result).toBeUndefined();
    expect(ma(s).evidence.at(-1)?.text).toContain('answered again');
    s = ok(phoneAnswer(ok(phoneAgain(s)), item.correct));
    expect(s.phone.sheet[0].rightOn).toBe(1);
    expect(ma(s).mastery.implication).toBe(gained);
  });
  it('choosing the same option after Answer again adds nothing', () => {
    let s = ok(phoneOpen(sent(), 0));
    const item = currentItems(s)[0];
    s = ok(phoneAgain(ok(phoneAnswer(s, item.correct))));
    const rows = ma(s).evidence.length;
    s = ok(phoneAnswer(s, item.correct));
    expect(s.phone.sheet[0]).toMatchObject({ tries: [item.correct], reopened: false });
    expect(ma(s).evidence).toHaveLength(rows);
  });
  it('Finish with open questions moves to the first of them and keeps the sheet', () => {
    let s = ok(phoneOpen(sent(), 0));
    s = ok(phoneNext(s));
    s = ok(phoneAnswer(s, currentItems(s)[1].correct));
    s = ok(phoneFinish(s));
    expect(s.phone).toMatchObject({ screen: 'practice', item: 0, session: 0 });
    expect(s.phone.sheet[1].rightOn).toBe(1);
    expect(s.phone.done).toEqual([]);
  });
  it('Finish fails only outside a session; Next stops at the last question', () => {
    expect(phoneFinish(sent())).toEqual({ ok: false, error: 'No practice open.' });
    const s = ok(phoneNext(ok(phoneOpen(sent(), 0))));
    expect(phoneNext(s)).toEqual({ ok: false, error: 'No such question.' });
  });
  it('finishing a practice session opens the review, then the plan; finishing the check reports it', () => {
    let s = ok(playOut(ok(phoneOpen(sent(), 0))));
    expect(s.phone).toMatchObject({ screen: 'review', done: [0], session: null, reviewNext: 'plan' });
    expect(s.phone.sheet).toHaveLength(2);
    s = ok(phoneContinue(s));
    expect(s.phone).toMatchObject({ screen: 'plan', done: [0], session: null, sheet: [], reviewNext: null });
    s = ok(phoneOpen(s, 1));
    expect(s.clock).toBe(20 * 60);
    const last = playOut(s);
    s = ok(last);
    expect(last.ok && last.finishedCheck).toBe(true);
    expect(s.phone).toMatchObject({ screen: 'review', done: [0, 1], lastDone: 'p1', reviewNext: 'progress' });
    expect(s.clock).toBe(20 * 60 + 40);
    expect(s.plans[0].status).toBe('done');
    expect(ma(s).status).toBe('onTrack');
    expect(phoneOpen(s, 0).ok).toBe(false);
    expect(ok(phoneContinue(s)).phone.screen).toBe('progress');
    expect(phoneContinue(sent())).toEqual({ ok: false, error: 'No review open.' });
  });
  it('a follow-up landing on the review keeps it, and Continue still goes to progress', () => {
    const s = ok(playOut(ok(phoneOpen(sent(), 1))));
    s.plans.push(planFor('pathway', { id: 'p2', status: 'autoApproved' }));
    deliver(s, s.plans[1], true);
    expect(s.phone).toMatchObject({ screen: 'review', planId: 'p2', updated: true, reviewNext: 'progress', lastDone: 'p1' });
    expect(s.phone.sheet).toHaveLength(3);
    expect(ok(phoneContinue(s)).phone).toMatchObject({ screen: 'progress', planId: 'p2', sheet: [] });
  });
  it('skip to tonight marks earlier sessions done with seeded results', () => {
    const s = ok(phoneSkip(ok(phoneShowPlan(sent()))));
    expect(s.phone.done).toEqual([0]);
    expect(s.clock).toBe(20 * 60);
    expect(ma(s).mastery.implication).toBeGreaterThan(0.31);
    expect(ma(s).evidence.filter((e) => e.kind === 'practice')).toHaveLength(2);
  });
});

describe('the story stops at the exam', () => {
  it('opening a session dated past the exam day lands on the exam day', () => {
    const s = ok(approvePlan(stateWithPlan(), 'p1'));
    s.plans[0].date = 67;
    expect(ok(phoneOpen(s, 0)).day).toBe(64);
  });
  it('a second open on the exam day keeps the clock', () => {
    const s = ok(approvePlan(stateWithPlan(), 'p1'));
    s.plans[0].date = 67;
    const first = ok(phoneOpen(s, 0));
    first.clock = 10 * 60;
    const again = ok(phoneOpen(first, 0));
    expect(again.day).toBe(64);
    expect(again.clock).toBe(10 * 60);
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
