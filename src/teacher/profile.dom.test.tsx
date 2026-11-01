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
