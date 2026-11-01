import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup as html } from 'react-dom/server';
import { LockScreen } from './screens/LockScreen';
import { greetingFor, PlanScreen } from './screens/PlanScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SC9 } from '../scenario/practice';
import { ThemeScope } from '../ui/theme';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import type { DemoState } from '../live/types';
import { SemesterScreen, TodayScreen } from './screens/StudyScreens';
import { semesterView, todayView } from './studyView';

describe('student screens', () => {
  it('plan screen: serif course title, sans name, one Up next', () => {
    const plan = html(<PlanScreen local={5000} variant="initial" />);
    expect(plan).toMatch(/font-serif[^>]*>Discrete Mathematics</);
    expect(plan).not.toMatch(/font-serif[^>]*>Minh Anh</);
    expect(plan.split('Up next').length - 1).toBe(1);
  });
  it('lock screen shows the notification only when present', () => {
    expect(html(<LockScreen t={0} notification={1} clock="14:58" />)).toContain('Your personalized plan is ready');
    expect(html(<LockScreen t={0} notification={0} clock="14:58" />)).not.toContain('Your personalized plan is ready');
  });
  it('lock screen uses the serif clock and the app mark', () => {
    const lock = html(<LockScreen t={0} notification={1} clock="16:58" />);
    expect(lock).toMatch(/font-serif[^>]*>16:58</);
    expect(lock).toContain('<svg');
    expect(lock).not.toContain('>BT<');
  });
  it('the app mark follows the theme: asterisk (classic), leaf-book with a bud (sage)', () => {
    const classic = html(<LockScreen t={0} notification={1} clock="16:58" />);
    const sage = html(<ThemeScope theme="sage"><LockScreen t={0} notification={1} clock="16:58" /></ThemeScope>);
    expect(classic).toContain('<rect');
    expect(classic).not.toContain('<circle');
    expect(sage).toContain('data-theme="sage"');
    expect(sage).toContain('<circle');
    expect(sage).not.toMatch(/<svg[^>]*>\s*<rect/);
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
  it('guided step labels keep the case of p and q', () => {
    expect(html(<PracticeScreen t={SC9.guidedSteps[2] + 900} />)).not.toMatch(/uppercase[^>]*>Step \d/);
  });
  it('progress counts implication mastery up to 52%', () => {
    expect(html(<ProgressScreen local={5000} />)).toContain('52%');
  });
  it('progress screen: serif title and serif percentage', () => {
    const p = html(<ProgressScreen local={5000} />);
    expect(p).toMatch(/font-serif[^>]*>Your progress</);
    expect(p).toMatch(/<text[^>]*font-serif[^>]*>52%</);
  });
  it('greeting follows the displayed clock', () => {
    expect(greetingFor('09:15')).toBe('Good morning');
    expect(greetingFor('17:00')).toBe('Good afternoon');
    expect(html(<PlanScreen local={5000} variant="updated" clock="20:42" />)).toContain('Good evening');
  });
});

describe('study screens', () => {
  const ready = (): DemoState => {
    const s = seedState();
    const rec = ensureRecord(s, 's17');
    rec.reported = { weekday: 30, weekend: 60 };
    rec.plan = { createdDay: 40, reason: 'Implication first.', leftOut: [], source: 'agents', days: [{ day: 40, minutes: 20, clo: 'CLO1', concepts: ['implication'] }] };
    s.phone = { ...s.phone, studentId: 's17', screen: 'today' };
    return s;
  };
  it('Today shows GPA, marks, the next lecture, assessment and assignment, and never a band or forecast', () => {
    const out = html(<TodayScreen view={todayView(ready())!} onRow={() => {}} onNextDay={() => {}} onNextWeek={() => {}} />);
    for (const text of ['GPA 2.30 of 4', 'Quiz 1 75% · Quiz 2 42%', 'Lecture 7 · Equivalence laws · Tue 3 Nov', 'Quiz 3 · Thu 12 Nov · in 12 days · CLO2, CLO3', 'Assignment 2 · due Fri 6 Nov']) expect(out).toContain(text);
    for (const text of ['Likely', 'At risk', 'Unlikely', 'out of 10']) expect(out).not.toContain(text);
  });
  it('Semester lists previous subjects with grade and letter', () => {
    const out = html(<SemesterScreen view={semesterView(ready())!} />);
    expect(out).toContain('Previous subjects');
    expect(out).toContain('Introduction to Logic · Semester 2 · 2025');
    expect(out).toContain('6.8 · C+');
  });
});
