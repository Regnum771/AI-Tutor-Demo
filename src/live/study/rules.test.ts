import { describe, expect, it } from 'vitest';
import { CARDS } from '../../scenario/cards';
import { ASSESSMENTS, CLOS, EXAM_DAY, START_DAY, taughtBy, type CloId } from '../../scenario/course';
import { CONCEPTS, EDGES, type ConceptId } from '../../scenario/knowledgeGraph';
import { planFor } from '../fixtures';
import { seedState } from '../seed';
import type { DemoState, StudentProfile, StudyPlan } from '../types';
import { applyCheck, capacityFor, capacityLeft, shortOfTime, teacherMinutes } from './capacity';
import { NEW_PER_DAY, cardsToday, reviewCard } from './cards';
import { bandOf, cloMastery, forecast, forecastSeries, minutesNeeded, projection } from './estimate';
import { forget } from './forgetting';
import { markFor } from './marks';
import { ensureRecord, newRecord, noteAttempt, noteForecast } from './record';
import { refocus } from './refocus';
import { SELF_SESSION, nextItem } from './select';
import { detectSignal, mayReplan, nextReplan, stoppedPractising, stoppedSince } from './signals';
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

describe('forecast', () => {
  it('weights mastery by exam share and blends in the latest mark, on 0–10', () => {
    const { s, rec } = setup();
    const st = student(s);
    const m = CLOS.reduce((a, c) => a + c.share * cloMastery(st, c.id), 0);
    expect(forecast(st, rec).value).toBeCloseTo(Math.round((6 * m + st.quiz.q2 / 25) * 10) / 10, 5);
    expect(forecast(st, rec)).toEqual({ value: 4.4, band: 'At risk' });
  });
  it('bands at 3.5 and 5.0', () => {
    expect(bandOf(5)).toBe('Likely');
    expect(bandOf(4.9)).toBe('At risk');
    expect(bandOf(3.5)).toBe('At risk');
    expect(bandOf(3.4)).toBe('Unlikely');
  });
  it('a plan alone never moves the forecast; a lower mark does', () => {
    const { s, rec } = setup();
    const st = student(s);
    const before = forecast(st, rec).value;
    rec.plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [{ day: 41, minutes: 2000, clo: 'CLO1', concepts: [] }] };
    expect(forecast(st, rec).value).toBe(before);
    rec.marks.push({ assessment: 'quiz3', mark: 22, day: 52 });
    expect(forecast(st, rec).value).toBeLessThan(before - 0.6);
  });
});

describe('projection', () => {
  it('adds the plan, scaled by the time it covers and the work done', () => {
    const { s, rec } = setup();
    const st = student(s);
    const now = forecast(st, rec).value;
    expect(projection(st, rec, 40)).toBe(now);
    const need = minutesNeeded(st);
    rec.plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [{ day: 41, minutes: need, clo: 'CLO1', concepts: [] }] };
    expect(projection(st, rec, 40)).toBeCloseTo(now + 2, 5);
    rec.plan.days[0].minutes = Math.round(need / 2);
    expect(projection(st, rec, 40)).toBeCloseTo(now + 1, 1);
    for (let d = 33; d < 40; d++) rec.days[d] = { planned: 20, done: 10, check: null };
    expect(projection(st, rec, 40)).toBeCloseTo(now + 0.5, 1);
  });
  it('caps at 10 and adds nothing when no study is needed', () => {
    const { s, rec } = setup();
    const st = student(s);
    rec.plan = { createdDay: 40, reason: '', leftOut: [], source: 'offline', days: [{ day: 41, minutes: 1000, clo: 'CLO1', concepts: [] }] };
    setAll(st, 0.74);
    rec.marks.push({ assessment: 'quiz3', mark: 100, day: 52 });
    expect(projection(st, rec, 40)).toBe(10);
    setAll(st, 0.97);
    expect(minutesNeeded(st)).toBe(0);
    expect(projection(st, rec, 40)).toBe(forecast(st, rec).value);
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
  it('shows the phone’s plan for today, and only that plan’s unfinished sessions', () => {
    const { s } = setup();
    s.plans.push(planFor('pathway', { status: 'sent', date: 40, studentIds: ['s17'] }));
    const plan = s.plans[s.plans.length - 1];
    expect(todayList(s, 's17').rows.filter((r) => r.kind === 'plan')).toHaveLength(0);
    s.phone.planId = plan.id;
    expect(todayList(s, 's17').rows.filter((r) => r.kind === 'plan')).toHaveLength(plan.sessions.length);
    s.phone.done = [0];
    expect(todayList(s, 's17').rows.filter((r) => r.kind === 'plan')).toHaveLength(plan.sessions.length - 1);
  });
  it('lists the phone’s plan when two open pathways are dated today', () => {
    const { s } = setup();
    s.plans.push(planFor('pathway', { id: 'pa', status: 'sent', date: 40, studentIds: ['s17'] }));
    s.plans.push(planFor('pathway', { id: 'pb', status: 'sent', date: 40, studentIds: ['s17'], sessions: [{ time: '09:00', title: 'Only this', minutes: 5, concept: 'implication', isMasteryCheck: false, studentId: null }] }));
    s.phone.planId = 'pb';
    const rows = todayList(s, 's17').rows.filter((r) => r.kind === 'plan');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'Only this' });
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

describe('forecast history', () => {
  it('every student starts with Quiz 1 and Quiz 2 points', () => {
    const st = student(seedState(), 's2');
    expect(st.pastForecast.map((p) => p.day)).toEqual([17, 38]);
    expect(forecastSeries(st)).toEqual(st.pastForecast);
  });
  it('a recorded point replaces one already there for the day', () => {
    const { s, rec } = setup();
    const st = student(s);
    noteForecast(rec, st, 40);
    st.mastery.implication = 0.9;
    noteForecast(rec, st, 40);
    expect(rec.forecasts).toEqual([{ day: 40, value: forecast(st, rec).value }]);
    expect(forecastSeries(st, rec).map((p) => p.day)).toEqual([17, 38, 40]);
  });
});

describe('weekly refocus', () => {
  const plan = (clo: (day: number) => CloId, concept: (day: number) => ConceptId): StudyPlan => ({
    createdDay: 40, reason: 'Kept.', leftOut: ['Something'], source: 'agents',
    days: Array.from({ length: 24 }, (_, i) => ({ day: 40 + i, minutes: 10 + i, clo: clo(40 + i), concepts: [concept(40 + i)] })),
  });
  const FIRST: Record<CloId, ConceptId> = { CLO1: 'implication', CLO2: 'deMorgan', CLO3: 'applications' };
  const mixed = () => plan((d) => (d === 42 || d === 43 ? 'CLO2' : d === 44 ? 'CLO3' : 'CLO1'), (d) => FIRST[d === 42 || d === 43 ? 'CLO2' : d === 44 ? 'CLO3' : 'CLO1']);
  it('relies on CONCEPTS being listed prerequisites first', () => {
    const at = (c: ConceptId) => CONCEPTS.findIndex((x) => x.id === c);
    for (const [a, b] of EDGES) expect(at(a)).toBeLessThan(at(b));
  });
  it('changes only that week, keeps minutes and the reason, and leaves its input alone', () => {
    const before = mixed();
    const copy = structuredClone(before);
    const after = refocus(before, student(seedState()), 42);
    expect(before).toEqual(copy);
    expect(after.days.map((d) => d.minutes)).toEqual(before.days.map((d) => d.minutes));
    expect(after).toMatchObject({ createdDay: 40, reason: 'Kept.', leftOut: ['Something'], source: 'agents' });
    const outside = (p: StudyPlan) => p.days.filter((d) => d.day < 42 || d.day > 48);
    expect(outside(after)).toEqual(outside(before));
  });
  it('puts the newest lecture first, moves an unlectured CLO to the next test, then takes the weakest', () => {
    const days = refocus(mixed(), student(seedState()), 42).days;
    const on = (day: number) => days.find((d) => d.day === day)!;
    expect(on(42)).toMatchObject({ clo: 'CLO2', concepts: ['equivalence', 'deMorgan'] });
    expect(on(43)).toMatchObject({ clo: 'CLO2', concepts: ['equivalence', 'equivLaws'] });
    expect(on(44)).toMatchObject({ clo: 'CLO2', concepts: ['equivalence', 'equivLaws'] });
    expect(on(45)).toMatchObject({ clo: 'CLO1', concepts: ['implication', 'biconditional'] });
  });
  it('never picks an untaught concept or one outside the day’s CLO', () => {
    const st = student(seedState());
    for (const clo of ['CLO1', 'CLO2', 'CLO3'] as CloId[]) {
      let p = plan(() => clo, () => FIRST[clo]);
      for (const monday of [42, 49, 56, 63]) p = refocus(p, st, monday);
      for (const d of p.days.filter((x) => x.day >= 42)) {
        expect(d.concepts.length).toBeGreaterThan(0);
        expect(d.concepts.length).toBeLessThanOrEqual(2);
        for (const c of d.concepts) {
          expect(taughtBy(d.day), `day ${d.day}`).toContain(c);
          expect(CLOS.find((x) => x.id === d.clo)!.concepts).toContain(c);
        }
      }
      if (clo === 'CLO3') expect(p.days.filter((d) => d.day >= 42 && d.day < 50).every((d) => d.clo === 'CLO2')).toBe(true);
    }
  });
  it('spreads revision week over every taught concept, weakest first', () => {
    const days = refocus(plan(() => 'CLO1', () => 'implication'), student(seedState()), 56).days.filter((d) => d.day >= 56 && d.day <= 62);
    expect(days[0].concepts).toEqual(['implication', 'biconditional']);
    expect(new Set(days.flatMap((d) => d.concepts)).size).toBe(CLOS[0].concepts.length);
  });
  it('leaves a day before Lecture 1 as it is', () => {
    const early: StudyPlan = { createdDay: 0, reason: 'r', leftOut: [], source: 'offline', days: [{ day: 0, minutes: 5, clo: 'CLO3', concepts: ['applications'] }] };
    expect(refocus(early, student(seedState()), 0).days).toEqual(early.days);
  });
});

describe('forgetting', () => {
  const item = (c: ConceptId) => BANK.find((i) => i.concept === c)!;
  it('takes 0.02 a week off each concept not practised in the last 7 days, down to 0.25', () => {
    const { s, rec } = setup();
    const st = student(s);
    Object.assign(st.mastery, { expressions: 0.26, equivLaws: 0.2 });
    rec.attempts.push({ itemId: item('implication').id, day: 38, correct: true, firstTry: true });
    rec.attempts.push({ itemId: item('biconditional').id, day: 34, correct: true, firstTry: true });
    forget(st, rec, 42);
    expect(st.mastery).toMatchObject({ implication: 0.31, biconditional: 0.33, negation: 0.68, propositions: 0.83, expressions: 0.25, equivLaws: 0.2 });
  });
  it('leaves concepts alone until they have been lectured', () => {
    const { s, rec } = setup();
    const st = student(s);
    Object.assign(st.mastery, { applications: 0.5 });
    forget(st, rec, 42);
    expect(st.mastery.applications).toBe(0.5);
  });
});

describe('stopped practising', () => {
  const fresh = () => newRecord(student(seedState()));
  it('is null before any day has closed and while the student practises', () => {
    expect(stoppedPractising(fresh(), 40)).toBeNull();
    const r = fresh();
    for (let d = 33; d < 40; d++) r.days[d] = { planned: 20, done: 10, check: null };
    expect(stoppedPractising(r, 40)).toBeNull();
    expect(stoppedSince(r, 40)).toBeNull();
  });
  it('reports the last 7 days’ minutes and when the stretch began', () => {
    const r = fresh();
    for (const d of [36, 37, 38, 39, 40, 41]) r.days[d] = { planned: 30, done: d === 36 ? 12.5 : 0, check: null };
    expect(stoppedPractising(r, 42)).toEqual({ done: 13, planned: 180 });
    expect(stoppedSince(r, 42)).toBe(40);
  });
  it('matches the disengagement signal', () => {
    const patterns: [number, number][][] = [
      [[30, 0], [30, 0], [30, 0]],
      Array.from({ length: 7 }, () => [20, 4] as [number, number]),
      Array.from({ length: 7 }, () => [20, 6] as [number, number]),
      [[30, 0], [30, 0]],
    ];
    const stopped = patterns.map((p) => {
      const r = fresh();
      p.forEach(([planned, done], i) => { r.days[39 - i] = { planned, done, check: null }; });
      expect(stoppedPractising(r, 40) !== null).toBe(detectSignal(r, 40, 'At risk', null, null) === 'disengaged');
      return stoppedPractising(r, 40) !== null;
    });
    expect(stopped).toEqual([true, true, false, false]);
  });
});
