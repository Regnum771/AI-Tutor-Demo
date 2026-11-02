import { describe, expect, it } from 'vitest';
import { STUDENTS, groupOf } from '../scenario/classroom';
import { MASTERY_INITIAL } from '../scenario/minhAnh';
import { fmt, parseTime, STORY_START, TONIGHT } from './clock';
import { stateWithPlan } from './fixtures';
import { afterAnswer, gainFor, statusFor, topicMastery, twinConcepts } from './mastery';

describe('story clock', () => {
  it('formats and parses HH:MM', () => {
    expect(fmt(STORY_START)).toBe('15:00');
    expect(fmt(TONIGHT)).toBe('20:40');
    expect(fmt(9 * 60 + 5)).toBe('09:05');
    expect(parseTime('19:30')).toBe(19 * 60 + 30);
    expect(parseTime(' 07:00 ')).toBe(420);
    expect(parseTime('7pm')).toBeNull();
    expect(parseTime('24:00')).toBeNull();
  });
});

describe('mastery rule', () => {
  it('earns less on each try: 30%, 15%, 5%, then nothing', () => {
    expect([1, 2, 3, 4, 9].map(gainFor)).toEqual([0.3, 0.15, 0.05, 0, 0]);
  });
  it('moves a correct answer toward 0.9 by its try, not at all when wrong', () => {
    expect(afterAnswer(0.3, true, 1)).toBe(0.48);
    expect(afterAnswer(0.3, true, 2)).toBe(0.39);
    expect(afterAnswer(0.3, true, 3)).toBe(0.33);
    expect(afterAnswer(0.3, true, 4)).toBe(0.3);
    expect(afterAnswer(0.3, false, 1)).toBe(0.3);
    expect(afterAnswer(0.97, true, 1)).toBe(0.97);
    expect(afterAnswer(0.97, true, 2)).toBe(0.97);
  });
  it('bands status on logical equivalence', () => {
    const m = (equivalence: number) => ({ ...MASTERY_INITIAL, equivalence });
    expect(topicMastery(m(0.5))).toBe(0.5);
    expect(statusFor(m(0.41))).toBe('highRisk');
    expect(statusFor(m(0.42))).toBe('support');
    expect(statusFor(m(0.59))).toBe('support');
    expect(statusFor(m(0.6))).toBe('onTrack');
  });
  it('the roster statuses already agree with the bands', () => {
    for (const s of STUDENTS) expect(statusFor({ ...MASTERY_INITIAL, equivalence: s.mastery }), s.name).toBe(s.status);
  });
});

describe('twinConcepts', () => {
  const sessions = [{ time: '15:30', title: 'Laws', minutes: 8, concept: 'equivLaws' as const, isMasteryCheck: true, studentId: null }];
  it('is the Week 6 focus plus what the student’s plans practise, once each', () => {
    const base = twinConcepts(stateWithPlan(), 's17');
    expect(base).toContain('equivalence');
    expect(base).not.toContain('equivLaws');
    expect(twinConcepts(stateWithPlan('pathway', { sessions }), 's17')).toEqual([...base, 'equivLaws']);
  });
  it('ignores dismissed plans and other students’ plans', () => {
    const base = twinConcepts(stateWithPlan(), 's17');
    expect(twinConcepts(stateWithPlan('pathway', { sessions, status: 'dismissed' }), 's17')).toEqual(base);
    expect(twinConcepts(stateWithPlan('pathway', { sessions }), 's29')).toEqual(base);
  });
});

describe('groupOf', () => {
  it('puts Minh Anh (index 16) in G4', () => {
    expect(groupOf(16)).toBe('G4');
  });
});
