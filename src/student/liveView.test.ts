import { describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { approvePlan, phoneAnswer, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result } from '../live/reducer';
import type { DemoState } from '../live/types';
import { sessionItems } from '../scenario/practiceBank';
import { notificationCopy, planView, progressView } from './liveView';

const ok = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const sent = () => ok(approvePlan(stateWithPlan(), 'p1'));

describe('phone views', () => {
  it('plan view and notification copy for a delivered plan', () => {
    expect(planView(sent())).toEqual({
      name: 'Minh Anh', heading: 'Learning pathway · today', topic: 'Logical equivalence',
      objectives: ['Implication', 'Logical equivalence'],
      items: [{ title: 'Review implication', when: 'Today 15:30', mins: 8 }, { title: 'Mastery check', when: 'Today 20:00', mins: 10 }],
      done: [], next: 0, canSkip: true,
    });
    expect(notificationCopy(sent())).toEqual({ title: 'Your personalized plan is ready', body: '2 short sessions today to strengthen implication & logical equivalence.' });
    expect(planView(stateWithPlan())).toBeNull();
  });
  it('progress view after the mastery check', () => {
    let s = ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1));
    for (const item of sessionItems('equivalence', true)) s = ok(phoneNext(ok(phoneAnswer(s, item.correct))));
    const p = progressView(s)!;
    expect(p).toMatchObject({ concept: 'Logical equivalence', from: 35, accuracy: 100, done: 2, remaining: null, backLabel: 'Back to plan' });
    expect(p.to).toBeGreaterThan(60);
  });
  it('accuracy leaves out the rows Skip wrote', () => {
    let s = ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1));
    const [first, ...rest] = sessionItems('equivalence', true);
    const wrong = first.correct === 0 ? 1 : 0;
    s = ok(phoneNext(ok(phoneAnswer(ok(phoneAnswer(s, wrong)), first.correct))));
    for (const item of rest) s = ok(phoneNext(ok(phoneAnswer(s, item.correct))));
    // Four answers, three of them correct: the skipped rows do not count.
    expect(progressView(s)?.accuracy).toBe(75);
  });
  it('offers Skip to tonight only on a plan for today', () => {
    const s = sent();
    s.plans[0].day = 'Tomorrow';
    s.plans[0].date = s.day + 1;
    expect(planView(s)?.canSkip).toBe(false);
  });
});
