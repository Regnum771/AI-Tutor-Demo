import { describe, expect, it } from 'vitest';
import { STUDENTS, groupOf } from '../scenario/classroom';
import { MASTERY_INITIAL } from '../scenario/minhAnh';
import { fmt, parseTime, STORY_START, TONIGHT } from './clock';
import { afterAnswer, statusFor, topicMastery } from './mastery';

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
  it('moves a correct answer toward 0.9, less after a hint, not at all when wrong', () => {
    expect(afterAnswer(0.3, true, false)).toBe(0.48);
    expect(afterAnswer(0.3, true, true)).toBe(0.39);
    expect(afterAnswer(0.3, false, false)).toBe(0.3);
    expect(afterAnswer(0.3, false, true)).toBe(0.3);
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

describe('groupOf', () => {
  it('puts Minh Anh (index 16) in G4', () => {
    expect(groupOf(16)).toBe('G4');
  });
});
