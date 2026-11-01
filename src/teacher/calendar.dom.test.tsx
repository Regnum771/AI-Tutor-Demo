// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import type { DemoSource } from '../live/source';
import { ensureRecord } from '../live/study/record';
import { lectureQuestions } from './calendar';
import { LiveTeacherView } from './LiveTeacher';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let host: HTMLDivElement | null = null;
beforeAll(() => {
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

/** Plan p1 sent for day 40, and Minh Anh idle on days 37–39. */
const story = () => {
  const s = stateWithPlan('pathway', { status: 'sent' });
  const rec = ensureRecord(s, 's17');
  rec.reported = { weekday: 30, weekend: 60 };
  for (const d of [37, 38, 39]) rec.days[d] = { planned: 30, done: 0, check: null };
  return s;
};
async function mount() {
  const calls: string[] = [];
  const source: DemoSource = { state: story(), post: async (path) => { calls.push(path); return { ok: true, conversationId: 'c1' }; } };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LiveTeacherView source={source} />));
  return { calls, el: host };
}
const click = async (b: Element) => act(async () => (b as HTMLElement).click());
const button = (el: HTMLElement, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const event = (el: HTMLElement, key: string) => el.querySelector(`[data-event="${key}"]`)!;
const week = (el: HTMLElement) => el.querySelector('[data-week]')?.textContent;

describe('teacher calendar', () => {
  it('opens on the story’s week with a today marker, and browses Weeks 1 to 10 without moving the story', async () => {
    const m = await mount();
    await click(button(m.el, 'Calendar'));
    expect(week(m.el)).toBe('Week 6');
    expect(m.el.querySelector('[aria-current="date"]')?.getAttribute('data-day')).toBe('40');
    await click(button(m.el, 'Next week ›'));
    expect(week(m.el)).toBe('Week 7');
    expect(m.el.textContent).toContain('Lecture 7 · Equivalence laws');
    expect(m.el.querySelector('[aria-current="date"]')).toBeNull();
    for (let i = 0; i < 3; i++) await click(button(m.el, 'Next week ›'));
    expect(week(m.el)).toBe('Week 10');
    expect(button(m.el, 'Next week ›').disabled).toBe(true);
    for (let i = 0; i < 9; i++) await click(button(m.el, '‹ Prev week'));
    expect(week(m.el)).toBe('Week 1');
    expect(button(m.el, '‹ Prev week').disabled).toBe(true);
    expect(m.calls).toEqual([]);
  });
  it('expands a lecture into the questions placed after it, and an assessment into its date, CLOs and marks', async () => {
    const m = await mount();
    await click(button(m.el, 'Calendar'));
    await click(button(m.el, '‹ Prev week'));
    await click(event(m.el, 'lecture-5'));
    expect(m.el.querySelectorAll('[data-question]')).toHaveLength(lectureQuestions(5).length);
    await click(event(m.el, 'lecture-5'));
    expect(m.el.querySelectorAll('[data-question]')).toHaveLength(0);
    await click(button(m.el, 'Next week ›'));
    await click(event(m.el, 'assessment-quiz2'));
    const detail = m.el.querySelector('[data-detail="assessment-quiz2"]')!;
    expect(detail.textContent).toContain('Thursday, 29 October');
    expect(detail.textContent).toContain('CLO2 Establish logical equivalence');
    expect(detail.textContent).toContain('55 marks');
  });
  it('a stopped flag opens the student’s pop-up and a session opens its conversation', async () => {
    const m = await mount();
    await click(button(m.el, 'Calendar'));
    await click(event(m.el, 'stopped-s17'));
    expect(m.el.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Nguyễn Minh Anh');
    await click(button(m.el, 'Close'));
    await click(event(m.el, 'session-p1-15:30'));
    expect(m.el.textContent).toContain('Quiz 2 fell from');
    expect(m.el.textContent).not.toContain('‹ Prev week');
  });
});
