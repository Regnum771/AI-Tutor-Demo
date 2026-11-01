import { describe, expect, it } from 'vitest';
import { lectureOf } from '../scenario/course';
import { CONCEPTS } from '../scenario/knowledgeGraph';
import { BEFORE_LECTURE, classAverage, noteClassMastery, seededHistory } from './history';
import { seedState } from './seed';
import { openPick, pickStudent, saveSetup, advance, type StudyResult } from './study/reducer';
import type { DemoState } from './types';

const ok = (r: StudyResult): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const ready = () => ok(saveSetup(ok(pickStudent(ok(openPick(seedState())), 's17')), 30, 60));

describe('class mastery over time', () => {
  it('seeds Weeks 1–6 and day 40: 0–1, 0.20 before each lecture, the class average once lectured', () => {
    const s = seedState();
    const h = seededHistory(s.students);
    for (const c of CONCEPTS) {
      const points = h[c.id];
      expect(points.map((p) => p.day)).toEqual([0, 7, 14, 21, 28, 35, 40]);
      for (const p of points) {
        expect(p.value).toBeGreaterThanOrEqual(0);
        expect(p.value).toBeLessThanOrEqual(1);
        if (p.day < lectureOf(c.id).day) expect(p.value, `${c.id} day ${p.day}`).toBe(BEFORE_LECTURE);
      }
    }
    expect(h.propositions.map((p) => p.value)).toEqual([0.2, 0.488, 0.823, 0.871, 0.871, 0.871, 0.871]);
    expect(h.implication.map((p) => p.value)).toEqual([0.2, 0.2, 0.2, 0.2, 0.2, 0.453, 0.664]);
    expect(h.equivalence.at(-1)!.value).toBe(classAverage(s.students, 'equivalence'));
    expect(h.equivLaws.at(-1)!.value).toBe(BEFORE_LECTURE);
  });
  it('starts the live history empty', () => {
    const s = seedState();
    for (const c of CONCEPTS) expect(s.masteryHistory[c.id]).toEqual([]);
  });
  it('adds one point per concept for each closed day, after forgetting, and a concept waits for its lecture', () => {
    const s = ready();
    s.students[16].mastery.equivalence = 0.95;
    const after = ok(advance(s, 3, null)); // Saturday 40 → Tuesday 43, through Monday 42
    for (const c of CONCEPTS) expect(after.masteryHistory[c.id].map((p) => p.day)).toEqual([41, 42, 43]);
    expect(after.masteryHistory.equivalence[0].value).toBe(classAverage(s.students, 'equivalence'));
    // Monday 42: Minh Anh forgets 0.02 on every lectured concept not practised in the last 7 days.
    expect(after.masteryHistory.equivalence[1].value).toBe(classAverage(after.students, 'equivalence'));
    expect(after.masteryHistory.equivalence[1].value).toBeLessThan(after.masteryHistory.equivalence[0].value);
    expect(after.masteryHistory.equivLaws.map((p) => p.value)).toEqual([BEFORE_LECTURE, BEFORE_LECTURE, classAverage(after.students, 'equivLaws')]);
  });
  it('replaces a point already there for the same day', () => {
    const s = seedState();
    noteClassMastery(s);
    s.students[0].mastery.propositions = 0.1;
    noteClassMastery(s);
    expect(s.masteryHistory.propositions).toEqual([{ day: 40, value: classAverage(s.students, 'propositions') }]);
  });
});
