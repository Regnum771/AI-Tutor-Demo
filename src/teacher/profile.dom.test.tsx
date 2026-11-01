// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import type { DemoSource } from '../live/source';
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

async function mount(state = stateWithPlan()) {
  const calls: string[] = [];
  const source: DemoSource = { state, post: async (path) => { calls.push(path); return { ok: true, conversationId: 'c1' }; } };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LiveTeacherView source={source} />));
  return { calls, el: host };
}
const click = async (b: Element) => act(async () => (b as HTMLElement).click());
const button = (el: HTMLElement, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
const dialog = (el: HTMLElement) => el.querySelector('[role="dialog"]');

describe('student profile pop-up', () => {
  it('opens from a student citation on the tab holding the entry, and closes', async () => {
    const s = stateWithPlan();
    const answer = s.conversations[0].msgs[1];
    if (answer.role === 'assistant') answer.blocks[0].cites = ['s17-quiz2'];
    const m = await mount(s);
    await click(m.el.querySelector('[data-cite="s17-quiz2"]')!);
    expect(dialog(m.el)?.getAttribute('aria-label')).toBe('Nguyễn Minh Anh');
    expect(button(m.el, 'All evidence').getAttribute('aria-current')).toBe('true');
    expect(dialog(m.el)!.querySelector('[data-evidence="s17-quiz2"]')!.getAttribute('style')).toContain('background');
    await click(button(m.el, 'Close'));
    expect(dialog(m.el)).toBeNull();
  });
  it('opens from the classroom roster and shows the record, chart and chats', async () => {
    const m = await mount();
    await click([...m.el.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Classroom'))!);
    await click(m.el.querySelector('button[title^="Nguyễn Minh Anh"]')!);
    const d = dialog(m.el)!;
    expect(d.textContent).toContain('GPA');
    expect(d.textContent).toContain('Pass 4.0');
    expect(d.textContent).toContain('Em vẫn chưa hiểu');
    await click(button(m.el, 'Record'));
    expect(dialog(m.el)!.textContent).toContain('Introduction to Logic');
    await click(button(m.el, 'AI chats'));
    await click([...dialog(m.el)!.querySelectorAll('button')].find((b) => b.textContent?.includes('Why did Minh Anh'))!);
    expect(dialog(m.el)).toBeNull();
  });
  it('closes on Escape', async () => {
    const m = await mount();
    await click([...m.el.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Classroom'))!);
    await click(m.el.querySelector('button[title^="Nguyễn Minh Anh"]')!);
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(dialog(m.el)).toBeNull();
  });
});

describe('quotes in answers', () => {
  it('quotes up to two cited messages under the block and opens the profile at one', async () => {
    const s = stateWithPlan();
    const answer = s.conversations[0].msgs[1];
    if (answer.role === 'assistant') answer.blocks[0].cites = ['s17-quiz2', 's17-zalo-1', 's17-zalo-2', 's5-voice-8'];
    const m = await mount(s);
    const quotes = [...m.el.querySelectorAll('[data-quote]')].map((q) => q.getAttribute('data-quote'));
    expect(quotes).toEqual(['s17-zalo-1', 's17-zalo-2']);
    expect(m.el.querySelector('[data-quote="s17-zalo-1"]')!.textContent).toContain('Zalo · Nguyễn Minh Anh · Wed 21 Oct · 1 day after Lecture 5');
    await click(m.el.querySelector('[data-quote="s17-zalo-1"]')!);
    expect(dialog(m.el)!.querySelector('[data-entry="s17-zalo-1"]')!.getAttribute('style')).toContain('background');
  });
});

describe('what students are asking', () => {
  it('sits above the heatmap, expands one entry into its log, and opens a student from it', async () => {
    const m = await mount();
    await click([...m.el.querySelectorAll('button')].find((b) => b.textContent?.startsWith('Classroom'))!);
    const html = m.el.innerHTML;
    expect(html.indexOf('What students are asking')).toBeGreaterThan(-1);
    expect(html.indexOf('What students are asking')).toBeLessThan(html.indexOf('data-heatmap'));
    const row = [...m.el.querySelectorAll('button')].find((b) => b.textContent?.includes('Why is p → q not the same as q → p?'))!;
    expect(row.textContent).toContain('13 students · 16 messages');
    expect(row.textContent).toContain('mostly within 2 days of Lecture 5');
    await click(row);
    expect(m.el.querySelectorAll('[data-log-entry]')).toHaveLength(16);
    await click([...m.el.querySelectorAll('[data-log-entry] button')].find((b) => b.textContent === 'Nguyễn Minh Anh')!);
    expect(dialog(m.el)!.querySelector('[data-entry="s17-zalo-1"]')).not.toBeNull();
  });
});

describe('quotes across blocks', () => {
  it('quotes a message once per answer, in the first block that cites it', async () => {
    const s = stateWithPlan();
    const answer = s.conversations[0].msgs[1];
    if (answer.role === 'assistant') {
      answer.blocks[0].cites = ['s17-zalo-1', 's17-zalo-1'];
      answer.blocks[1].cites = ['s17-zalo-1'];
    }
    const m = await mount(s);
    expect(m.el.querySelectorAll('[data-quote="s17-zalo-1"]')).toHaveLength(1);
  });
});
