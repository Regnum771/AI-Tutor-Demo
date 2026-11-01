export interface SubjectGrade { subject: string; term: string; grade: number; letter: string }

/** The usual Vietnamese 10-point → letter → 4-point mapping. */
const SCALE: [min: number, letter: string, points: number][] = [
  [8.5, 'A', 4], [8.0, 'B+', 3.5], [7.0, 'B', 3], [6.5, 'C+', 2.5], [5.5, 'C', 2], [5.0, 'D+', 1.5], [4.0, 'D', 1], [0, 'F', 0],
];
const row = (grade: number) => SCALE.find(([min]) => grade >= min - 1e-9)!;

export const letterOf = (grade: number): string => row(grade)[1];
export const pointsOf = (grade: number): number => row(grade)[2];

/** Mean grade points; every subject is worth 3 credits. */
export const gpaOf = (history: SubjectGrade[]): number =>
  history.length ? Math.round((history.reduce((a, h) => a + pointsOf(h.grade), 0) / history.length) * 100) / 100 : 0;

const SUBJECTS: { subject: string; term: string; offset: number; every?: number }[] = [
  { subject: 'Calculus 1', term: 'Semester 1 · 2025', offset: 0.4 },
  { subject: 'Introduction to Programming', term: 'Semester 1 · 2025', offset: 0.8 },
  { subject: 'Academic English', term: 'Semester 1 · 2025', offset: 1.0, every: 2 },
  { subject: 'Introduction to Logic', term: 'Semester 2 · 2025', offset: -0.3 },
  { subject: 'Linear Algebra', term: 'Semester 2 · 2025', offset: 0.1 },
];

/** Deterministic previous subjects from the student's index and this course's topic mastery. */
export function historyFor(index: number, topic: number): SubjectGrade[] {
  return SUBJECTS.filter((x) => !x.every || index % x.every === 0).map((x, k) => {
    const jitter = (((index * 13 + k * 7) % 7) - 3) / 10;
    const grade = Math.round(Math.min(10, Math.max(0, 3 + topic * 7 + x.offset + jitter)) * 10) / 10;
    return { subject: x.subject, term: x.term, grade, letter: letterOf(grade) };
  });
}
