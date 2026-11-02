import { describe, expect, it } from 'vitest';
import { CARDS } from '../../scenario/cards';
import { BANK } from '../../scenario/practiceBank';
import { planFor, playOut, stateWithPlan } from '../fixtures';
import { approvePlan, currentItems, deliver, phoneAgain, phoneAnswer, phoneContinue, phoneFinish, phoneGoto, phoneNext, phoneOpen, phoneShowPlan, type Result } from '../reducer';
import { seedState } from '../seed';
import type { DemoState } from '../types';
import { ensureRecord, noteAttempt } from './record';
import { advance, applyPlan, openCheckIn, openPick, pickStudent, rateCard, saveSetup, showTab, simulateDrop, startSelf, type StudyResult } from './reducer';
import { capacityFor, capacityLeft } from './capacity';
import { ASSESSMENTS } from '../../scenario/course';
import { markFor } from './marks';
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
  it('serves 5 adaptive questions, opens the review and returns to Today', () => {
    let s = ok(startSelf(ready(), 'CLO1'));
    expect(s.phone).toMatchObject({ screen: 'practice', session: null, item: 0 });
    s = ok(playOut(s));
    expect(s.phone).toMatchObject({ screen: 'review', self: null, reviewNext: 'today' });
    expect(s.phone.sheet).toHaveLength(5);
    s = ok(phoneContinue(s));
    expect(s.phone).toMatchObject({ screen: 'today', self: null, sheet: [] });
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
  it('records a forecast point when a plan lands and at each day’s close', () => {
    const s = structuredClone(ready());
    applyPlan(s, 's17', { createdDay: 40, reason: 'Lighter for now.', leftOut: [], source: 'offline', days: [] }, 'disengaged');
    expect(s.study.s17.forecasts.map((p) => p.day)).toEqual([40]);
    const r = advance(s, 2, null);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.study.s17.forecasts.map((p) => p.day)).toEqual([40, 41, 42]);
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
    noteAttempt(s.study.s17, BANK[0], s.day, true, 1, true);
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

describe('review follow-ups', () => {
  const join = (id: string, setup: boolean) => {
    let s = ok(pickStudent(ok(openPick(seedState())), id));
    if (setup) s = ok(saveSetup(s, 30, 60));
    return s;
  };
  const followUp = (s: DemoState) => {
    s.plans.push(planFor('pathway', { id: 'p2', status: 'autoApproved', studentIds: ['s17'], date: s.day }));
    const plan = s.plans[s.plans.length - 1];
    deliver(s, plan, true);
    return plan;
  };

  it('a follow-up for another student leaves a self session alone and waits', () => {
    const s = structuredClone(ok(startSelf(join('s8', true), 'CLO1')));
    const before = structuredClone(s.phone);
    const plan = followUp(s);
    expect(s.phone).toEqual(before);
    expect(plan.baseline).not.toBeNull();
    expect(ok(pickStudent(s, 's17')).phone).toMatchObject({ studentId: 's17', planId: 'p2' });
  });
  it('a follow-up for another student leaves setup and Today alone', () => {
    for (const setup of [false, true]) {
      const s = structuredClone(join('s8', setup));
      const before = structuredClone(s.phone);
      followUp(s);
      expect(s.phone).toEqual(before);
    }
  });
  it('a follow-up still reaches a phone with no student', () => {
    const s = seedState();
    followUp(s);
    expect(s.phone).toMatchObject({ planId: 'p2', studentId: 's17', updated: true });
  });

  it('a mark swing survives a long jump', () => {
    const s = ok(saveSetup(ok(pickStudent(seedState(), 's4')), 30, 60));
    s.day = 46;
    const next = advance(s, 7, null);
    expect(next.ok && next.signal).toBe('markSwing');
  });

  it('opening a teacher session clears a self session', () => {
    const s = ok(startSelf(ready(), 'CLO1'));
    s.plans.push(planFor('pathway', { id: 'p2', status: 'sent', studentIds: ['s17'] }));
    s.phone.planId = 'p2';
    expect(ok(phoneOpen(s, 0)).phone.self).toBeNull();
    expect(ok(phoneShowPlan(s)).phone.self).toBeNull();
  });
  it('Finish before every slot is opened goes to the first open slot', () => {
    let s = ok(startSelf(ready(), 'CLO1'));
    s = ok(phoneAnswer(s, currentItems(s)[0].correct));
    s = ok(phoneFinish(s));
    expect(s.phone).toMatchObject({ screen: 'practice', item: 1 });
    expect(s.phone.sheet).toHaveLength(2);
  });
  it('a skipped slot picks one question and keeps it', () => {
    let s = ok(startSelf(ready(), 'CLO1'));
    expect(s.phone.sheet).toHaveLength(1);
    s = ok(phoneNext(s));
    const picked = s.phone.sheet[1].itemId;
    expect(s.phone.self?.served).toEqual(s.phone.sheet.map((q) => q.itemId));
    s = ok(phoneNext(ok(phoneGoto(s, 0))));
    expect(s.phone.sheet[1].itemId).toBe(picked);
    expect(s.phone.sheet).toHaveLength(2);
  });
  it('a jump by dot picks the slots it passes, in order', () => {
    const s = ok(phoneGoto(ok(startSelf(ready(), 'CLO1')), 3));
    expect(s.phone.item).toBe(3);
    expect(s.phone.sheet).toHaveLength(4);
    expect(new Set(s.phone.self?.served).size).toBe(4);
    expect(phoneGoto(s, 5)).toEqual({ ok: false, error: 'No such question.' });
  });
  it('a repeat tap counts once and logs no minutes; a re-answer logs its minutes and moves no Bloom level', () => {
    let s = ok(startSelf(ready(), 'CLO1'));
    const item = currentItems(s)[0];
    const wrong = item.correct === 0 ? 1 : 0;
    const level = s.study.s17.bloom.CLO1;
    s = ok(phoneAnswer(s, wrong));
    expect(s.study.s17.days[40].done).toBe(1.5);
    expect(phoneAnswer(s, wrong).ok).toBe(false);
    s = ok(phoneAnswer(s, item.correct));
    expect(s.study.s17.days[40].done).toBe(3);
    expect(s.study.s17.attempts).toEqual([{ itemId: item.id, day: 40, correct: true, firstTry: false, tries: 2 }]);
    const after = s.study.s17.bloom.CLO1;
    expect(after).toBe(Math.max(0, level - 1));
    s = ok(phoneAnswer(ok(phoneAgain(s)), wrong));
    expect(s.study.s17.days[40].done).toBe(4.5);
    expect(s.study.s17.attempts).toHaveLength(1);
    expect(s.study.s17.bloom.CLO1).toBe(after);
  });
  it('opening Pick or the check-in clears a self session', () => {
    const s = ok(startSelf(ready(), 'CLO1'));
    expect(ok(openPick(s)).phone).toMatchObject({ self: null, sheet: [] });
    expect(ok(openCheckIn(s)).phone).toMatchObject({ self: null, sheet: [] });
  });
  it('a fresh teacher approval during a self session goes to the lock screen and keeps the answers', () => {
    let s = ok(startSelf(ready(), 'CLO1'));
    s = ok(phoneAnswer(s, currentItems(s)[0].correct));
    const logged = s.study.s17.attempts.length;
    expect(logged).toBe(1);
    s.plans.push(planFor('pathway', { id: 'p2', studentIds: ['s17'] }));
    const sent = ok(approvePlan(s, 'p2'));
    expect(sent.phone).toMatchObject({ screen: 'lock', self: null, sheet: [] });
    expect(sent.study.s17.attempts).toHaveLength(logged);
  });
  it('advancing during a self session ends it', () => {
    const started = ok(startSelf(ready(), 'CLO1'));
    const answered = ok(phoneAnswer(started, currentItems(started)[0].correct));
    const s = ok(advance(answered, 1, null));
    expect(s.phone).toMatchObject({ self: null, session: null, screen: 'lock', sheet: [] });
    expect(s.study.s17.attempts).toHaveLength(1);
  });

  it('simulate drop twice leaves one Quiz 3 mark', () => {
    const s = ok(simulateDrop(ok(simulateDrop(ready()))));
    expect(s.study.s17.marks.filter((m) => m.assessment === 'quiz3')).toHaveLength(1);
  });
});

describe('the simulated Quiz 3', () => {
  it('two clicks give the same mark, dated on Quiz 3 day', () => {
    const once = ok(simulateDrop(ready())).study.s17.marks.find((m) => m.assessment === 'quiz3')!;
    const twice = ok(simulateDrop(ok(simulateDrop(ready())))).study.s17.marks.find((m) => m.assessment === 'quiz3')!;
    expect(twice.mark).toBe(once.mark);
    expect(once.day).toBe(52);
  });
  it('a drop on day 41 then advancing past day 46 raises no second markSwing from Assignment 2', () => {
    const s = ready();
    s.day = 41;
    const dropped = ok(simulateDrop(s));
    const q2 = dropped.students.find((x) => x.id === 's17')!.quiz.q2;
    const r = advance(dropped, 6, null);
    // Monday 42 forgot a little, so the mark comes from the student as they are after it.
    const a2 = markFor(r.ok ? r.state.students.find((x) => x.id === 's17')! : dropped.students[16], ASSESSMENTS.find((a) => a.id === 'a2')!);
    expect(r.ok && r.state.study.s17.marks.find((m) => m.assessment === 'a2')?.mark).toBe(a2);
    expect(Math.abs(a2 - q2) > 15).toBe(false);
    expect(r.ok && r.signal).not.toBe('markSwing');
  });
});

describe('picking a student chooses the plan for today', () => {
  it('prefers the plan dated today over a newer one dated later', () => {
    const s = seedState();
    s.plans.push(planFor('pathway', { id: 'pa', status: 'sent', date: s.day, studentIds: ['s17'] }));
    s.plans.push(planFor('pathway', { id: 'pb', status: 'sent', date: s.day + 1, studentIds: ['s17'] }));
    expect(ok(pickStudent(s, 's17')).phone.planId).toBe('pa');
  });
});

describe('an overdue teacher session stays on Today', () => {
  const overdue = () => {
    const s = ok(approvePlan(stateWithPlan(), 'p1'));
    ensureRecord(s, 's17').reported = { weekday: 60, weekend: 60 };
    s.study.s17.plan = planned(ready()).study.s17.plan;
    s.plans[0].date = 40;
    s.day = 40;
    return s;
  };
  it('shows its rows and opens, once its date has passed, without taking capacity', () => {
    const s = { ...overdue(), day: 41 };
    expect(todayList(s, 's17').rows.some((r) => r.kind === 'plan')).toBe(true);
    const minutes = s.plans[0].sessions.reduce((a, x) => a + x.minutes, 0);
    expect(minutes).toBeGreaterThan(0);
    expect(capacityLeft(s, 's17', 41)).toBe(capacityFor(s.study.s17, 41, 41));
    expect(ok(phoneOpen(s, 0)).phone.screen).toBe('practice');
  });
  it('a 33-minute plan ignored for three days leaves the budget unchanged and its rows on Today', () => {
    const s = overdue();
    s.plans[0].sessions = [{ ...s.plans[0].sessions[0], minutes: 33 }];
    const before = capacityLeft(s, 's17', 40);
    s.day = 43;
    const day = s.study.s17.plan!.days.find((d) => d.day === 43)!;
    expect(capacityLeft(s, 's17', 43)).toBe(capacityFor(s.study.s17, 43, 43));
    expect(capacityLeft(s, 's17', 43)).toBeGreaterThanOrEqual(Math.min(before, day.minutes));
    expect(todayList(s, 's17').budget).toBe(Math.min(capacityFor(s.study.s17, 43, 43), day.minutes));
    expect(todayList(s, 's17').rows.some((r) => r.kind === 'plan')).toBe(true);
  });
  it('picking prefers the newest plan dated today or earlier over a later one', () => {
    const s = seedState();
    s.day = 41;
    s.plans.push(planFor('pathway', { id: 'pa', status: 'sent', date: 40, studentIds: ['s17'] }));
    s.plans.push(planFor('pathway', { id: 'pb', status: 'sent', date: 42, studentIds: ['s17'] }));
    expect(ok(pickStudent(s, 's17')).phone.planId).toBe('pa');
  });
  it('a plan dated tomorrow does not show today', () => {
    const s = overdue();
    s.plans[0].date = 41;
    expect(todayList(s, 's17').rows.some((r) => r.kind === 'plan')).toBe(false);
  });
});

describe('Today budget', () => {
  it('is a whole number of minutes even with a carry', () => {
    const s = ready();
    s.study.s17.days[39] = { planned: 20, done: 2.5, check: null };
    s.day = 40;
    const { budget } = todayList(s, 's17');
    expect(Number.isInteger(budget)).toBe(true);
  });
});

describe('a new week', () => {
  const item = (concept: string) => BANK.find((i) => i.concept === concept)!;
  it('a Monday forgets once, then re-picks the week from the lectures', () => {
    const s = structuredClone(ready());
    Object.assign(s.students[16].mastery, { implication: 0.3, biconditional: 0.29, expressions: 0.295 });
    s.study.s17.attempts.push({ itemId: item('biconditional').id, day: 41, correct: true, firstTry: true, tries: 1 });
    const after = ok(advance(s, 7, null)); // Saturday 40 → Saturday 47, through Monday 42
    expect(after.students[16].mastery).toMatchObject({ negation: 0.68, implication: 0.28, biconditional: 0.29, expressions: 0.275 });
    const plan = after.study.s17.plan!;
    // Forgetting first: implication and expressions are now the two weakest; before it, biconditional was.
    expect(plan.days.find((d) => d.day === 42)?.concepts).toEqual(['implication', 'expressions']);
    expect(plan.days.find((d) => d.day === 49)?.concepts).toEqual(['implication']);
    expect(plan.days.map((d) => d.minutes)).toEqual(s.study.s17.plan!.days.map((d) => d.minutes));
    expect(plan.reason).toBe('r');
    expect(after.study.s17.replans).toEqual(s.study.s17.replans);
  });
  it('a day that is not a Monday neither forgets nor re-picks', () => {
    const s = ready();
    const after = ok(advance(s, 1, null)); // Saturday 40 → Sunday 41
    expect(after.students[16].mastery).toEqual(s.students[16].mastery);
    expect(after.study.s17.plan).toEqual(s.study.s17.plan);
  });
  it('forgets for every student who has set up and leaves the rest alone, even one who was only tapped', () => {
    const s = structuredClone(ready());
    ensureRecord(s, 's29').reported = { weekday: 30, weekend: 60 };
    ensureRecord(s, 's30');
    const after = ok(advance(s, 2, null)); // reaches Monday 42
    const of = (st: DemoState, id: string) => st.students.find((x) => x.id === id)!.mastery;
    expect(of(after, 's29')).toMatchObject({ propositions: 0.5, implication: 0.24 });
    expect(of(after, 's2')).toEqual(of(s, 's2'));
    expect(of(after, 's30')).toEqual(of(s, 's30'));
  });
});
