export type ContextId = 'student' | 'class' | 'attention';

/** Titles, prompts and follow-ups of the draft's canned topics, without JSX so the server can use them. */
export const CANNED_TOPICS: Record<ContextId, { title: string; prompt: string; followUps: string[] }> = {
  student: {
    title: 'Minh Anh’s Quiz 2 drop',
    prompt: 'Why did Minh Anh’s quiz score drop?',
    followUps: ['What gap is the class facing this week?', 'Show me her full history', 'Draft a message to her'],
  },
  class: {
    title: 'Class gap · logical equivalence',
    prompt: 'What gap is the class facing this week?',
    followUps: ['Which 3 need me?', 'Show the recap slides', 'Compare with last term'],
  },
  attention: {
    title: 'Who needs me personally',
    prompt: 'Who needs me personally, not just the AI?',
    followUps: ['Draft the invitations', 'What did we already try?', 'Show the escalation policy'],
  },
};

/** Free-typed prompts are routed by keyword; the draft only knows these three topics. */
export function routePrompt(text: string): ContextId | null {
  const s = text.toLowerCase();
  if (/minh|anh|her\b|quiz score/.test(s)) return 'student';
  if (/personal|need me|needs me|1:1|attention|which 3/.test(s)) return 'attention';
  if (/class|gap|week|group|everyone/.test(s)) return 'class';
  return null;
}
