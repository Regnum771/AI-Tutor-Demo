import { renderToStaticMarkup as html } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { planFor, stateWithPlan } from '../live/fixtures';
import { seedState } from '../live/seed';
import { advance, openPick, pickStudent, saveSetup, type StudyResult } from '../live/study/reducer';
import type { DemoState } from '../live/types';
import { MasteryChart } from './MasteryChart';
import { DEFAULT_CONCEPT, masterySeries, pastLectures, planMarkers, upcomingLectures } from './planningModel';

const ok = (r: StudyResult): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

describe('mastery chart', () => {
  const points = masterySeries(seedState(), 'implication');
  it('draws the series, the 0.50 gap line, a tick per lecture and the exam', () => {
    const out = html(<MasteryChart concept="implication" label="Implication" points={points} markers={[]} />);
    expect(out).toContain('data-series="mastery"');
    expect(out).toContain('data-concept="implication"');
    expect(out).toContain('data-gap-line');
    expect(out).toContain('Gap 0.50');
    expect(out.match(/data-tick="/g)).toHaveLength(9);
    expect(out).toMatch(/data-tick="7"[^>]*>L7</);
    expect(out).toContain('>Exam<');
    expect(out.match(/data-point="/g)).toHaveLength(points.length);
  });
  it('puts intervention labels on their own row along the top', () => {
    const out = html(<MasteryChart concept="implication" label="Implication" points={points} markers={[{ day: 40, label: 'Pathway', row: 'intervention' }, { day: 40, label: 'Check-ins', row: 'intervention' }]} />);
    expect(out).toMatch(/data-marker-row="intervention"[^>]*>Pathway</);
    expect(out).toMatch(/data-marker-row="intervention"[^>]*>Check-ins</);
  });
  it('stacks a marker above earlier ones that are close by, even on the next day, and not those far away', () => {
    const ys = (days: number[]) => {
      const out = html(<MasteryChart concept="implication" label="Implication" points={points} markers={days.map((day, i) => ({ day, label: `M${i}`, row: 'intervention' as const }))} />);
      return [...out.matchAll(/data-marker-row="intervention"[^>]*? y="([^"]+)"/g)].map((m) => m[1]);
    };
    const adjacent = ys([45, 46]);
    expect(adjacent).toHaveLength(2);
    expect(adjacent[0]).not.toBe(adjacent[1]);
    const far = ys([20, 45]);
    expect(far[0]).toBe(far[1]);
  });
});

describe('the chart’s data', () => {
  it('shows the seeded points only until a live day closes, then joins the live points', () => {
    const s = seedState();
    expect(DEFAULT_CONCEPT).toBe('equivalence');
    expect(masterySeries(s, 'equivalence').map((p) => p.day)).toEqual([0, 7, 14, 21, 28, 35, 40]);
    const after = ok(advance(ok(saveSetup(ok(pickStudent(ok(openPick(s)), 's17')), 30, 60)), 2, null));
    expect(masterySeries(after, 'equivalence').map((p) => p.day)).toEqual([0, 7, 14, 21, 28, 35, 40, 41, 42]);
  });
  it('keeps the seeded weeks fixed when the class changes live', () => {
    const s = seedState();
    const before = masterySeries(s, 'propositions');
    for (const st of s.students) st.mastery.propositions = 0.1;
    expect(masterySeries(s, 'propositions')).toEqual(before);
  });
  it('marks pathways sent, class activities approved and check-ins booked, not proposals or dismissals', () => {
    expect(planMarkers(stateWithPlan())).toEqual([]);
    expect(planMarkers(stateWithPlan('pathway', { status: 'sent' }))).toEqual([{ day: 40, label: 'Pathway', row: 'intervention' }]);
    const s = stateWithPlan('classActivity', { status: 'approved' });
    s.plans.push(planFor('checkIns', { id: 'p2', status: 'approved' }), planFor('pathway', { id: 'p3', status: 'dismissed' }), planFor('pathway', { id: 'p4', status: 'done', date: 41 }));
    expect(planMarkers(s)).toEqual([
      { day: 45, label: 'Class activity', row: 'intervention' },
      { day: 46, label: 'Check-ins', row: 'intervention' },
      { day: 41, label: 'Pathway', row: 'intervention' },
    ]);
  });
});

describe('which lectures the tab lists', () => {
  const ns = (ls: { n: number }[]) => ls.map((l) => l.n);
  it('takes the next lecture and the two after it, and the rest as past lectures, newest first', () => {
    expect(ns(upcomingLectures(40, '15:00', null))).toEqual([7, 8, 9]);
    expect(ns(pastLectures(40, '15:00', null))).toEqual([6, 5, 4, 3, 2, 1]);
    expect(ns(upcomingLectures(43, '10:00', null))).toEqual([8, 9]);
    expect(ns(pastLectures(43, '10:00', null))).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(upcomingLectures(57, '10:00', null)).toEqual([]);
  });
  it('with a concept, keeps the coming lectures with material on it plus the lecture that taught it', () => {
    expect(ns(upcomingLectures(40, '15:00', 'implication'))).toEqual([5, 9]);
    expect(ns(upcomingLectures(40, '15:00', 'equivLaws'))).toEqual([7, 9]);
    expect(ns(upcomingLectures(40, '15:00', 'applications'))).toEqual([8, 9]);
    expect(pastLectures(40, '15:00', 'implication')).toEqual([]);
  });
});
