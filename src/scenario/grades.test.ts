import { describe, expect, it } from 'vitest';
import { seedState } from '../live/seed';
import { gpaOf, historyFor, letterOf, pointsOf } from './grades';

describe('grades', () => {
  it('converts 10-point grades at each boundary', () => {
    expect([10, 8.5, 8.4, 8.0, 7.9, 7.0, 6.9, 6.5, 6.4, 5.5, 5.4, 5.0, 4.9, 4.0, 3.9].map(letterOf))
      .toEqual(['A', 'A', 'B+', 'B+', 'B', 'B', 'C+', 'C+', 'C', 'C', 'D+', 'D+', 'D', 'D', 'F']);
    expect([8.5, 8.0, 7.0, 6.5, 5.5, 5.0, 4.0, 3.9].map(pointsOf)).toEqual([4, 3.5, 3, 2.5, 2, 1.5, 1, 0]);
  });
  it('averages grade points, all subjects 3 credits', () => {
    expect(gpaOf([{ subject: 'A', term: 't', grade: 8.5, letter: 'A' }, { subject: 'B', term: 't', grade: 6.8, letter: 'C+' }])).toBe(3.25);
    expect(gpaOf([])).toBe(0);
  });
  it('gives every student 4–5 subjects, and Minh Anh the C+ in Intro to Logic', () => {
    expect(historyFor(3, 0.7).length).toBeGreaterThanOrEqual(4);
    const s = seedState();
    for (const st of s.students) expect(st.history.length).toBeGreaterThanOrEqual(4);
    const ma = s.students.find((x) => x.id === 's17')!;
    expect(ma.history.find((h) => h.subject === 'Introduction to Logic')).toMatchObject({ grade: 6.8, letter: 'C+' });
    expect(ma.gpa).toBe(gpaOf(ma.history));
  });
});
