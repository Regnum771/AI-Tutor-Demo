import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { LockScreen } from './screens/LockScreen';
import { PlanScreen } from './screens/PlanScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SC9 } from '../scenario/practice';

describe('student screens', () => {
  it('lock screen shows the notification only when present', () => {
    expect(html(<LockScreen t={0} notification={1} />)).toContain('Your personalized plan is ready');
    expect(html(<LockScreen t={0} notification={0} />)).not.toContain('Your personalized plan is ready');
  });
  it('plan screen shows the right pathway per variant', () => {
    expect(html(<PlanScreen local={5000} variant="initial" />)).toContain('Review logical operators');
    const updated = html(<PlanScreen local={5000} variant="updated" />);
    expect(updated).toContain('Plan updated');
    expect(updated).toContain('Targeted application practice');
  });
  it('practice marks the wrong answer, shows the hint, then the correct answer', () => {
    expect(html(<PracticeScreen t={SC9.pickWrong + 100} />)).toContain('Not quite');
    expect(html(<PracticeScreen t={SC9.hint + 600} />)).toContain('Hint');
    expect(html(<PracticeScreen t={SC9.pickRight + 100} />)).toContain('Correct!');
  });
  it('guided phase reveals steps ending in p ∧ ¬q', () => {
    expect(html(<PracticeScreen t={SC9.guidedSteps[2] + 900} />)).toContain('p ∧ ¬q');
  });
  it('progress counts implication mastery up to 52%', () => {
    expect(html(<ProgressScreen local={5000} />)).toContain('52%');
  });
});
