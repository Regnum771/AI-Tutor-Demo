import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { stateWithPlan } from '../live/fixtures';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { startSelf } from '../live/study/reducer';
import { approvePlan, currentItems, phoneAgain, phoneAnswer, phoneNext, phoneOpen, type Result } from '../live/reducer';
import type { DemoState } from '../live/types';
import { Q1 } from '../scenario/practice';
import { LivePractice } from './screens/LivePractice';
import { LockScreen } from './screens/LockScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ProgressScreen } from './screens/ProgressScreen';

const ok = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const practice = () => ok(phoneOpen(ok(approvePlan(stateWithPlan(), 'p1')), 0));
const noop = () => {};
const screen = (state: DemoState) => html(<LivePractice state={state} onAnswer={noop} onNext={noop} onGoto={noop} onAgain={noop} onFinish={noop} />);
const view = {
  name: 'Minh Anh', heading: 'Learning pathway · today', topic: 'Logical equivalence', objectives: ['Implication', 'Logical equivalence'],
  items: [{ title: 'Review implication', when: 'Today 15:30', mins: 8 }, { title: 'Mastery check', when: 'Today 20:00', mins: 10 }],
  done: [], next: 0, canSkip: true,
};

describe('live phone screens', () => {
  it('the lock-screen notification becomes a button with the plan copy', () => {
    const out = html(<LockScreen t={0} notification={1} clock="15:00" message={{ title: 'Your personalized plan is ready', body: '2 short sessions today.' }} onTap={() => {}} />);
    expect(out).toMatch(/<button type="button" class="[^"]*text-left/);
    expect(out).toContain('2 short sessions today.');
  });
  it('the plan screen lists live sessions as buttons, with Skip to tonight', () => {
    const out = html(<PlanScreen local={5000} variant="initial" clock="15:00" live={view} onOpen={() => {}} onSkip={() => {}} />);
    expect(out).toContain('Review implication');
    expect(out).toContain('Today 20:00 · 10 min');
    expect(out.split('Up next').length - 1).toBe(1);
    expect(out).toContain('Skip to tonight');
    expect(out).toMatch(/<button type="button" class="relative flex/);
    const done = html(<PlanScreen local={5000} variant="initial" live={{ ...view, done: [0], next: 1, canSkip: false }} onOpen={() => {}} />);
    expect(done).toContain('✓');
    expect(done).not.toContain('Skip to tonight');
  });
  it('the progress screen shows live figures and a way back', () => {
    const out = html(<ProgressScreen local={5000} live={{ concept: 'Logical equivalence', from: 35, to: 71, accuracy: 100, items: [{ title: 'A', when: '15:30' }], done: 1, remaining: null, backLabel: 'Back to plan' }} onBack={() => {}} />);
    expect(out).toMatch(/<text[^>]*>71%</);
    expect(out).toContain('Back to plan');
  });
  it('a finished plan ends with a closing line, not a dead end', () => {
    const out = html(<PlanScreen local={5000} variant="initial" live={{ ...view, done: [0, 1], next: null, canSkip: false }} onOpen={() => {}} />);
    expect(out).toContain('All done for now');
    expect(out).not.toContain('Up next');
  });
  it('practice: a wrong answer shows that option’s hint; a right one shows Next and the worked rewrite', () => {
    const wrong = screen(ok(phoneAnswer(practice(), 0)));
    expect(wrong).toContain('Not quite');
    expect(wrong).toContain(Q1.hint);
    const right = screen(ok(phoneAnswer(practice(), 1)));
    expect(right).toContain('Correct!');
    expect(right).toContain('>Next<');
    expect(right).toContain('Show the next step');
    expect(right).toContain('¬(p → q)');
  });
  it('practice: a dot per question, grey, outlined after a try, green once right', () => {
    const fresh = screen(practice());
    expect(fresh.match(/data-dot="empty"/g)).toHaveLength(2);
    expect(screen(ok(phoneAnswer(practice(), 0))).match(/data-dot="tried"/g)).toHaveLength(1);
    expect(screen(ok(phoneAnswer(practice(), 1))).match(/data-dot="right"/g)).toHaveLength(1);
  });
  it('practice: Next is always there, and Back only after the first question', () => {
    const first = screen(practice());
    expect(first).toContain('>Next<');
    expect(first).not.toContain('>Back<');
    expect(screen(ok(phoneNext(practice())))).toContain('>Back<');
  });
  it('practice: an answered question shows its try and Answer again; Answer again clears the options', () => {
    const wrongThenRight = ok(phoneAnswer(ok(phoneAnswer(practice(), 0)), 1));
    const answered = screen(wrongThenRight);
    expect(answered).toContain('Correct on try 2');
    expect(answered).toContain('Answer again');
    expect(answered).not.toContain('Not quite');
    const cleared = screen(ok(phoneAgain(wrongThenRight)));
    expect(cleared).not.toContain('Correct!');
    expect(cleared).not.toContain('Correct on try');
    expect(cleared).not.toContain('Show the next step');
  });
  it('practice: an open question keeps every tried option marked and hints at the last one', () => {
    const out = screen(ok(phoneAnswer(ok(phoneAnswer(practice(), 0)), 2)));
    expect(out.match(/Not quite/g)).toHaveLength(2);
  });
  it('practice: a wrong re-answer is marked and hinted, and the question stays right', () => {
    const out = screen(ok(phoneAnswer(ok(phoneAgain(ok(phoneAnswer(practice(), 1)))), 0)));
    expect(out).toContain('Correct on try 1');
    expect(out).toContain('Not quite');
    expect(out).toContain(Q1.hint);
  });
  it('practice: the last question offers Finish, or says how many are left', () => {
    expect(screen(ok(phoneNext(practice())))).toContain('2 questions left');
    const firstRight = ok(phoneNext(ok(phoneAnswer(practice(), 1))));
    expect(screen(firstRight)).toContain('1 question left');
    expect(screen(ok(phoneAnswer(firstRight, currentItems(firstRight)[1].correct)))).toContain('Finish session');
  });
});

describe('self-started practice', () => {
  const self = () => {
    const s = seedState();
    const rec = ensureRecord(s, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    s.phone.studentId = 's17';
    const r = startSelf(s, 'CLO1');
    if (!r.ok) throw new Error(r.error);
    return r.state;
  };
  it('shows the Bloom level and counts to 5', () => {
    const out = screen(self());
    expect(out).toContain('Practice · Understand');
    expect(out).toContain('1 / 5');
    expect(out.match(/data-dot=/g)).toHaveLength(5);
  });
});
