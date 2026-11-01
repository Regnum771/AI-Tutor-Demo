import type { MessagesClient } from '../agents/client';
import { classKpis } from '../../src/live/mastery';
import { currentItems, planById, studentById } from '../../src/live/reducer';
import { fmt } from '../../src/live/clock';
import type { AssistantMsg, DemoState, Plan, StudentProfile } from '../../src/live/types';
import type { ConceptId } from '../../src/scenario/knowledgeGraph';
import { DemoSession } from '../session';

/** The feedback loop the demo sells; every check belongs to one stage. */
export const STAGES = ['Sense', 'Diagnose', 'Intervene', 'Oversee', 'Adapt'] as const;
export type Stage = (typeof STAGES)[number];

export interface Check { stage: Stage; name: string; pass: boolean; detail?: string }

export interface Turn {
  question: string;
  answer: string;
  source: AssistantMsg['source'] | 'none';
  cites: string[];
  steps: string[];
  conversationId: string;
  msg: AssistantMsg | null;
  ms: number;
}

/** One point on a student's trajectory through the loop. */
export interface LoopPoint { label: string; clock: string; value: number; status: string; needSupport: number }

export interface Usage { calls: number; input: number; output: number; cacheRead: number; cacheWrite: number; cost: number }

/** Claude Sonnet 5.5 list prices, per token. Only used to log an estimate. */
const PRICE = { input: 2e-6, output: 10e-6, cacheRead: 0.2e-6, cacheWrite: 2.5e-6 };

export const newUsage = (): Usage => ({ calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });

export class Budget {
  spent = 0;
  constructor(readonly cap: number) {}
}

/** Wraps the real client to count tokens per case and stop the whole run at the spend cap. */
export function metered(inner: MessagesClient, usage: Usage, budget: Budget): MessagesClient {
  return {
    async create(params, options) {
      if (budget.spent >= budget.cap) throw new Error(`spend cap of $${budget.cap} reached`);
      const res = await inner.create(params, options);
      const u = res.usage;
      const added = {
        input: u.input_tokens ?? 0, output: u.output_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0,
      };
      const cost = added.input * PRICE.input + added.output * PRICE.output + added.cacheRead * PRICE.cacheRead + added.cacheWrite * PRICE.cacheWrite;
      usage.calls += 1;
      usage.input += added.input;
      usage.output += added.output;
      usage.cacheRead += added.cacheRead;
      usage.cacheWrite += added.cacheWrite;
      usage.cost += cost;
      budget.spent += cost;
      return res;
    },
  };
}

export const textOf = (msg: AssistantMsg | null): string => (msg ? msg.blocks.map((b) => b.text).join('\n') : '');

const PRONOUN = /\b(he|she|him|his|her|hers)\b/i;

/** What a case can do and record: one fresh demo session per case. */
export class T {
  readonly session: DemoSession;
  readonly checks: Check[] = [];
  readonly turns: Turn[] = [];
  readonly loop: LoopPoint[] = [];

  constructor(client: MessagesClient | null) {
    this.session = new DemoSession(client);
  }

  get state(): DemoState {
    return this.session.state;
  }

  student(id: string): StudentProfile {
    return studentById(this.state, id)!;
  }

  check(stage: Stage, name: string, pass: boolean, detail?: string): boolean {
    this.checks.push({ stage, name, pass, detail: pass ? undefined : detail });
    return pass;
  }

  /** Asks a question, waits for the agents and records the turn. The agents must have answered, not the fallback. */
  async ask(question: string, conversationId: string | null = null, stage: Stage = 'Sense'): Promise<Turn> {
    const started = Date.now();
    let steps: string[] = [];
    const off = this.session.subscribe((s) => {
      const pending = s.conversations.find((c) => c.pending)?.pending;
      if (pending) steps = pending.steps;
    });
    const r = this.session.ask(question, conversationId);
    if (!r.ok) throw new Error(`ask refused: ${r.error}`);
    await r.done;
    off();
    const conv = this.state.conversations.find((c) => c.id === r.conversationId)!;
    const last = conv.msgs[conv.msgs.length - 1];
    const msg = last?.role === 'assistant' ? last : null;
    const turn: Turn = {
      question, msg, steps, conversationId: conv.id, ms: Date.now() - started,
      answer: textOf(msg), source: msg?.source ?? 'none', cites: msg?.blocks.flatMap((b) => b.cites) ?? [],
    };
    this.turns.push(turn);
    this.check(stage, 'answered by the agents, not the offline fallback', turn.source === 'agents', `source: ${turn.source}`);
    return turn;
  }

  /** Student copy must not assume anyone's pronouns (a global constraint of the app). */
  noPronouns(stage: Stage, text: string): void {
    const hit = PRONOUN.exec(text);
    this.check(stage, 'no assumed pronouns', hit === null, hit ? `found "${hit[0]}"` : undefined);
  }

  /** Records where a student stands right now, for the loop trajectory. */
  point(label: string, studentId: string, concept: ConceptId): number {
    const s = this.student(studentId);
    const value = s.mastery[concept];
    this.loop.push({ label, clock: fmt(this.state.clock), value, status: s.status, needSupport: classKpis(this.state.students).needSupport });
    return value;
  }

  plans(): Plan[] {
    return this.state.plans;
  }

  latestPlan(): Plan | null {
    return this.state.plans[this.state.plans.length - 1] ?? null;
  }
}

export type AnswerMode = 'first-try' | 'wrong-first';

/** Plays one phone session through, tapping like a visitor. Returns when the session (and any adapt run) has finished. */
export async function playSession(t: T, index: number, mode: AnswerMode): Promise<void> {
  const opened = t.session.phoneOpen(index);
  if (!opened.ok) throw new Error(`phoneOpen: ${opened.error}`);
  while (t.state.phone.session === index) {
    const item = currentItems(t.state)[t.state.phone.item];
    if (mode === 'wrong-first') {
      const wrong = item.options.findIndex((_, i) => i !== item.correct);
      t.session.phoneAnswer(wrong);
    }
    const right = t.session.phoneAnswer(item.correct);
    if (!right.ok) throw new Error(`phoneAnswer: ${right.error}`);
    const next = t.session.phoneNext();
    if (!next.ok) throw new Error(`phoneNext: ${next.error}`);
    await next.done;
  }
}

/** Plays every remaining session of the plan on the phone, in order, ending with its mastery check. */
export async function playPlan(t: T, mode: AnswerMode): Promise<Plan> {
  const shown = t.session.phonePlan();
  if (!shown.ok) throw new Error(`phonePlan: ${shown.error}`);
  const plan = planById(t.state, t.state.phone.planId)!;
  for (let i = 0; i < plan.sessions.length; i++) {
    if (!t.state.phone.done.includes(i)) await playSession(t, i, mode);
  }
  return plan;
}

/** The phone joins as a student and waits for the first plan. */
export async function joinPhone(t: T, studentId: string, weekday: number, weekend: number): Promise<void> {
  t.session.studyOpen();
  t.session.studyPick(studentId);
  const set = t.session.studySetup(weekday, weekend);
  if (!set.ok) throw new Error(`studySetup: ${set.error}`);
  await t.session.settled();
}

/** One self-started session, answering everything correctly first try. */
export async function practiseToday(t: T): Promise<void> {
  const started = t.session.studyPractice(null);
  if (!started.ok) throw new Error(`studyPractice: ${started.error}`);
  while (t.state.phone.self) {
    t.session.phoneAnswer(currentItems(t.state)[t.state.phone.item].correct);
    const next = t.session.phoneNext();
    if (!next.ok) throw new Error(`phoneNext: ${next.error}`);
    await next.done;
  }
}
