import { conceptById } from '../scenario/knowledgeGraph';
import { sessionItems, type BankItem } from '../scenario/practiceBank';
import { fmt, parseTime, TONIGHT } from './clock';
import { afterAnswer, statusFor } from './mastery';
import { IDLE_PHONE } from './seed';
import type { AssistantMsg, DemoState, Plan, StudentProfile } from './types';

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
 * a follow-up keeps the current screen and the finished plan, so the progress screen still shows that result.
 */
export function deliver(s: DemoState, plan: Plan, updated: boolean): void {
  const student = studentById(s, plan.studentIds[0]);
  plan.baseline = student ? { ...student.mastery } : null;
  s.phone = {
    ...IDLE_PHONE,
    done: [],
    planId: plan.id,
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

/** The bank items of the session open on the phone. */
export function currentItems(s: DemoState): BankItem[] {
  const plan = planById(s, s.phone.planId);
  const session = plan && s.phone.session !== null ? plan.sessions[s.phone.session] : null;
  return session?.concept ? sessionItems(session.concept, session.isMasteryCheck) : [];
}

const clearItem = { hinted: false, result: null, lastOption: null } as const;

export function phoneShowPlan(state: DemoState): Result {
  if (!state.phone.planId) return fail('No plan on the phone.');
  const s = structuredClone(state);
  s.phone = { ...s.phone, ...clearItem, screen: 'plan', session: null, item: 0 };
  return done(s);
}

/** Opening a session moves the story to it: forward to its date, then forward to its time. */
function moveClockTo(s: DemoState, plan: Plan, time: string) {
  if (plan.date > s.day) {
    s.day = plan.date;
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
  s.phone = { ...s.phone, ...clearItem, screen: 'practice', session: index, item: 0 };
  return done(s);
}

function record(s: DemoState, student: StudentProfile, item: BankItem, outcome: string) {
  const n = student.evidence.filter((e) => e.kind === 'practice').length + 1;
  student.evidence.push({
    id: `${student.id}-practice-${n}`, kind: 'practice', source: 'Beyond practice', when: fmt(s.clock), concept: item.concept,
    text: `${conceptById(item.concept).label}: “${item.prompt}” · ${outcome}`,
  });
}

export function phoneAnswer(state: DemoState, option: number): Result {
  const s = structuredClone(state);
  if (s.phone.screen !== 'practice') return fail('No practice open.');
  const item = currentItems(s)[s.phone.item];
  if (!item) return fail('No item to answer.');
  if (s.phone.result === 'right') return fail('Already answered.');
  if (!Number.isInteger(option) || option < 0 || option >= item.options.length) return fail('No such option.');
  const student = studentById(s, planById(s, s.phone.planId)!.studentIds[0])!;
  const correct = option === item.correct;
  student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], correct, s.phone.hinted);
  student.status = statusFor(student.mastery);
  record(s, student, item, correct ? (s.phone.hinted ? 'correct after a hint' : 'correct first try') : `chose ${item.options[option]}`);
  s.phone = { ...s.phone, result: correct ? 'right' : 'wrong', lastOption: option, hinted: s.phone.hinted || !correct };
  return done(s);
}

export function phoneNext(state: DemoState): Result {
  if (state.phone.result !== 'right') return fail('Answer the item first.');
  const s = structuredClone(state);
  const next = s.phone.item + 1;
  if (next < currentItems(s).length) {
    s.phone = { ...s.phone, ...clearItem, item: next };
    return done(s);
  }
  const plan = planById(s, s.phone.planId)!;
  const index = s.phone.session!;
  const isCheck = plan.sessions[index].isMasteryCheck;
  s.phone = { ...s.phone, ...clearItem, done: [...s.phone.done, index], session: null, item: 0, screen: isCheck ? 'progress' : 'plan' };
  if (!isCheck) return done(s);
  s.clock = Math.max(s.clock, TONIGHT);
  plan.status = 'done';
  s.phone.lastDone = plan.id;
  return done(s, true);
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
      student.mastery[item.concept] = afterAnswer(student.mastery[item.concept], true, true);
      record(s, student, item, 'correct after a hint (skipped ahead)');
    }
    s.phone.done = [...s.phone.done, i];
  });
  student.status = statusFor(student.mastery);
  if (checkIndex >= 0) moveClockTo(s, plan, plan.sessions[checkIndex].time);
  return done(s);
}
