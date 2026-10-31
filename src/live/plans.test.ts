import { describe, expect, it } from 'vitest';
import { planFor, stateWithPlan } from './fixtures';
import { planProblems, withinFollowUpPolicy } from './plans';
import { seedState } from './seed';

describe('planProblems', () => {
  const state = seedState();

  it('accepts the fixture plans', () => {
    expect(planProblems(planFor('pathway'), state)).toEqual([]);
    expect(planProblems(planFor('classActivity'), state)).toEqual([]);
    expect(planProblems(planFor('checkIns'), state)).toEqual([]);
  });
  it('rejects Today sessions that are not after the story clock', () => {
    const p = planFor('pathway');
    p.sessions[0].time = '14:30';
    expect(planProblems(p, state)).toEqual(['Session 1 at 14:30 is not after now (15:00).']);
    expect(planProblems({ ...p, day: 'Tomorrow' }, state)).toEqual([]);
  });
  it('rejects malformed times and unknown students', () => {
    const p = planFor('pathway', { studentIds: ['s99'] });
    p.sessions[0].time = '7pm';
    expect(planProblems(p, state)).toEqual(['Unknown student id s99.', 'Session 1: time "7pm" is not HH:MM.']);
  });
  it('enforces the pathway policy', () => {
    const long = planFor('pathway');
    long.sessions = [0, 1, 2, 3, 4].map((i) => ({ ...long.sessions[0], time: `${16 + i}:00`, minutes: 10, isMasteryCheck: i === 4 }));
    expect(planProblems(long, state)).toEqual(['At most 4 sessions.', 'Total 50 minutes is over the 45-minute limit.']);
    const noCheck = planFor('pathway');
    noCheck.sessions[1].isMasteryCheck = false;
    expect(planProblems(noCheck, state)).toEqual(['The last session must be the mastery check.']);
    const noBank = planFor('pathway');
    noBank.sessions[0].concept = null;
    expect(planProblems(noBank, state)).toEqual(['Session 1: concept none has no practice items.']);
  });
  it('needs a valid student on every check-in', () => {
    const p = planFor('checkIns');
    p.sessions[1].studentId = null;
    expect(planProblems(p, state)).toEqual(['Check-in 2 needs a valid student id.']);
  });
  it('auto-approves only small pathway follow-ups', () => {
    expect(withinFollowUpPolicy(planFor('pathway'), state)).toBe(true);
    expect(withinFollowUpPolicy(planFor('classActivity'), state)).toBe(false);
    const four = planFor('pathway');
    four.sessions = [0, 1, 2, 3].map((i) => ({ ...four.sessions[0], time: `1${6 + i}:00`, minutes: 8, isMasteryCheck: i === 3 }));
    expect(withinFollowUpPolicy(four, state)).toBe(false);
  });
});

describe('seedState', () => {
  it('starts at 15:00 with an idle phone and fresh copies', () => {
    const a = seedState();
    const b = seedState();
    a.students[0].mastery.equivalence = 0;
    expect(b.students[0].mastery.equivalence).not.toBe(0);
    expect(b.clock).toBe(900);
    expect(b.phone.screen).toBe('lock');
    expect(b.phone.planId).toBeNull();
    expect(seedState(3).epoch).toBe(3);
  });
  it('fixture state holds conversation c1 with plan p1', () => {
    const s = stateWithPlan();
    expect(s.conversations[0].id).toBe('c1');
    expect(s.plans[0].id).toBe('p1');
  });
});
