import { describe, expect, it } from 'vitest';
import { TOPICS } from './conversations';
import { CANNED_TOPICS, routePrompt } from './route';

describe('canned topics', () => {
  it('match the draft topics (the JSX answers stay in conversations.tsx)', () => {
    for (const id of ['student', 'class', 'attention'] as const) {
      expect(CANNED_TOPICS[id]).toEqual({ title: TOPICS[id].title, prompt: TOPICS[id].prompt, followUps: TOPICS[id].followUps });
    }
  });
  it('route typed prompts by keyword', () => {
    expect(routePrompt('Why did Minh Anh’s quiz score drop?')).toBe('student');
    expect(routePrompt('Who needs me personally?')).toBe('attention');
    expect(routePrompt('What gap is the class facing?')).toBe('class');
    expect(routePrompt('Hello')).toBeNull();
  });
});
