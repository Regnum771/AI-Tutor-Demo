import { CARDS } from '../../scenario/cards';
import { ASSESSMENTS, CLOS, EXAM_DAY, START_DAY, type CloId } from '../../scenario/course';
import { statusFor } from '../mastery';
import { studentById } from '../reducer';
import { IDLE_PHONE } from '../seed';
import type { CardRating, DemoState, ReplanSignal, StudyDay, StudyPlan } from '../types';
import { applyCheck, openPathways } from './capacity';
import { reviewCard } from './cards';
import { forecast } from './estimate';
import { markFor } from './marks';
import { ensureRecord, logMinutes, MINUTES, noteForecast } from './record';
import { nextItem } from './select';
import { detectSignal } from './signals';
import { todayList } from './today';

export type StudyResult = { ok: true; state: DemoState; signal: ReplanSignal | null } | { ok: false; error: string };
export type StudyTab = 'today' | 'choosePractice' | 'cards' | 'semester';

const TABS: StudyTab[] = ['today', 'choosePractice', 'cards', 'semester'];
const RATINGS: CardRating[] = ['again', 'hard', 'good', 'easy'];
const CHECKS: StudyDay['check'][] = ['tooMuch', 'right', 'tooLittle', null];
const MORNING = 7 * 60 + 30;
const NO_PRACTICE = { self: null, session: null, item: 0, hinted: false, result: null, lastOption: null } as const;

const fail = (error: string): StudyResult => ({ ok: false, error });
const done = (state: DemoState, signal: ReplanSignal | null = null): StudyResult => ({ ok: true, state, signal });

export function openPick(state: DemoState): StudyResult {
  const s = structuredClone(state);
  s.phone = { ...s.phone, screen: 'pick', morning: false, self: null };
  return done(s);
}

/** The student on this phone. A returning student goes straight to Today. */
export function pickStudent(state: DemoState, id: string): StudyResult {
  if (!studentById(state, id)) return fail('No such student.');
  const s = structuredClone(state);
  const rec = ensureRecord(s, id);
  const open = openPathways(s, id);
  const plan = open.filter((p) => p.date <= s.day).at(-1) ?? open.at(-1) ?? null;
  s.phone = { ...IDLE_PHONE, done: plan && plan.id === s.phone.planId ? s.phone.done : [], planId: plan?.id ?? null, studentId: id, screen: rec.reported ? 'today' : 'setup' };
  return done(s);
}

export function saveSetup(state: DemoState, weekday: number, weekend: number): StudyResult {
  const valid = (m: number) => Number.isFinite(m) && m >= 5 && m <= 240;
  if (!valid(weekday) || !valid(weekend)) return fail('Minutes must be between 5 and 240.');
  const id = state.phone.studentId;
  if (!id) return fail('Choose a student first.');
  const s = structuredClone(state);
  ensureRecord(s, id).reported = { weekday, weekend };
  s.phone.screen = 'today';
  return done(s);
}

/** A student who has only had teacher plans sets up on the way in. */
export function showTab(state: DemoState, tab: StudyTab): StudyResult {
  const id = state.phone.studentId;
  if (!id) return fail('Choose a student first.');
  if (!TABS.includes(tab)) return fail('No such tab.');
  const s = structuredClone(state);
  const rec = ensureRecord(s, id);
  s.phone = { ...s.phone, ...NO_PRACTICE, morning: false, screen: rec.reported ? tab : 'setup' };
  return done(s);
}

/** Starts a self session on a CLO, or on the day's focus (every concept when nothing is planned). */
export function startSelf(state: DemoState, clo: CloId | null): StudyResult {
  const id = state.phone.studentId;
  if (!id || !state.study[id]) return fail('Choose a student first.');
  const chosen = clo ? CLOS.find((c) => c.id === clo) : null;
  if (clo && !chosen) return fail('No such learning outcome.');
  const s = structuredClone(state);
  const focus = chosen?.concepts ?? todayList(s, id).concepts;
  const concepts = focus.length ? focus : CLOS.flatMap((c) => c.concepts);
  const first = nextItem(s.study[id], studentById(s, id)!, s.day, concepts, []);
  s.phone = { ...s.phone, ...NO_PRACTICE, screen: 'practice', self: { clo, concepts, served: [first.id] } };
  return done(s);
}

/** Self-rating schedules the card; only Good and Easy nudge mastery, 5% of the way toward 0.9. */
export function rateCard(state: DemoState, cardId: string, rating: CardRating): StudyResult {
  const id = state.phone.studentId;
  const card = CARDS.find((c) => c.id === cardId);
  if (!id || !state.study[id]) return fail('Choose a student first.');
  if (!card) return fail('No such card.');
  if (!RATINGS.includes(rating)) return fail('No such rating.');
  const s = structuredClone(state);
  const rec = s.study[id];
  rec.cards[cardId] = reviewCard(rec.cards[cardId], rating, s.day);
  logMinutes(rec, s.day, MINUTES.card);
  if (rating === 'good' || rating === 'easy') {
    const student = studentById(s, id)!;
    const v = student.mastery[card.concept];
    student.mastery[card.concept] = Math.max(v, Math.round((v + (0.9 - v) * 0.05) * 100) / 100);
    student.status = statusFor(student.mastery);
  }
  return done(s);
}

export function openCheckIn(state: DemoState): StudyResult {
  if (!state.phone.studentId) return fail('Choose a student first.');
  const s = structuredClone(state);
  s.phone = { ...s.phone, self: null, screen: 'checkIn' };
  return done(s);
}

/** Closes `days` days and lands on the next morning's lock screen. Reports any drastic signal; the session decides on a replan. */
export function advance(state: DemoState, days: number, check: StudyDay['check']): StudyResult {
  const id = state.phone.studentId;
  if (!id || !state.study[id]?.reported) return fail('Choose a student and set up first.');
  if (state.day >= EXAM_DAY) return fail('The exam is today.');
  if (!CHECKS.includes(check)) return fail('No such check.');
  const s = structuredClone(state);
  const rec = s.study[id];
  const student = studentById(s, id)!;
  let swing = null as { mark: number; previous: number } | null;
  for (let i = 0; i < days && s.day < EXAM_DAY; i++) {
    const budget = todayList(s, id).budget;
    const entry = rec.days[s.day] ?? { planned: 0, done: 0, check: null };
    rec.days[s.day] = { ...entry, planned: budget, check: i === 0 ? check : null };
    if (i === 0 && check) rec.feel = applyCheck(rec.feel, check);
    for (const a of ASSESSMENTS) {
      if (a.day < START_DAY || a.day > s.day || rec.marks.some((m) => m.assessment === a.id)) continue;
      const previous = rec.marks.filter((m) => m.day < a.day).at(-1)?.mark ?? student.quiz.q2;
      const mark = markFor(student, a);
      rec.marks.push({ assessment: a.id, mark, day: a.day });
      if (!swing || Math.abs(mark - previous) > Math.abs(swing.mark - swing.previous)) swing = { mark, previous };
    }
    s.day += 1;
    noteForecast(rec, student, s.day);
  }
  s.clock = MORNING;
  s.phone = { ...s.phone, ...NO_PRACTICE, screen: 'lock', morning: true };
  const { band } = forecast(student, rec);
  rec.band ??= band;
  return done(s, detectSignal(rec, s.day, band, swing?.mark ?? null, swing?.previous ?? null));
}

/** Director control: a Quiz 3 result 20 points below the last mark, so the demo can show a drastic signal. */
export function simulateDrop(state: DemoState): StudyResult {
  const id = state.phone.studentId;
  if (!id || !state.study[id]?.reported) return fail('Choose a student on the phone and set up first.');
  const s = structuredClone(state);
  const rec = s.study[id];
  rec.marks = rec.marks.filter((m) => m.assessment !== 'quiz3');
  const previous = rec.marks.at(-1)?.mark ?? studentById(s, id)!.quiz.q2;
  const quiz3 = ASSESSMENTS.find((a) => a.id === 'quiz3')!;
  rec.marks.push({ assessment: 'quiz3', mark: Math.max(0, previous - 20), day: quiz3.day });
  return done(s, 'markSwing');
}

/** Puts a finished plan in place and records why it changed. A signal raised while it was written stays pending. Mutates `s`. */
export function applyPlan(s: DemoState, studentId: string, plan: StudyPlan, signal: ReplanSignal): void {
  const rec = s.study[studentId];
  Object.assign(rec, { plan, planning: null, lastReplanDay: s.day });
  rec.band = forecast(studentById(s, studentId)!, rec).band;
  noteForecast(rec, studentById(s, studentId)!, s.day);
  rec.replans.push({ day: s.day, signal, reason: plan.reason });
}
