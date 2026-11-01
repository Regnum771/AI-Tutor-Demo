import * as R from '../src/live/reducer';
import { seedState } from '../src/live/seed';
import * as S from '../src/live/study/reducer';
import { kept, nextReplan } from '../src/live/study/signals';
import type { CardRating, DemoState, ReplanSignal, StudyDay } from '../src/live/types';
import type { CloId } from '../src/scenario/course';
import type { MessagesClient } from './agents/client';
import { adaptAfterCheck, answer, type Deps } from './agents/orchestrate';
import { planStudy } from './agents/study';

type Done = { ok: true } | { ok: false; error: string };
type AskResult = { ok: true; conversationId: string; done: Promise<void> } | { ok: false; status: 400 | 409; error: string };

/** The one in-memory demo: every change publishes the full state to subscribers (the SSE streams). */
export class DemoSession {
  state: DemoState = seedState();
  private listeners = new Set<(s: DemoState) => void>();
  /** Agent runs in flight (an adapt can start while an ask is still running). */
  private runs = new Set<AbortController>();
  /** Study plans being written. They never set `busy`: the phone and the teacher keep working. */
  private planners = new Set<AbortController>();
  private planning = new Set<Promise<void>>();
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
    if (question.length > 500) return { ok: false, status: 400, error: 'Please keep questions under 500 characters.' };
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
        if (i < 0) st.plans.push(out.plan);
        else if (st.plans[i].status === 'proposed') st.plans[i] = out.plan;
      }
    });
    return { ok: true, conversationId: id, done };
  }

  edit(planId: string, index: number, change: { time?: string; remove?: boolean }): Done { return this.run(R.editPlan(this.state, planId, index, change)); }
  approve(planId: string): Done {
    const out = this.run(R.approvePlan(this.state, planId));
    const plan = R.planById(this.state, planId);
    if (out.ok && plan?.kind === 'pathway' && this.state.study[plan.studentIds[0]]?.reported) this.weigh(plan.studentIds[0], 'teacherPlan');
    return out;
  }
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

  studyOpen(): Done { return this.run(S.openPick(this.state)); }
  studyPick(id: string): Done { return this.run(S.pickStudent(this.state, id)); }
  studyTab(tab: S.StudyTab): Done { return this.run(S.showTab(this.state, tab)); }
  studyPractice(clo: CloId | null): Done { return this.run(S.startSelf(this.state, clo)); }
  studyRate(cardId: string, rating: CardRating): Done { return this.run(S.rateCard(this.state, cardId, rating)); }
  studyCheckIn(): Done { return this.run(S.openCheckIn(this.state)); }
  nextDay(check: StudyDay['check']): Done { return this.moved(S.advance(this.state, 1, check)); }
  nextWeek(): Done { return this.moved(S.advance(this.state, 7, null)); }
  simulateDrop(): Done { return this.moved(S.simulateDrop(this.state)); }

  /** Saves the student's time and writes the first plan. */
  studySetup(weekday: number, weekend: number): Done {
    const out = this.run(S.saveSetup(this.state, weekday, weekend));
    if (out.ok) this.weigh(this.state.phone.studentId!, 'setup');
    return out;
  }

  /** Settles when no study plan is being written. */
  async settled(): Promise<void> {
    await Promise.all(this.planning);
  }

  private moved(r: S.StudyResult): Done {
    const out = this.run(r);
    if (r.ok) this.weigh(r.state.phone.studentId!, r.signal);
    return out;
  }

  /** What a signal means today: a replan now, or held until the cooldown ends (checked on the next Next day or Next week) or while a plan is being written. */
  private weigh(studentId: string, raised: ReplanSignal | null) {
    const rec = this.state.study[studentId];
    const { run, hold } = nextReplan(rec, raised, this.state.day);
    if (run && !rec.planning) {
      this.replan(studentId, run);
      return;
    }
    this.update(this.state.epoch, (st) => { st.study[studentId].pendingSignal = run ?? hold; });
  }

  /** Writes a plan in the background. A failed replan keeps the current plan and leaves the signal pending. */
  private replan(studentId: string, signal: ReplanSignal) {
    const epoch = this.state.epoch;
    const abort = new AbortController();
    this.planners.add(abort);
    this.update(epoch, (st) => { Object.assign(st.study[studentId], { planning: { steps: [] }, pendingSignal: null }); });
    const giveUp = () => this.update(epoch, (st) => { Object.assign(st.study[studentId], { planning: null, pendingSignal: kept(st.study[studentId].pendingSignal) ? st.study[studentId].pendingSignal : signal }); });
    const run: Promise<void> = planStudy(structuredClone(this.state), studentId, signal, {
      client: this.client,
      signal: abort.signal,
      onStep: (line) => this.update(epoch, (st) => { st.study[studentId].planning?.steps.push(line); }),
    })
      .then((plan) => {
        if (plan) this.update(epoch, (st) => S.applyPlan(st, studentId, plan, signal));
        else giveUp();
      })
      .catch((e) => {
        if (abort.signal.aborted) return; // reset: its result is dropped on purpose
        console.warn('[beyond] study planning failed:', e instanceof Error ? e.message : e);
        giveUp();
      })
      .finally(() => {
        this.planners.delete(abort);
        this.planning.delete(run);
      });
    this.planning.add(run);
  }

  /** Back to the seed for the next visitor; a run in flight is aborted and its result dropped. */
  reset(): void {
    for (const run of this.runs) run.abort();
    this.runs.clear();
    for (const run of this.planners) run.abort();
    this.planners.clear();
    this.set(seedState(this.state.epoch + 1));
  }
}
