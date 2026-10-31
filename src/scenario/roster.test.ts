import { describe, expect, it } from 'vitest';
import { classKpis, statusFor } from '../live/mastery';
import { STUDENTS } from './classroom';
import { MASTERY_INITIAL } from './minhAnh';
import { buildRoster, classEvidence } from './roster';

const round2 = (v: number) => Math.round(v * 100) / 100;

describe('roster', () => {
  const roster = buildRoster();

  it('is deterministic and has 55 students', () => {
    expect(roster).toHaveLength(55);
    expect(buildRoster()).toEqual(roster);
  });
  it('reproduces the Classroom figures', () => {
    const k = classKpis(roster);
    expect(k.needSupport).toBe(12);
    expect(k.highRisk).toBe(5);
    expect(k.escalated).toBe(3);
    expect(k.avgMastery).toBe(round2(STUDENTS.reduce((a, s) => a + s.mastery, 0) / 55));
  });
  it('keeps every student, status and topic figure from the scripted roster', () => {
    roster.forEach((p, i) => {
      expect(p.name).toBe(STUDENTS[i].name);
      expect(p.status).toBe(STUDENTS[i].status);
      expect(p.status).toBe(statusFor(p.mastery));
      expect(p.mastery.equivalence).toBe(STUDENTS[i].mastery);
    });
  });
  it('keeps Minh Anh hand-written', () => {
    const ma = roster[16];
    expect(ma.short).toBe('Minh Anh');
    expect(ma.group).toBe('G4');
    expect(ma.mastery).toEqual(MASTERY_INITIAL);
    expect(ma.quiz).toEqual({ q1: 75, q2: 42 });
    expect(ma.evidence.map((e) => e.id)).toContain('s17-quiz2-q4');
  });
  it('has unique, student-prefixed evidence ids and mastery within 0..1', () => {
    const ids = [...roster.flatMap((p) => p.evidence.map((e) => e.id)), ...classEvidence(roster).map((e) => e.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of roster) {
      for (const e of p.evidence) expect(e.id.startsWith(`${p.id}-`), e.id).toBe(true);
      for (const v of Object.values(p.mastery)) expect(v >= 0 && v <= 1).toBe(true);
    }
    for (const e of classEvidence(roster)) expect(e.id.startsWith('class-')).toBe(true);
  });
  it('gives the quirk students their stories', () => {
    expect(roster[7].evidence.some((e) => e.kind === 'taNote')).toBe(true);
    expect(roster[41].evidence.find((e) => e.id === 's42-attendance')?.text).toContain('3 of 6');
    expect(roster[30].quiz.q2).toBeGreaterThan(90);
  });
  it('derives the class evidence from the students, so the two always agree', () => {
    for (const p of roster) expect(roster.length && /^Attended \d of 6 tutorials/.test(p.evidence.find((e) => e.id === `${p.id}-attendance`)!.text), p.name).toBe(true);
    const n = roster.length;
    const converse = roster.filter((p) => p.mastery.implication < 0.5).length;
    const avg = Math.round(roster.reduce((a, p) => a + p.quiz.q2, 0) / n);
    const byId = Object.fromEntries(classEvidence(roster).map((e) => [e.id, e.text]));
    expect(Object.keys(byId)).toEqual(['class-quiz2-q4', 'class-quiz2-avg', 'class-attendance', 'class-demorgan']);
    expect(byId['class-quiz2-q4']).toContain(`${converse} of ${n} chose the converse`);
    expect(byId['class-quiz2-avg']).toBe(`Quiz 2 class average ${avg}%`);
    expect(byId['class-demorgan']).toContain(`${roster.filter((p) => p.mastery.deMorgan < 0.5).length} of ${n}`);
  });
  it('gives every quirk student their story', () => {
    const has = (i: number, id: string) => roster[i].evidence.some((e) => e.id === id);
    expect(has(12, 's13-ta') && has(26, 's27-email') && has(28, 's29-adaptive') && has(28, 's29-ta') && has(45, 's46-officehours') && has(50, 's51-trend')).toBe(true);
    expect(roster[45].quiz).toEqual({ q1: 38, q2: 55 });
    expect(roster[50].quiz).toEqual({ q1: 61, q2: 38 });
  });
});
