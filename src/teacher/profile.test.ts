import { describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { chatsAbout, interventionsOf, messagesOf, practiceSessions, tabFor } from './profile';

const ma = (s = stateWithPlan()) => s.students.find((x) => x.id === 's17')!;

describe('profile data', () => {
  it('opens the tab that holds an entry', () => {
    const s = ma();
    expect(tabFor(s, 's17-zalo-1')).toBe('messages');
    expect(tabFor(s, 's17-records')).toBe('record');
    expect(tabFor(s, 's17-quiz2')).toBe('evidence');
    expect(tabFor(s, 'gone')).toBe('messages');
    expect(tabFor(s, null)).toBe('messages');
  });
  it('lists messages newest first', () => {
    expect(messagesOf(ma()).map((e) => e.id)).toEqual(['s17-zalo-2', 's17-zalo-1']);
  });
  it('finds the teacher’s conversations about a student', () => {
    const state = stateWithPlan();
    expect(chatsAbout(state, 's17')).toEqual([{ id: 'c1', title: state.conversations[0].title, first: 'Why did Minh Anh’s quiz score drop?' }]);
    expect(chatsAbout(state, 's2')).toEqual([]);
  });
  it('groups phone practice into sessions with right and wrong tries', () => {
    const state = stateWithPlan('pathway', { status: 'sent' });
    const s = ma(state);
    s.evidence.push(
      { id: 's17-practice-1', kind: 'practice', source: 'Beyond practice', when: '15:31', day: 40, concept: 'implication', text: 'x', result: 'wrong', planId: 'p1' },
      { id: 's17-practice-2', kind: 'practice', source: 'Beyond practice', when: '15:32', day: 40, concept: 'implication', text: 'x', result: 'correct', planId: 'p1' },
    );
    expect(practiceSessions(state, s)).toEqual([{
      key: '40|p1', day: 40, title: 'Rebuild implication, then equivalence', concepts: ['Implication'], right: 1, wrong: 1, skipped: 0, entryIds: ['s17-practice-1', 's17-practice-2'],
    }]);
  });
  it('lists interventions with the mastery change against the baseline', () => {
    const state = stateWithPlan('pathway', { status: 'sent' });
    const s = ma(state);
    state.plans[0].baseline = { ...s.mastery, equivalence: 0.35 };
    s.mastery.equivalence = 0.71;
    expect(interventionsOf(state, s)).toEqual([{ id: 'p1', kind: 'Pathway', title: 'Rebuild implication, then equivalence', status: 'Sent to the phone', date: expect.any(String), change: 'Logical equivalence 0.35 → 0.71' }]);
  });
});
