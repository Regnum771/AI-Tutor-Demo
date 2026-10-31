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
  // Freeze the render clock so every frame is deterministic.
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
});
afterEach(() => unmount());

function unmount() {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
}

async function mount() {
  const calls: string[] = [];
  const source: DemoSource = {
    state: stateWithPlan(),
    post: async (path) => {
      calls.push(path);
      return { ok: true, conversationId: 'c1' };
    },
  };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LiveTeacherView source={source} />));
  return { calls, el: host };
}

const buttons = (el: HTMLElement) => [...el.querySelectorAll('button')];
const click = async (b: Element) => act(async () => (b as HTMLElement).click());
const byText = (el: HTMLElement, text: string) => buttons(el).find((b) => b.textContent?.trim() === text)!;
const skip = (b: HTMLButtonElement) => b.disabled || b.type === 'submit' || b.hasAttribute('aria-current');

const SCENARIOS: [string, (el: HTMLElement) => Promise<void>][] = [
  ['conversation with its plan (reopened after a refresh)', async () => {}],
  ['opening screen', async (el) => click(byText(el, '+ New conversation'))],
  ['classroom with a student open', async (el) => {
    await click(byText(el, 'Classroom12'));
    await click(el.querySelector('button[title^="Nguyễn Minh Anh"]')!);
  }],
];

describe('live teacher click audit (spec §2.6)', () => {
  for (const [name, setup] of SCENARIOS) {
    it(`every button does something: ${name}`, async () => {
      let m = await mount();
      await setup(m.el);
      const count = buttons(m.el).length;
      expect(count).toBeGreaterThan(5);
      for (let i = 0; i < count; i++) {
        unmount();
        m = await mount();
        await setup(m.el);
        const b = buttons(m.el)[i];
        if (!b || skip(b)) continue;
        const label = b.textContent?.trim() || b.getAttribute('aria-label') || b.title;
        const before = m.el.innerHTML;
        await click(b);
        const did = m.calls.length > 0 || m.el.innerHTML !== before || document.querySelector('[role="status"]') !== null;
        expect(did, `"${label}" in ${name} did nothing`).toBe(true);
      }
    }, 60_000);
  }
});
