import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { stateWithPlan } from '../live/fixtures';
import { approvePlan, phoneAnswer, phoneOpen, type Result } from '../live/reducer';
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
    const wrong = html(<LivePractice state={ok(phoneAnswer(practice(), 0))} onAnswer={() => {}} onNext={() => {}} />);
    expect(wrong).toContain('Not quite');
    expect(wrong).toContain(Q1.hint);
    const right = html(<LivePractice state={ok(phoneAnswer(practice(), 1))} onAnswer={() => {}} onNext={() => {}} />);
    expect(right).toContain('Correct!');
    expect(right).toContain('>Next<');
    expect(right).toContain('Show the next step');
    expect(right).toContain('¬(p → q)');
  });
});
