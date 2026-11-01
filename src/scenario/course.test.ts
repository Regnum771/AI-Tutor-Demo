import { describe, expect, it } from 'vitest';
import { ASSESSMENTS, CLOS, EXAM_DAY, LECTURES, REVISION_START, START_DAY, cloOf, fullDate, lectureBefore, lectureLabel, nextAssessment, relativeDay, resolveDay, shortDate, studyDays, weekOf } from './course';
import { CONCEPTS } from './knowledgeGraph';

describe('course calendar', () => {
  it('places the story and the exam on the right dates', () => {
    expect(fullDate(START_DAY)).toBe('Saturday, 31 October');
    expect(shortDate(EXAM_DAY)).toBe('Tue 24 Nov');
    expect(weekOf(START_DAY)).toBe(6);
    expect(weekOf(EXAM_DAY)).toBe(10);
    expect(weekOf(REVISION_START)).toBe(9);
    expect(fullDate(REVISION_START)).toBe('Monday, 16 November');
    expect(studyDays(START_DAY)).toHaveLength(24);
    expect(studyDays(EXAM_DAY)).toEqual([]);
  });
  it('fixes every assessment date', () => {
    expect(ASSESSMENTS.map((a) => shortDate(a.day))).toEqual(['Thu 8 Oct', 'Fri 16 Oct', 'Thu 29 Oct', 'Fri 6 Nov', 'Thu 12 Nov', 'Tue 24 Nov']);
    expect(nextAssessment(START_DAY)?.id).toBe('a2');
  });
  it('resolves day labels against today', () => {
    expect(resolveDay('Today', 40)).toBe(40);
    expect(resolveDay('Tomorrow', 40)).toBe(41);
    expect(resolveDay('Thursday', 40)).toBe(45);
    expect(resolveDay('Saturday', 40)).toBe(47);
    expect(resolveDay('nonsense', 40)).toBe(40);
    expect(relativeDay(40, 40)).toBe('Today');
    expect(relativeDay(41, 40)).toBe('Tomorrow');
    expect(relativeDay(45, 40)).toBe('Thu 5 Nov');
  });
});

describe('CLOs', () => {
  it('cover every concept once, span 3 consecutive Bloom levels and add to 100%', () => {
    expect(CLOS.flatMap((c) => c.concepts).sort()).toEqual(CONCEPTS.map((c) => c.id).sort());
    const ladder = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];
    for (const c of CLOS) {
      const i = ladder.indexOf(c.levels[0]);
      expect(c.levels).toEqual(ladder.slice(i, i + 3));
    }
    expect(CLOS.reduce((a, c) => a + c.share, 0)).toBeCloseTo(1);
    expect(cloOf('applications').id).toBe('CLO3');
  });
});

describe('lectures', () => {
  it('runs one lecture a week on Tuesday, Lectures 1–9', () => {
    expect(LECTURES.map((l) => l.day)).toEqual([1, 8, 15, 22, 29, 36, 43, 50, 57]);
    expect(shortDate(LECTURES[4].day)).toBe('Tue 20 Oct');
    expect(LECTURES[4]).toMatchObject({ n: 5, title: 'Implication', concepts: ['implication'] });
  });
  it('places a message relative to the lecture before it', () => {
    expect(lectureLabel(29, '10:00')).toBe('during Lecture 5');
    expect(lectureLabel(29, '11:20')).toBe('just after Lecture 5');
    expect(lectureLabel(29, '13:30')).toBe('2 hours after Lecture 5');
    expect(lectureLabel(29, '12:05')).toBe('1 hour after Lecture 5');
    expect(lectureLabel(30, '21:40')).toBe('1 day after Lecture 5');
    expect(lectureLabel(31, '08:10')).toBe('2 days after Lecture 5');
    expect(lectureLabel(29, '08:00')).toBe('7 days after Lecture 4');
    expect(lectureLabel(0, '12:00')).toBe('before Lecture 1');
    expect(lectureBefore(0, '12:00')).toBeNull();
  });
});
