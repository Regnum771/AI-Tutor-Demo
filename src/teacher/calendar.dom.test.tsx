// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import type { DemoSource } from '../live/source';
import type { DemoState } from '../live/types';
import { ensureRecord } from '../live/study/record';
import { notOpened } from '../scenario/materials';
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
async function mount(initial: DemoState = story()) {
  const calls: string[] = [];
  const source: DemoSource = { state: initial, post: async (path) => { calls.push(path); return { ok: true, conversationId: 'c1' }; } };
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
  it('shows a lecture’s materials above its questions, and a row lists who has not opened it', async () => {
    const m = await mount();
    await click(button(m.el, 'Calendar'));
    await click(button(m.el, '‹ Prev week'));
    await click(event(m.el, 'lecture-5'));
    const detail = () => m.el.querySelector('[data-detail="lecture-5"]')!;
    expect([...detail().querySelectorAll('[data-resource]')].map((r) => r.getAttribute('data-resource'))).toEqual(['l5-slides', 'l5-recording', 'l5-worksheet', 'l5-reading']);
    expect(detail().querySelector('[data-resources]')!.compareDocumentPosition(detail().querySelector('[data-question]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(detail().querySelector('[data-resource="l5-recording"] [data-engagement]')!.textContent).toBe('31 of 55 opened · 46% watched on average');
    await click(detail().querySelector('[data-resource="l5-recording"] button')!);
    expect(detail().querySelectorAll('[data-not-opened="l5-recording"] [data-student]')).toHaveLength(notOpened('l5-recording').length);
    expect(m.calls).toEqual([]);
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
  it('labels a class activity "N students" instead of a long list, and a check-in does not repeat the name', async () => {
    const s = stateWithPlan('classActivity', { status: 'sent', studentIds: ['s1', 's2', 's3', 's4', 's5', 's6'] });
    const m = await mount(s);
    await click(button(m.el, 'Calendar'));
    await click(button(m.el, 'Next week ›'));
    const label = event(m.el, 'session-p1-10:00').textContent;
    expect(label).toContain('6 students');
    expect(label).not.toContain(s.students[0].short + ',');
    host!.remove();
    const c = stateWithPlan('checkIns', { status: 'sent', sessions: [{ time: '14:00', title: 'Check-in · Nguyễn Minh Anh', minutes: 15, concept: null, isMasteryCheck: false, studentId: 's17' }], studentIds: ['s17'] });
    act(() => root?.unmount());
    const m2 = await mount(c);
    await click(button(m2.el, 'Calendar'));
    await click(button(m2.el, 'Next week ›'));
    expect(event(m2.el, 'session-p1-14:00').textContent).toBe('14:00Check-in · Nguyễn Minh Anh');
  });
});
