import { currentItems, slotCount } from '../src/live/reducer';
import type { DemoSession } from './session';

const must = (r: { ok: true } | { ok: false; error: string }) => {
  if (!r.ok) throw new Error(r.error);
};

/** Plays the session open on the phone through its review, tapping like a visitor: every answer right, a wrong tap first when asked. Used by tests, evals and the smoke run. */
export async function playOpenSession(session: DemoSession, wrongFirst = false): Promise<void> {
  for (;;) {
    const { item: slot } = session.state.phone;
    const item = currentItems(session.state)[slot];
    if (wrongFirst) must(session.phoneAnswer(item.correct === 0 ? 1 : 0));
    must(session.phoneAnswer(item.correct));
    if (slot + 1 >= slotCount(session.state)) break;
    must(session.phoneNext());
  }
  const finished = session.phoneFinish();
  if (!finished.ok) throw new Error(finished.error);
  await finished.done;
  must(session.phoneContinue());
}
