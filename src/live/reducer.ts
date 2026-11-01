import { EXAM_DAY } from '../scenario/course';
import { conceptById } from '../scenario/knowledgeGraph';
import { itemById, sessionItems, type BankItem } from '../scenario/practiceBank';
import { fmt, parseTime, TONIGHT } from './clock';
import { afterAnswer, statusFor } from './mastery';
import { IDLE_PHONE } from './seed';
import { logMinutes, MINUTES, noteAttempt } from './study/record';
import { nextItem, SELF_SESSION } from './study/select';
import type { AssistantMsg, DemoState, Evidence, Plan, QuestionSheet, StudentProfile } from './types';

export type Result = { ok: true; state: DemoState; finishedCheck?: boolean } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });
const done = (state: DemoState, finishedCheck = false): Result => ({ ok: true, state, ...(finishedCheck ? { finishedCheck } : {}) });

export const planById = (s: DemoState, id: string | null): Plan | null => s.plans.find((p) => p.id === id) ?? null;
export const studentById = (s: DemoState, id: string): StudentProfile | null => s.students.find((x) => x.id === id) ?? null;

export const systemMsg = (text: string, stamp: string | null = null): AssistantMsg => ({
  role: 'assistant', source: 'system', blocks: [{ kind: 'p', text, cites: [] }], canned: null, followUps: [], panel: null, stamp,
});

function say(s: DemoState, conversationId: string, text: string) {
  s.conversations.find((c) => c.id === conversationId)?.msgs.push(systemMsg(text));
}

/**
 * Puts `plan` on the phone and records its baseline. A fresh delivery shows the lock-screen notification;
 * a follow-up keeps the current screen and the finished plan, so the review and the progress screen still show that result.
 */
export function deliver(s: DemoState, plan: Plan, updated: boolean): void {
  const student = studentById(s, plan.studentIds[0]);
  plan.baseline = student ? { ...student.mastery } : null;
  // A follow-up for someone else waits until that student is picked.
  if (updated && s.phone.studentId && s.phone.studentId !== plan.studentIds[0]) return;
  // A follow-up can land while the student is in a self-started session.
  if (updated && s.phone.self) {
    s.phone = { ...s.phone, planId: plan.id, done: [], updated };
    return;
  }
  const reviewing = updated && s.phone.screen === 'review';
  s.phone = {
    ...IDLE_PHONE,
    sheet: reviewing ? s.phone.sheet : [],
    reviewNext: reviewing ? s.phone.reviewNext : null,
    done: [],
    planId: plan.id,
    studentId: plan.studentIds[0],
    screen: updated ? s.phone.screen : 'lock',
    lastDone: updated ? s.phone.lastDone : null,
    updated,
  };
}

export function editPlan(state: DemoState, planId: string, index: number, change: { time?: string; remove?: boolean }): Result {
  const s = structuredClone(state);
  const plan = planById(s, planId);
  if (!plan || plan.status !== 'proposed') return fail('Only a proposed plan can be edited.');
  const session = plan.sessions[index];
  if (!session) return fail('No such session.');
  if (change.remove) {
    if (session.isMasteryCheck) return fail('The mastery check stays in the plan.');
    if (plan.sessions.length === 1) return fail('A plan needs at least one session.');
    plan.sessions.splice(index, 1);
    return done(s);
  }
  if (change.time !== undefined) {
    if (parseTime(change.time) === null) return fail('Time must be HH:MM.');
    session.time = change.time;
  }
  return done(s);
}

export function approvePlan(state: DemoState, planId: string): Result {
  const s = structuredClone(state);
  const plan = planById(s, planId);
  if (!plan || plan.status !== 'proposed') return fail('Only a proposed plan can be approved.');
  if (plan.kind === 'pathway') {
    plan.status = 'sent';
    deliver(s, plan, false);
    const name = studentById(s, plan.studentIds[0])?.short ?? 'the student';
    const first = plan.sessions[0];
    say(s, plan.conversationId, `Sent to ${name}’s phone. The first session, “${first.title}”, starts at ${first.time}. I’ll check back after the mastery check.`);
  } else {
    plan.status = 'approved';
    say(s, plan.conversationId, plan.kind === 'classActivity'
      ? `Scheduled: “${plan.title}” on ${plan.day}, for ${plan.studentIds.length} students. I’ll report back after it runs.`
      : `Booked. ${plan.sessions.length} check-in invitations for ${plan.day} are on their way, and automated plans for these students stay paused until you’ve met.`);
  }
  return done(s);
}

export function dismissPlan(state: DemoState, planId: string): Result {
  const s = structuredClone(state);
  const plan = planById(s, planId);
  if (!plan || plan.status !== 'proposed') return fail('Only a proposed plan can be set aside.');
  plan.status = 'dismissed';
  say(s, plan.conversationId, `Okay, I’ve set “${plan.title}” aside. Ask me again whenever you want a new plan.`);
  return done(s);
}

/** The items of the session open on the phone: a teacher plan session, or the questions served so far in a self session. */
export function currentItems(s: DemoState): BankItem[] {
  if (s.phone.self) return s.phone.self.served.flatMap((id) => itemById(id) ?? []);
  const plan = planById(s, s.phone.planId);
  const session = plan && s.phone.session !== null ? plan.sessions[s.phone.session] : null;
  return session?.concept ? sessionItems(session.concept, session.isMasteryCheck) : [];
}

/** How many question slots the open session has. */
export const slotCount = (s: DemoState): number => (s.phone.self ? SELF_SESSION : currentItems(s).length);

export const blankQuestion = (itemId: string): QuestionSheet => ({ itemId, tries: [], rightOn: null, reopened: false });

export function phoneShowPlan(state: DemoState): Result {
  if (!state.phone.planId) return fail('No plan on the phone.');
  const s = structuredClone(state);
  s.phone = { ...s.phone, sheet: [], reviewNext: null, self: null, screen: 'plan', session: null, item: 0 };
  return done(s);
}

/** Opening a session moves the story to it: forward to its date, then forward to its time. */
function moveClockTo(s: DemoState, plan: Plan, time: string) {
  if (plan.date > s.day && s.day < EXAM_DAY) {
    s.day = Math.min(EXAM_DAY, plan.date);
    s.clock = 0;
  }
  const t = parseTime(time);
  if (plan.date === s.day && t !== null && t > s.clock) s.clock = t;
}

export function phoneOpen(state: DemoState, index: number): Result {
  const s = structuredClone(state);
  const plan = planById(s, s.phone.planId);
  const session = plan?.sessions[index];
  if (!plan || !session) return fail('No such session.');
  if (s.phone.done.includes(index)) return fail('That session is already done.');
  moveClockTo(s, plan, session.time);
  s.phone = { ...s.phone, reviewNext: null, self: null, screen: 'practice', session: index, item: 0 };
  s.phone.sheet = currentItems(s).map((item) => blankQuestion(item.id));
  return done(s);
}

function record(s: DemoState, student: StudentProfile, item: BankItem, outcome: string, mark: Pick<Evidence, 'result' | 'tries' | 'planId'>) {
  const n = student.evidence.filter((e) => e.kind === 'practice').length + 1;
  student.evidence.push({
    id: `${student.id}-practice-${n}`, kind: 'practice', source: 'Beyond practice', when: fmt(s.clock), day: s.day, concept: item.concept,
    text: `${conceptById(item.concept).label}: “${item.prompt}” · ${outcome}`, ...mark,
  });
}

export function phoneAnswer(state: DemoState, option: number): Result {
  const s = structuredClone(state);
  if (s.phone.screen !== 'practice') return fail('No practice open.');
  const item = currentItems(s)[s.phone.item];
  const q = s.phone.sheet[s.phone.item];
  if (!item || !q) return fail('No item to answer.');
  if (q.rightOn !== null && !q.reopened) return fail('Already answered.');
  if (!q.reopened && q.tries.at(-1) === option) return fail('Already tried that one.');
  if (!Number.isInteger(option) || option < 0 || option >= item.options.length) return fail('No such option.');
  const reanswer = q.reopened;
  q.reopened = false;
  // Answer again, then the option just tapped: nothing new happened.
  if (reanswer && q.tries.at(-1) === option) return done(s);
  q.tries.push(option);
  const tryNumber = q.tries.length;
  const student = studentById(s, s.phone.self ? s.phone.studentId! : planById(s, s.phone.planId)!.studentIds[0])!;
  const correct = option === item.correct;
  const rec = s.study[student.id];
  const planId = s.phone.self ? undefined : s.phone.planId ?? undefined;
  if (reanswer) {
    if (rec) logMinutes(rec, s.day, MINUTES.question, !s.phone.self);
    record(s, student, item, `answered again: ${item.options[option]}`, { planId });
    return done(s);
  }
  if (rec) noteAttempt(rec, item, s.day, correct, tryNumber, !s.phone.self);
  if (correct) q.rightOn = tryNumber;
  student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], correct, tryNumber);
  student.status = statusFor(student.mastery);
  record(s, student, item, correct ? `correct on try ${tryNumber}` : `chose ${item.options[option]}`, { result: correct ? 'correct' : 'wrong', tries: correct ? tryNumber : undefined, planId });
  return done(s);
}

/** Opens a slot. In self practice an empty slot picks its question now and keeps it; slots fill in order, so a jump also picks the ones it passes. */
export function phoneGoto(state: DemoState, item: number): Result {
  if (state.phone.screen !== 'practice') return fail('No practice open.');
  if (!Number.isInteger(item) || item < 0 || item >= slotCount(state)) return fail('No such question.');
  const s = structuredClone(state);
  const self = s.phone.self;
  if (self) {
    const student = studentById(s, s.phone.studentId!)!;
    while (self.served.length <= item) {
      const { id } = nextItem(s.study[student.id], student, s.day, self.concepts, self.served);
      self.served.push(id);
      s.phone.sheet.push(blankQuestion(id));
    }
  }
  s.phone.item = item;
  return done(s);
}

/** Answer again: clears the options of a question that already has a right answer. */
export function phoneAgain(state: DemoState): Result {
  if (state.phone.screen !== 'practice') return fail('No practice open.');
  const s = structuredClone(state);
  const q = s.phone.sheet[s.phone.item];
  if (!q || q.rightOn === null) return fail('Answer the item first.');
  q.reopened = true;
  return done(s);
}

export const phoneNext = (state: DemoState): Result => phoneGoto(state, state.phone.item + 1);

/** The first slot with no right answer yet, or null when every slot has one. */
function firstOpen(s: DemoState): number | null {
  for (let i = 0; i < slotCount(s); i++) if ((s.phone.sheet[i]?.rightOn ?? null) === null) return i;
  return null;
}

/** With open questions, moves to the first of them. Otherwise opens the review and completes the session: marks it done and, after a mastery check, closes the plan. */
export function phoneFinish(state: DemoState): Result {
  if (state.phone.screen !== 'practice') return fail('No practice open.');
  const open = firstOpen(state);
  if (open !== null) return phoneGoto(state, open);
  const s = structuredClone(state);
  if (s.phone.self) {
    s.phone = { ...s.phone, self: null, item: 0, screen: 'review', reviewNext: 'today' };
    return done(s);
  }
  const plan = planById(s, s.phone.planId)!;
  const index = s.phone.session!;
  const isCheck = plan.sessions[index].isMasteryCheck;
  s.phone = { ...s.phone, done: [...s.phone.done, index], session: null, item: 0, screen: 'review', reviewNext: isCheck ? 'progress' : 'plan' };
  if (!isCheck) return done(s);
  s.clock = Math.max(s.clock, TONIGHT);
  plan.status = 'done';
  s.phone.lastDone = plan.id;
  return done(s, true);
}

/** Leaves the review for Today, the plan or the progress screen. */
export function phoneContinue(state: DemoState): Result {
  if (state.phone.screen !== 'review') return fail('No review open.');
  const s = structuredClone(state);
  s.phone = { ...s.phone, sheet: [], reviewNext: null, screen: s.phone.reviewNext ?? 'today' };
  return done(s);
}

/** "Skip to tonight": earlier sessions count as done, each item correct after a hint. */
export function phoneSkip(state: DemoState): Result {
  const s = structuredClone(state);
  const plan = planById(s, s.phone.planId);
  if (!plan) return fail('No plan on the phone.');
  const checkIndex = plan.sessions.findIndex((x) => x.isMasteryCheck);
  const student = studentById(s, plan.studentIds[0])!;
  plan.sessions.forEach((session, i) => {
    if (i >= checkIndex || s.phone.done.includes(i) || !session.concept) return;
    for (const item of sessionItems(session.concept, false)) {
      student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], true, 2);
      record(s, student, item, 'correct after a hint (skipped ahead)', { result: 'skipped', planId: plan.id });
    }
    s.phone.done = [...s.phone.done, i];
  });
  student.status = statusFor(student.mastery);
  if (checkIndex >= 0) moveClockTo(s, plan, plan.sessions[checkIndex].time);
  return done(s);
}
