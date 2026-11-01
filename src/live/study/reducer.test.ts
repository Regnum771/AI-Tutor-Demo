import { describe, expect, it } from 'vitest';
import { CARDS } from '../../scenario/cards';
import { BANK } from '../../scenario/practiceBank';
import { planFor, stateWithPlan } from '../fixtures';
import { approvePlan, currentItems, deliver, phoneAnswer, phoneNext, type Result } from '../reducer';
import { seedState } from '../seed';
import type { DemoState } from '../types';
import { ensureRecord, noteAttempt } from './record';
import { advance, applyPlan, openCheckIn, openPick, pickStudent, rateCard, saveSetup, showTab, simulateDrop, startSelf, type StudyResult } from './reducer';
import { todayList } from './today';

const ok = (r: Result | StudyResult): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const planned = (s: DemoState) => {
  s.study.s17.plan = {
    createdDay: 40, reason: 'r', leftOut: [], source: 'offline',
    days: Array.from({ length: 24 }, (_, i) => ({ day: 40 + i, minutes: 20, clo: 'CLO1' as const, concepts: ['implication' as const] })),
  };
  return s;
};
const ready = () => planned(ok(saveSetup(ok(pickStudent(ok(openPick(seedState())), 's17')), 30, 60)));

describe('joining', () => {
  it('moves from pick to setup to today', () => {
    const picked = ok(pickStudent(ok(openPick(seedState())), 's17'));
    expect(picked.phone).toMatchObject({ screen: 'setup', studentId: 's17' });
    expect(picked.study.s17.reported).toBeNull();
    const set = ok(saveSetup(picked, 30, 60));
    expect(set.phone.screen).toBe('today');
    expect(set.study.s17.reported).toEqual({ weekday: 30, weekend: 60 });
  });
  it('rejects an unknown student and impossible minutes', () => {
    expect(pickStudent(seedState(), 's99').ok).toBe(false);
    const picked = ok(pickStudent(seedState(), 's17'));
    expect(saveSetup(picked, 0, 60).ok).toBe(false);
    expect(saveSetup(picked, 30, 500).ok).toBe(false);
  });
  it('a returning student skips setup', () => {
    const s = ready();
    expect(ok(pickStudent(s, 's17')).phone.screen).toBe('today');
  });
});

describe('self practice', () => {
  it('serves 5 adaptive questions and returns to Today', () => {
    let s = ok(startSelf(ready(), 'CLO1'));
    expect(s.phone).toMatchObject({ screen: 'practice', session: null, item: 0 });
    for (let n = 0; n < 5; n++) {
      const item = currentItems(s)[s.phone.item];
      expect(item).toBeDefined();
      s = ok(phoneAnswer(s, item.correct));
      s = ok(phoneNext(s));
    }
    expect(s.phone).toMatchObject({ screen: 'today', self: null });
    expect(new Set(s.study.s17.attempts.map((a) => a.itemId)).size).toBe(5);
    expect(s.study.s17.days[40].done).toBe(7.5);
    expect(s.students[16].evidence.filter((e) => e.kind === 'practice')).toHaveLength(5);
  });
  it('practises the day’s focus when no CLO is chosen', () => {
    const s = ok(startSelf(ready(), null));
    expect(s.phone.self?.concepts).toEqual(['implication']);
  });
  it('rejects a CLO that does not exist', () => {
    expect(startSelf(ready(), 'CLO9' as 'CLO1').ok).toBe(false);
  });
  it('a follow-up plan arriving mid-session does not interrupt it', () => {
    const s = structuredClone(ok(startSelf(ready(), 'CLO1')));
    s.plans.push(planFor('pathway', { id: 'p2', status: 'autoApproved' }));
    deliver(s, s.plans[0], true);
    expect(s.phone).toMatchObject({ screen: 'practice', planId: 'p2', updated: true });
    expect(s.phone.self).not.toBeNull();
    expect(currentItems(s)).toHaveLength(1);
  });
});

describe('cards', () => {
  it('schedules a rated card, logs the time and nudges mastery only on Good or Easy', () => {
    const card = CARDS.find((c) => c.concept === 'implication')!;
    const before = ready().students[16].mastery.implication;
    const good = ok(rateCard(ready(), card.id, 'good'));
    expect(good.study.s17.cards[card.id].due).toBe(42);
    expect(good.study.s17.days[40].done).toBe(0.5);
    expect(good.students[16].mastery.implication).toBeGreaterThan(before);
    expect(ok(rateCard(ready(), card.id, 'again')).students[16].mastery.implication).toBe(before);
    expect(rateCard(ready(), 'nope', 'good').ok).toBe(false);
    expect(rateCard(ready(), card.id, 'perfect' as 'good').ok).toBe(false);
  });
});

describe('moving through days', () => {
  it('Next day closes the day, applies the check and lands on the morning lock screen', () => {
    const r = advance(ok(openCheckIn(ready())), 1, 'tooMuch');
    const s = ok(r);
    expect(s.day).toBe(41);
    expect(s.clock).toBe(7 * 60 + 30);
    expect(s.phone).toMatchObject({ screen: 'lock', morning: true });
    expect(s.study.s17.feel).toBeCloseTo(0.9);
    expect(s.study.s17.days[40]).toMatchObject({ planned: 20, done: 0, check: 'tooMuch' });
  });
  it('passing an assessment generates its mark', () => {
    const s = ok(advance(ready(), 7, null));
    expect(s.day).toBe(47);
    expect(s.study.s17.marks.map((m) => m.assessment)).toEqual(['a2']);
  });
  it('a date jumped over by a teacher session still gets its mark, once', () => {
    const s = ready();
    s.day = 47;
    const after = ok(advance(s, 1, null));
    expect(after.study.s17.marks.map((m) => m.assessment)).toEqual(['a2']);
    expect(ok(advance(after, 1, null)).study.s17.marks).toHaveLength(1);
  });
  it('a skipped stretch raises disengagement, and small misses raise nothing', () => {
    const skipped = advance(ready(), 7, null);
    expect(skipped.ok && skipped.signal).toBe('disengaged');
    const small = advance(ready(), 1, null);
    expect(small.ok && small.signal).toBeNull();
  });
  it('stops at the exam', () => {
    const s = ok(advance(ready(), 60, null));
    expect(s.day).toBe(64);
    expect(advance(s, 1, null).ok).toBe(false);
  });
  it('needs a student who has set up, and a real check', () => {
    expect(advance(seedState(), 1, null).ok).toBe(false);
    expect(advance(ready(), 1, 'whatever' as 'right').ok).toBe(false);
  });
});

describe('a finished plan', () => {
  it('replaces the plan, sets the band and logs why', () => {
    const s = structuredClone(ready());
    s.study.s17.planning = { steps: [] };
    applyPlan(s, 's17', { createdDay: 40, reason: 'Lighter for now.', leftOut: [], source: 'offline', days: [] }, 'disengaged');
    expect(s.study.s17).toMatchObject({ planning: null, lastReplanDay: 40, band: 'At risk' });
    expect(s.study.s17.plan?.reason).toBe('Lighter for now.');
    expect(s.study.s17.replans).toEqual([{ day: 40, signal: 'disengaged', reason: 'Lighter for now.' }]);
  });
});

describe('teacher plans stay intact', () => {
  it('a plan switches the phone to that student and keeps working', () => {
    const s = stateWithPlan();
    s.phone.studentId = 's8';
    const sent = ok(approvePlan(s, 'p1'));
    expect(sent.phone).toMatchObject({ studentId: 's17', screen: 'lock', planId: 'p1', morning: false });
  });
});

describe('a returning student', () => {
  it('keeps a teacher session on Today after picking again', () => {
    const s = ok(approvePlan(stateWithPlan(), 'p1'));
    ensureRecord(s, 's17').reported = { weekday: 30, weekend: 30 };
    s.plans[0].date = s.day;
    const again = ok(pickStudent(s, 's17'));
    expect(again.phone.planId).toBe('p1');
    expect(todayList(again, 's17').rows.some((r) => r.kind === 'plan')).toBe(true);
  });
  it('counts teacher session answers apart from self-study', () => {
    const s = ok(approvePlan(stateWithPlan(), 'p1'));
    ensureRecord(s, 's17').reported = { weekday: 30, weekend: 30 };
    noteAttempt(s.study.s17, BANK[0], s.day, true, true, true);
    expect(s.study.s17.days[s.day]).toMatchObject({ done: 1.5, teacher: 1.5 });
    expect(todayList(s, 's17').done).toBe(0);
  });
});

describe('simulate a drop', () => {
  it('sets Quiz 3 20 points below the last mark and raises a mark swing', () => {
    const r = simulateDrop(ready());
    const s = ok(r);
    expect(r.ok && r.signal).toBe('markSwing');
    expect(s.study.s17.marks.at(-1)).toMatchObject({ assessment: 'quiz3', mark: 22 });
  });
  it('needs an active student', () => {
    expect(simulateDrop(seedState()).ok).toBe(false);
  });
});

describe('tabs', () => {
  it('switches between study screens only', () => {
    expect(ok(showTab(ready(), 'semester')).phone.screen).toBe('semester');
    expect(ok(showTab(ready(), 'cards')).phone.screen).toBe('cards');
    expect(showTab(ready(), 'plan' as 'cards').ok).toBe(false);
  });
  it('sends a student who has only had teacher plans to setup', () => {
    const s = ok(approvePlan(stateWithPlan(), 'p1'));
    expect(ok(showTab(s, 'today')).phone).toMatchObject({ screen: 'setup', planId: 'p1' });
  });
});
