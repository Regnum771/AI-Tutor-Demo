import { describe, expect, it } from 'vitest';
import { playOut, stateWithPlan } from '../live/fixtures';
import { approvePlan, phoneAnswer, phoneContinue, phoneFinish, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result } from '../live/reducer';
import type { DemoState } from '../live/types';
import { sessionItems } from '../scenario/practiceBank';
import { notificationCopy, planView, progressView, reviewView } from './liveView';

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
    const s = ok(phoneContinue(ok(playOut(ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1))))));
    const p = progressView(s)!;
    expect(p).toMatchObject({ concept: 'Logical equivalence', from: 35, accuracy: 100, done: 2, remaining: null, backLabel: 'Back to plan' });
    expect(p.to).toBeGreaterThan(60);
  });
  it('accuracy leaves out the rows Skip wrote', () => {
    let s = ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1));
    const [first, ...rest] = sessionItems('equivalence', true);
    const wrong = first.correct === 0 ? 1 : 0;
    s = ok(phoneNext(ok(phoneAnswer(ok(phoneAnswer(s, wrong)), first.correct))));
    s = ok(phoneNext(ok(phoneAnswer(s, rest[0].correct))));
    s = ok(phoneAnswer(s, rest[1].correct));
    // Four answers, three of them correct: the skipped rows do not count.
    expect(progressView(s)?.accuracy).toBe(75);
  });
  it('accuracy counts only this plan’s session answers, wrong ones as wrong, and leaves self-practice out', () => {
    const base = sent();
    base.plans[0].sessions.forEach((x) => { x.concept = 'deMorgan'; });
    base.students.find((x) => x.id === 's17')!.evidence.push(
      { id: 's17-practice-self', kind: 'practice', source: 'Beyond practice', when: '09:00', concept: 'deMorgan', text: 'De Morgan: “a correct negation?” · correct first try' },
    );
    const s = ok(playOut(ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(base)))), 1)), true));
    // Three wrong, three right, in this plan's session: half. The self-practice row and the skipped rows do not count.
    expect(progressView(s)?.accuracy).toBe(50);
  });
  it('the review lists each question with its tries in order, the answer and the hint for each wrong choice', () => {
    let s = ok(phoneOpen(sent(), 0));
    const [first, second] = sessionItems('implication', false);
    const wrong = first.correct === 0 ? 1 : 0;
    s = ok(phoneAnswer(ok(phoneAnswer(s, wrong)), first.correct));
    s = ok(phoneAnswer(ok(phoneNext(s)), second.correct));
    const v = reviewView(ok(phoneFinish(s)));
    expect(v.summary).toBe('2 questions · 1 right first try · 3 tries in all');
    expect(v.rows[0]).toMatchObject({
      prompt: first.prompt,
      tries: [{ option: first.options[wrong], right: false }, { option: first.options[first.correct], right: true }],
      answer: first.options[first.correct],
      hints: [{ option: first.options[wrong], hint: first.hints[wrong] }],
      guided: first.guided,
    });
    expect(v.rows[1].hints).toEqual([]);
  });
  it('the summary reads naturally for one question and one try', () => {
    const s = sent();
    s.phone.sheet = [{ itemId: 'implication-1', tries: [1], rightOn: 1, reopened: false }];
    expect(reviewView(s).summary).toBe('1 question · 1 right first try · 1 try in all');
  });
  it('offers Skip to tonight only on a plan for today', () => {
    const s = sent();
    s.plans[0].day = 'Tomorrow';
    s.plans[0].date = s.day + 1;
    expect(planView(s)?.canSkip).toBe(false);
  });
});
