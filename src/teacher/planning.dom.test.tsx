// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ctxFor, stateWithPlan } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
import type { DemoSource } from '../live/source';
import type { DemoState } from '../live/types';
import { classEngagement, notOpened } from '../scenario/materials';
import { LiveTeacherView } from './LiveTeacher';
import { LiveText } from './LiveText';

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
const click = async (b: Element) => act(async () => (b as HTMLElement).click());
const button = (el: HTMLElement, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const lectures = (el: HTMLElement) => [...el.querySelectorAll('[data-lecture]')].map((l) => l.getAttribute('data-lecture'));
const row = (el: HTMLElement, id: string) => el.querySelector(`[data-resource="${id}"] > button`)!;
const series = (el: HTMLElement) => el.querySelector('[data-series="mastery"]')?.getAttribute('data-concept');

async function mount(state: DemoState = stateWithPlan()) {
  const calls: string[] = [];
  const source: DemoSource = { state, post: async (path) => { calls.push(path); return { ok: true, conversationId: 'c1' }; } };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LiveTeacherView source={source} />));
  return { calls, el: host };
}

describe('resource chips', () => {
  it('read kind and lecture, and open the Lesson planning tab through openPlanning', async () => {
    const opened: string[] = [];
    const profiles: string[] = [];
    const ctx = { ...ctxFor(stateWithPlan()), openPlanning: (id: string) => { opened.push(id); }, openProfile: (id: string) => { profiles.push(id); } };
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const block = { kind: 'p' as const, text: 'Set the slides before Lecture 7.', cites: ['l7-slides', 's17-quiz2'] };
    await act(async () => root!.render(<LiveProvider value={ctx}><LiveText block={block} /></LiveProvider>));
    const chip = host.querySelector('[data-cite="l7-slides"]')!;
    expect(chip.textContent).toBe('Slides · Lecture 7');
    await click(chip);
    expect(opened).toEqual(['l7-slides']);
    expect(profiles).toEqual([]);
    await click(host.querySelector('[data-cite="s17-quiz2"]')!);
    expect(profiles).toEqual(['s17']);
    expect(opened).toEqual(['l7-slides']);
  });
});

describe('lesson planning tab', () => {
  it('lists the next three lectures, and a concept on the graph changes the chart and filters the lectures', async () => {
    const m = await mount();
    await click(button(m.el, 'Lesson planning'));
    expect(m.el.querySelector('h1')?.textContent).toBe('Lesson planning');
    expect(m.el.querySelectorAll('[data-node]')).toHaveLength(12);
    expect(m.el.querySelectorAll('[data-edge]')).toHaveLength(19);
    expect([...m.el.querySelectorAll('[data-untaught]')].map((n) => n.textContent)).toEqual(['Equivalence lawsLecture 7 · Tue 3 Nov', 'ApplicationsLecture 8 · Tue 10 Nov']);
    expect(lectures(m.el)).toEqual(['7', '8', '9']);
    expect(series(m.el)).toBe('equivalence');
    expect(m.el.querySelector('[data-chart-title]')?.textContent).toBe('Mastery over time · Logical equivalence');
    await click(m.el.querySelector('[data-node="implication"]')!);
    expect(series(m.el)).toBe('implication');
    expect(m.el.querySelector('[data-chart-title]')?.textContent).toBe('Mastery over time · Implication');
    expect(lectures(m.el)).toEqual(['5', '9']);
    await click(m.el.querySelector('[data-node="implication"]')!);
    expect(series(m.el)).toBe('equivalence');
    expect(lectures(m.el)).toEqual(['7', '8', '9']);
    expect(m.calls).toEqual([]);
  });
  it('shows class engagement for past lectures, newest first, and "Not released yet" before a lecture', async () => {
    const m = await mount();
    await click(button(m.el, 'Lesson planning'));
    expect(m.el.querySelector('[data-resource="l7-slides"] [data-engagement]')?.textContent).toBe('Not released yet');
    await click(button(m.el, 'Past lectures'));
    expect(lectures(m.el)).toEqual(['7', '8', '9', '6', '5', '4', '3', '2', '1']);
    const c = classEngagement('l6-recording');
    expect(m.el.querySelector('[data-resource="l6-recording"] [data-engagement]')?.textContent).toBe(`${c.opened} of 55 opened · ${Math.round(c.meanFraction * 100)}% watched on average`);
    await click(button(m.el, 'Hide past lectures'));
    expect(lectures(m.el)).toEqual(['7', '8', '9']);
  });
  it('expands a resource into exactly the students who have not opened it, and a name opens the pop-up', async () => {
    const m = await mount();
    await click(button(m.el, 'Lesson planning'));
    await click(button(m.el, 'Past lectures'));
    await click(row(m.el, 'l5-recording'));
    const missing = notOpened('l5-recording');
    expect([...m.el.querySelectorAll('[data-not-opened="l5-recording"] [data-student]')].map((b) => b.getAttribute('data-student'))).toEqual(missing.map((i) => `s${i + 1}`));
    await click(m.el.querySelector('[data-not-opened="l5-recording"] [data-student]')!);
    expect(m.el.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe(stateWithPlan().students[missing[0]].name);
    await click(button(m.el, 'Close'));
    await click(row(m.el, 'l7-slides'));
    expect(m.el.querySelector('[data-not-opened="l7-slides"]')?.textContent).toBe('Nobody can open it before Lecture 7 on Tue 3 Nov.');
    expect(m.el.querySelectorAll('[data-not-opened="l7-slides"] [data-student]')).toHaveLength(0);
    expect(m.calls).toEqual([]);
  });
  it('a resource chip in an answer opens the tab with that row expanded, past lectures included', async () => {
    const s = stateWithPlan();
    const answer = s.conversations[0].msgs[1];
    if (answer.role === 'assistant') answer.blocks[1].cites = ['l5-recording', 'l7-slides'];
    const m = await mount(s);
    await click(m.el.querySelector('[data-cite="l5-recording"]')!);
    expect(m.el.querySelector('h1')?.textContent).toBe('Lesson planning');
    expect(row(m.el, 'l5-recording').getAttribute('aria-expanded')).toBe('true');
    expect(m.el.querySelectorAll('[data-not-opened="l5-recording"] [data-student]')).toHaveLength(notOpened('l5-recording').length);
    await click(button(m.el, 'Chat'));
    await click(m.el.querySelector('[data-cite="l7-slides"]')!);
    expect(row(m.el, 'l7-slides').getAttribute('aria-expanded')).toBe('true');
    expect(m.el.querySelector('[data-not-opened="l5-recording"]')).toBeNull();
    expect(m.calls).toEqual([]);
  });
});
