import { describe, expect, it } from 'vitest';
import { CARDS } from '../../scenario/cards';
import { ASSESSMENTS, CLOS, EXAM_DAY, START_DAY } from '../../scenario/course';
import { CONCEPTS } from '../../scenario/knowledgeGraph';
import { planFor } from '../fixtures';
import { seedState } from '../seed';
import type { DemoState, StudentProfile } from '../types';
import { applyCheck, capacityFor, capacityLeft, shortOfTime, teacherMinutes } from './capacity';
import { NEW_PER_DAY, cardsToday, reviewCard } from './cards';
import { bandOf, cloMastery, minutesNeeded, passEstimate } from './estimate';
import { markFor } from './marks';
import { ensureRecord, newRecord, noteAttempt } from './record';
import { SELF_SESSION, nextItem } from './select';
import { detectSignal, mayReplan, nextReplan } from './signals';
import { todayList } from './today';
import { BANK } from '../../scenario/practiceBank';

const student = (s: DemoState, id = 's17'): StudentProfile => s.students.find((x) => x.id === id)!;
const setAll = (st: StudentProfile, v: number) => { for (const c of CONCEPTS) st.mastery[c.id] = v; };
const setup = () => {
  const s = seedState();
  const rec = ensureRecord(s, 's17');
  rec.reported = { weekday: 30, weekend: 60 };
  s.phone.studentId = 's17';
  return { s, rec };
};

describe('card scheduling', () => {
  it('schedules a new card by rating', () => {
    expect(reviewCard(undefined, 'again', 40).due).toBe(41);
    expect(reviewCard(undefined, 'hard', 40).due).toBe(41);
    expect(reviewCard(undefined, 'good', 40).due).toBe(42);
    expect(reviewCard(undefined, 'easy', 40).due).toBe(44);
  });
  it('lengthens a reviewed card and shortens it on Again', () => {
    const first = reviewCard(undefined, 'good', 40);
    const second = reviewCard(first, 'good', 42);
    expect(second.interval).toBe(5);
    expect(second.due).toBe(47);
    const lapsed = reviewCard(second, 'again', 47);
    expect(lapsed.interval).toBe(1);
    expect(lapsed.ease).toBeCloseTo(2.3);
  });
  it('never lets ease fall below 1.3, and never schedules past the exam', () => {
    let c = reviewCard(undefined, 'hard', 40);
    for (let i = 0; i < 20; i++) c = reviewCard(c, 'hard', 41);
    expect(c.ease).toBe(1.3);
    const late = reviewCard({ interval: 30, ease: 2.5, due: 60, reps: 4, introduced: 40 }, 'easy', 60);
    expect(late.due).toBe(EXAM_DAY - 1);
  });
  it('serves due cards and at most 5 new cards a day from the focus', () => {
    const { rec } = setup();
    const first = cardsToday(rec, 40, ['implication', 'equivalence']);
    expect(first.fresh).toHaveLength(Math.min(NEW_PER_DAY, 8));
    expect(first.fresh.every((c) => ['implication', 'equivalence'].includes(c.concept))).toBe(true);
    rec.cards[CARDS[0].id] = reviewCard(undefined, 'good', 38);
    expect(cardsToday(rec, 40, []).due.map((c) => c.id)).toEqual([CARDS[0].id]);
    rec.cards[first.fresh[0].id] = reviewCard(undefined, 'good', 40);
    expect(cardsToday(rec, 40, ['implication', 'equivalence']).fresh).toHaveLength(NEW_PER_DAY - 1);
  });
});

describe('next question', () => {
  it('skips a concept whose prerequisite is too weak', () => {
    const { s, rec } = setup();
    const st = student(s);
    st.mastery.equivalence = 0.2;
    st.mastery.biconditional = 0.3;
    const item = nextItem(rec, st, 40, ['equivalence'], []);
    expect(item.concept).toBe('biconditional');
  });
  it('picks the weakest eligible concept at the student’s Bloom level', () => {
    const { s, rec } = setup();
    const st = student(s);
    st.mastery.negation = 0.9;
    st.mastery.conjunction = 0.5;
    rec.bloom.CLO1 = 2;
    const item = nextItem(rec, st, 40, ['negation', 'conjunction'], []);
    expect(item.concept).toBe('conjunction');
    expect(item.bloom).toBe('Apply');
  });
  it('does not repeat served or recent questions while others remain', () => {
    const { s, rec } = setup();
    const st = student(s);
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const item = nextItem(rec, st, 40, ['conjunction'], [...seen]);
      expect(seen.has(item.id)).toBe(false);
      seen.add(item.id);
    }
    expect(SELF_SESSION).toBe(5);
  });
  it('skips a question attempted within 3 days, and falls back to the oldest when all are recent', () => {
    const { s, rec } = setup();
    const st = student(s);
    const first = nextItem(rec, st, 40, ['conjunction'], []);
    rec.attempts.push({ itemId: first.id, day: 39, correct: true, firstTry: true });
    expect(nextItem(rec, st, 40, ['conjunction'], []).id).not.toBe(first.id);
    rec.attempts.length = 0;
    const ids = BANK.filter((i) => i.concept === 'conjunction').map((i) => i.id);
    const oldest = ids[2];
    ids.forEach((id) => rec.attempts.push({ itemId: id, day: id === oldest ? 38 : 39, correct: true, firstTry: true }));
    expect(nextItem(rec, st, 40, ['conjunction'], []).id).toBe(oldest);
  });
  it('moves up after two first-try answers and down after a wrong one', () => {
    const rec = newRecord(student(seedState()));
    rec.bloom.CLO1 = 0;
    const item = BANK.find((i) => i.clo === 'CLO1')!;
    noteAttempt(rec, item, 40, true, true);
    expect(rec.bloom.CLO1).toBe(0);
    noteAttempt(rec, item, 40, true, true);
    expect(rec.bloom.CLO1).toBe(1);
    noteAttempt(rec, item, 40, false, false);
    expect(rec.bloom.CLO1).toBe(0);
  });
});

describe('pass estimate', () => {
  it('weights CLO mastery by exam share and bands the score', () => {
    const { s, rec } = setup();
    const st = student(s);
    const est = passEstimate(st, rec, 40);
    const expected = CLOS.reduce((a, c) => a + c.share * cloMastery(st, c.id), 0) * 100;
    expect(Math.abs(est.score - expected)).toBeLessThanOrEqual(0.5);
    expect(est.band).toBe(bandOf(est.score));
    expect(bandOf(60)).toBe('Likely');
    expect(bandOf(59)).toBe('At risk');
    expect(bandOf(45)).toBe('At risk');
    expect(bandOf(44)).toBe('Unlikely');
  });
  it('counts planned study, capped at +0.20 mastery', () => {
    const { s, rec } = setup();
    const st = student(s);
    const plain = passEstimate(st, rec, 40).score;
    rec.plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [{ day: 41, minutes: 2000, clo: 'CLO1', concepts: [] }] };
    expect(passEstimate(st, rec, 40).score).toBeLessThanOrEqual(plain + 20.01);
    expect(passEstimate(st, rec, 40).score).toBeGreaterThan(plain);
  });
  it('counts 12 minutes per 0.1 of gap to 0.75, per concept', () => {
    const st = student(seedState());
    setAll(st, 0.75);
    expect(minutesNeeded(st)).toBe(0);
    st.mastery.implication = 0.35;
    expect(minutesNeeded(st)).toBe(48);
  });
});

describe('capacity', () => {
  it('starts from what was reported, by weekday or weekend', () => {
    const { rec } = setup();
    expect(capacityFor(rec, 42)).toBe(30);
    expect(capacityFor(rec, 40)).toBe(60);
  });
  it('then trusts what actually happens', () => {
    const { rec } = setup();
    for (const d of [39, 40, 41]) rec.days[d] = { planned: 30, done: 8, check: null };
    expect(capacityFor(rec, 42)).toBe(10);
  });
  it('judges future days by what has happened up to today', () => {
    const { rec } = setup();
    for (const d of [39, 40, 41]) rec.days[d] = { planned: 30, done: 8, check: null };
    expect(capacityFor(rec, 50, 42)).toBe(10);
    expect(capacityFor(rec, 50)).toBe(30);
  });
  it('takes a teacher’s sessions off the day', () => {
    const { s } = setup();
    s.plans.push(planFor('pathway', { status: 'sent', date: 42 }));
    expect(teacherMinutes(s, 's17')).toEqual({ 42: 18 });
    expect(capacityLeft(s, 's17', 42)).toBe(12);
    expect(capacityLeft(s, 's17', 43)).toBe(30);
  });
  it('knows when the time left cannot cover the gaps', () => {
    const { s, rec } = setup();
    expect(shortOfTime(s, 's17')).toBe(false);
    rec.reported = { weekday: 5, weekend: 5 };
    setAll(s.students[16], 0.1);
    expect(shortOfTime(s, 's17')).toBe(true);
  });
  it('adjusts with the end-of-day check, within limits', () => {
    expect(applyCheck(1, 'tooMuch')).toBeCloseTo(0.9);
    expect(applyCheck(1, 'tooLittle')).toBeCloseTo(1.1);
    expect(applyCheck(1, 'right')).toBe(1);
    expect(applyCheck(0.6, 'tooMuch')).toBe(0.6);
    expect(applyCheck(1.3, 'tooLittle')).toBe(1.3);
  });
});

describe('today', () => {
  it('lists cards then practice within the budget, and carries yesterday’s shortfall', () => {
    const { s, rec } = setup();
    rec.plan = { createdDay: 40, reason: 'r', leftOut: [], source: 'offline', days: [{ day: 40, minutes: 20, clo: 'CLO1', concepts: ['implication'] }, { day: 41, minutes: 20, clo: 'CLO2', concepts: ['equivalence'] }] };
    const first = todayList(s, 's17');
    expect(first.budget).toBe(20);
    expect(first.rows.map((r) => r.kind)).toEqual(['cards', 'practice']);
    rec.days[40] = { planned: 20, done: 5, check: null };
    s.day = 41;
    expect(todayList(s, 's17').budget).toBe(35);
  });
  it('keeps carry-over within the day’s capacity after teacher sessions', () => {
    const { s, rec } = setup();
    s.day = 42;
    rec.plan = { createdDay: 40, reason: 'r', leftOut: [], source: 'offline', days: [{ day: 42, minutes: 12, clo: 'CLO1', concepts: ['implication'] }] };
    s.plans.push(planFor('pathway', { status: 'sent', date: 42, studentIds: ['s17'] }));
    rec.days[41] = { planned: 30, done: 15, check: null };
    expect(todayList(s, 's17').budget).toBe(12);
  });
  it('caps carry at capacity even without teacher sessions', () => {
    const { s, rec } = setup();
    s.day = 42;
    rec.plan = { createdDay: 40, reason: 'r', leftOut: [], source: 'offline', days: [{ day: 42, minutes: 20, clo: 'CLO1', concepts: ['implication'] }] };
    rec.days[41] = { planned: 30, done: 0, check: null };
    expect(todayList(s, 's17').budget).toBe(30);
  });
  it('shows a student’s sent pathway for today whether or not the phone has a plan picked', () => {
    const { s } = setup();
    s.plans.push(planFor('pathway', { status: 'sent', date: 40, studentIds: ['s17'] }));
    expect(s.phone.planId).toBeNull();
    const plan = s.plans[s.plans.length - 1];
    expect(todayList(s, 's17').rows.filter((r) => r.kind === 'plan')).toHaveLength(plan.sessions.length);
    s.phone.done = [0];
    expect(todayList(s, 's17').rows.filter((r) => r.kind === 'plan')).toHaveLength(plan.sessions.length);
    s.phone.planId = plan.id;
    expect(todayList(s, 's17').rows.filter((r) => r.kind === 'plan')).toHaveLength(plan.sessions.length - 1);
  });
  it('keeps teacher-session minutes out of self-study', () => {
    const { s, rec } = setup();
    rec.plan = { createdDay: 40, reason: 'r', leftOut: [], source: 'offline', days: [{ day: 40, minutes: 20, clo: 'CLO1', concepts: ['implication'] }, { day: 41, minutes: 5, clo: 'CLO1', concepts: ['implication'] }] };
    const before = todayList(s, 's17').rows.find((r) => r.kind === 'practice')!;
    const item = BANK.find((i) => i.clo === 'CLO1')!;
    rec.days[40] = { planned: 20, done: 0, check: null };
    for (let i = 0; i < 5; i++) noteAttempt(rec, item, 40, true, true, true);
    expect(rec.days[40].done).toBe(7.5);
    const after = todayList(s, 's17');
    expect(after.done).toBe(0);
    expect(after.rows.find((r) => r.kind === 'practice')).toEqual(before);
    s.day = 41;
    expect(todayList(s, 's17').budget).toBe(25);
  });
  it('takes the practice row’s CLO from the plan and rounds its minutes up', () => {
    const { s, rec } = setup();
    rec.plan = { createdDay: 40, reason: 'r', leftOut: [], source: 'offline', days: [{ day: 40, minutes: 20, clo: 'CLO2', concepts: ['implication'] }] };
    rec.days[40] = { planned: 20, done: 0.5, check: null };
    const row = todayList(s, 's17').rows.find((r) => r.kind === 'practice')!;
    expect(row).toMatchObject({ clo: 'CLO2' });
    expect(Number.isInteger(row.minutes)).toBe(true);
  });
  it('puts today’s teacher sessions first', () => {
    const { s, rec } = setup();
    rec.plan = { createdDay: 40, reason: 'r', leftOut: [], source: 'offline', days: [{ day: 40, minutes: 20, clo: 'CLO1', concepts: ['implication'] }] };
    s.plans.push({ id: 'p1', kind: 'pathway', title: 'T', studentIds: ['s17'], day: 'Today', date: 40, baseline: null, rationale: '', outcome: '', status: 'sent', conversationId: 'c1', sessions: [{ time: '16:00', title: 'Review', minutes: 8, concept: 'implication', isMasteryCheck: false, studentId: null }] });
    s.phone.planId = 'p1';
    expect(todayList(s, 's17').rows[0]).toMatchObject({ kind: 'plan', index: 0, title: 'Review' });
  });
});

describe('marks', () => {
  it('generates a mark from mastery, deterministically', () => {
    const s = seedState();
    const quiz3 = ASSESSMENTS.find((a) => a.id === 'quiz3')!;
    expect(markFor(student(s), quiz3)).toBe(markFor(student(s), quiz3));
    expect(markFor(student(s), quiz3)).toBeGreaterThanOrEqual(0);
    expect(markFor(student(s), quiz3)).toBeLessThanOrEqual(100);
  });
  it('is mastery on the assessment’s CLOs plus an offset of -6 to +6', () => {
    const s = seedState();
    const st = student(s, 's1');
    setAll(st, 0.5);
    const quiz1 = ASSESSMENTS.find((a) => a.id === 'quiz1')!;
    expect(markFor(st, quiz1)).toBe(50 + (((st.index * 37 + 17 * 11) % 13) - 6));
    const offsets = new Set<number>();
    for (let i = 0; i < 40; i++) for (const a of ASSESSMENTS) {
      const probe = { ...st, index: i };
      setAll(probe, 0.5);
      offsets.add(markFor(probe, a) - 50);
    }
    expect(Math.min(...offsets)).toBe(-6);
    expect(Math.max(...offsets)).toBe(6);
  });
});

describe('replan signals', () => {
  const rec = () => setup().rec;

  it('fires on a mark swing of 15 points either way', () => {
    expect(detectSignal(rec(), 50, 'At risk', 40, 56)).toBe('markSwing');
    expect(detectSignal(rec(), 50, 'At risk', 75, 60)).toBe('markSwing');
    expect(detectSignal(rec(), 50, 'At risk', 50, 56)).toBeNull();
  });
  it('fires when the band changes', () => {
    const r = rec();
    r.band = 'Likely';
    expect(detectSignal(r, 50, 'At risk', null, null)).toBe('bandChange');
    expect(detectSignal(r, 50, 'Likely', null, null)).toBeNull();
  });
  it('fires after 3 days with no practice, not 2', () => {
    const r = rec();
    r.band = 'At risk';
    r.days[47] = { planned: 20, done: 10, check: null };
    r.days[48] = { planned: 20, done: 0, check: null };
    r.days[49] = { planned: 20, done: 0, check: null };
    expect(detectSignal(r, 50, 'At risk', null, null)).toBeNull();
    r.days[47].done = 0;
    expect(detectSignal(r, 50, 'At risk', null, null)).toBe('disengaged');
  });
  it('fires under 25% of planned minutes across 7 days', () => {
    const r = rec();
    r.band = 'At risk';
    for (let d = 43; d < 50; d++) r.days[d] = { planned: 20, done: d % 2 ? 6 : 1, check: null };
    expect(detectSignal(r, 50, 'At risk', null, null)).toBe('disengaged');
  });
  it('holds a cooldown of 5 story days, except for marks and teacher plans', () => {
    const r = rec();
    r.lastReplanDay = 48;
    expect(mayReplan(r, 'disengaged', 50)).toBe(false);
    expect(mayReplan(r, 'bandChange', 52)).toBe(false);
    expect(mayReplan(r, 'bandChange', 53)).toBe(true);
    expect(mayReplan(r, 'markSwing', 49)).toBe(true);
    expect(mayReplan(r, 'teacherPlan', 49)).toBe(true);
  });
  it('holds a signal through the cooldown, and drops it if it stops being true', () => {
    const r = rec();
    r.lastReplanDay = 48;
    expect(nextReplan(r, 'disengaged', 50)).toEqual({ run: null, hold: 'disengaged' });
    r.pendingSignal = 'disengaged';
    expect(nextReplan(r, null, 51)).toEqual({ run: null, hold: null });
    expect(nextReplan(r, 'disengaged', 53)).toEqual({ run: 'disengaged', hold: null });
  });
  it('keeps a mark swing or teacher plan that has not been acted on', () => {
    const r = rec();
    r.lastReplanDay = 48;
    r.pendingSignal = 'markSwing';
    expect(nextReplan(r, null, 49)).toEqual({ run: 'markSwing', hold: null });
  });
  it('stops replanning on exam day', () => {
    expect(nextReplan(rec(), 'markSwing', EXAM_DAY)).toEqual({ run: null, hold: null });
  });
});

describe('start', () => {
  it('uses the story start day', () => {
    expect(seedState().day).toBe(START_DAY);
  });
});
