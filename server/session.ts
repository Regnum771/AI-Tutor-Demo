import * as R from '../src/live/reducer';
import { seedState } from '../src/live/seed';
import type { DemoState } from '../src/live/types';
import type { MessagesClient } from './agents/client';
import { adaptAfterCheck, answer, type Deps } from './agents/orchestrate';

type Done = { ok: true } | { ok: false; error: string };
type AskResult = { ok: true; conversationId: string; done: Promise<void> } | { ok: false; status: 400 | 409; error: string };

/** The one in-memory demo: every change publishes the full state to subscribers (the SSE streams). */
export class DemoSession {
  state: DemoState = seedState();
  private listeners = new Set<(s: DemoState) => void>();
  /** Agent runs in flight (an adapt can start while an ask is still running). */
  private runs = new Set<AbortController>();
  private counters = { c: 0, p: 0 };

  constructor(private client: MessagesClient | null) {}

  subscribe(fn: (s: DemoState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private set(next: DemoState) {
    this.state = next;
    for (const fn of this.listeners) {
      try {
        fn(next);
      } catch (e) {
        console.warn('[beyond] dropping a failed subscriber:', e instanceof Error ? e.message : e);
        this.listeners.delete(fn);
      }
    }
  }

  private newId(prefix: 'c' | 'p') {
    return `${prefix}${++this.counters[prefix]}`;
  }

  /** Applies `fn` to a copy of the state, unless a reset happened since `epoch`. */
  private update(epoch: number, fn: (s: DemoState) => void) {
    if (this.state.epoch !== epoch) return;
    const s = structuredClone(this.state);
    fn(s);
    this.set(s);
  }

  private run(r: R.Result): Done {
    if (!r.ok) return { ok: false, error: r.error };
    this.set(r.state);
    return { ok: true };
  }

  /** Starts a background agent run whose steps land in conversation `convId`. */
  private background<T>(convId: string, work: (deps: Deps) => Promise<T>, finish: (st: DemoState, out: T) => void): Promise<void> {
    const epoch = this.state.epoch;
    const abort = new AbortController();
    this.runs.add(abort);
    return work({
      client: this.client,
      newPlanId: () => this.newId('p'),
      signal: abort.signal,
      onStep: (line) => this.update(epoch, (st) => { st.conversations.find((c) => c.id === convId)?.pending?.steps.push(line); }),
    })
      .then((out) => this.update(epoch, (st) => {
        finish(st, out);
        st.busy = this.runs.size > 1;
      }))
      .catch((e) => {
        if (abort.signal.aborted) return; // reset: its result is dropped on purpose
        console.warn('[beyond] agent run failed:', e instanceof Error ? e.message : e);
        this.update(epoch, (st) => {
          const c = st.conversations.find((x) => x.id === convId);
          if (c) {
            c.pending = null;
            c.msgs.push(R.systemMsg('Something went wrong on my side. Please ask again.'));
          }
          st.busy = this.runs.size > 1;
        });
      })
      .finally(() => { this.runs.delete(abort); });
  }

  /** Records the question and starts the agents; `done` settles when the answer is in (the HTTP route does not wait). */
  ask(text: string, conversationId: string | null): AskResult {
    const question = text.trim();
    if (!question) return { ok: false, status: 400, error: 'Empty question.' };
    if (this.state.busy) return { ok: false, status: 409, error: 'The agents are still working.' };
    const s = structuredClone(this.state);
    let conv = s.conversations.find((c) => c.id === conversationId);
    if (!conv) {
      conv = { id: this.newId('c'), title: 'New conversation', sansTitle: false, msgs: [], pending: null };
      s.conversations.push(conv);
    }
    const history = [...conv.msgs];
    conv.msgs.push({ role: 'teacher', text: question });
    conv.pending = { steps: [] };
    s.busy = true;
    this.set(s);
    const id = conv.id;
    const snapshot = structuredClone(s);
    const done = this.background(id, (deps) => answer(snapshot, history, id, question, deps), (st, out) => {
      const c = st.conversations.find((x) => x.id === id)!;
      c.pending = null;
      c.msgs.push(out.msg);
      if (c.title === 'New conversation') {
        c.title = out.title;
        c.sansTitle = out.sansTitle;
      }
      if (out.plan) {
        const i = st.plans.findIndex((p) => p.id === out.plan!.id);
        if (i >= 0) st.plans[i] = out.plan;
        else st.plans.push(out.plan);
      }
    });
    return { ok: true, conversationId: id, done };
  }

  edit(planId: string, index: number, change: { time?: string; remove?: boolean }): Done { return this.run(R.editPlan(this.state, planId, index, change)); }
  approve(planId: string): Done { return this.run(R.approvePlan(this.state, planId)); }
  dismiss(planId: string): Done { return this.run(R.dismissPlan(this.state, planId)); }
  phonePlan(): Done { return this.run(R.phoneShowPlan(this.state)); }
  phoneOpen(index: number): Done { return this.run(R.phoneOpen(this.state, index)); }
  phoneAnswer(option: number): Done { return this.run(R.phoneAnswer(this.state, option)); }
  phoneSkip(): Done { return this.run(R.phoneSkip(this.state)); }

  /** Moves on after a correct answer; finishing a mastery check starts the adapt run. */
  phoneNext(): { ok: true; done: Promise<void> } | { ok: false; error: string } {
    const r = R.phoneNext(this.state);
    if (!r.ok) return { ok: false, error: r.error };
    this.set(r.state);
    return { ok: true, done: r.finishedCheck ? this.adapt(r.state.phone.lastDone!) : Promise.resolve() };
  }

  private adapt(planId: string): Promise<void> {
    const s = structuredClone(this.state);
    const convId = R.planById(s, planId)!.conversationId;
    const conv = s.conversations.find((c) => c.id === convId);
    if (conv) conv.pending = { steps: [] };
    s.busy = true;
    this.set(s);
    const snapshot = structuredClone(s);
    return this.background(convId, (deps) => adaptAfterCheck(snapshot, planId, deps), (st, { msg, followUp }) => {
      const c = st.conversations.find((x) => x.id === convId);
      if (c) {
        c.pending = null;
        c.msgs.push(msg);
      }
      if (followUp) {
        st.plans.push(followUp);
        if (followUp.status === 'autoApproved') R.deliver(st, followUp, true);
      }
    });
  }

  /** Back to the seed for the next visitor; a run in flight is aborted and its result dropped. */
  reset(): void {
    for (const run of this.runs) run.abort();
    this.runs.clear();
    this.set(seedState(this.state.epoch + 1));
  }
}
