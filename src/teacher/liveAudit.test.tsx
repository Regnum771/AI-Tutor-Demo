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

async function mount(state = stateWithPlan(), reply: { ok: boolean; [k: string]: unknown } = { ok: true, conversationId: 'c1' }) {
  const calls: string[] = [];
  const source: DemoSource = {
    state,
    post: async (path) => {
      calls.push(path);
      return reply;
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

const textarea = (el: HTMLElement) => el.querySelector('textarea')!;
/** Types into the composer the way a browser does, then presses Enter. */
async function typeAndSend(el: HTMLElement, text: string) {
  await act(async () => {
    const box = textarea(el);
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(box), 'value')!.set!.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { textarea(el).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
}

describe('live teacher evidence chips', () => {
  it('a class chip carries its highlight to the panel and keeps the plan open', async () => {
    const s = stateWithPlan('classActivity');
    const answer = s.conversations[0].msgs[1];
    if (answer.role === 'assistant') answer.blocks[0].cites = ['class-quiz2-q4'];
    const m = await mount(s);
    expect(m.el.textContent).not.toContain('Open context');
    await click(m.el.querySelector('[data-cite="class-quiz2-q4"]')!);
    expect(m.el.querySelector('[data-evidence="class-quiz2-q4"]')).not.toBeNull();
    expect(byText(m.el, 'Approve plan')).toBeTruthy();
    // The panel now differs from the message's: the highlight reached it.
    expect(m.el.textContent).toContain('Open context');
  });
});

describe('live teacher busy state', () => {
  const busy = () => ({ ...stateWithPlan(), busy: true });
  it('an attention row posts nothing while the agents work, and says why', async () => {
    const m = await mount(busy());
    await click(byText(m.el, '+ New conversation'));
    await click(buttons(m.el).find((b) => b.textContent?.includes('Quiz 2 dropped'))!);
    expect(m.calls).toEqual([]);
    expect(document.querySelector('[role="status"]')?.textContent).toContain('The agents are still working');
  });
  it('the composer is read-only and says so while the agents work', async () => {
    const m = await mount(busy());
    expect(textarea(m.el).readOnly).toBe(true);
    expect(textarea(m.el).placeholder).toBe('The agents are working…');
    unmount();
    const idle = await mount();
    expect(textarea(idle.el).readOnly).toBe(false);
    expect(textarea(idle.el).placeholder).toBe('Ask about a student, a gap, or your class…');
  });
  it('keeps the draft until the server accepts the question', async () => {
    const refused = await mount(stateWithPlan(), { ok: false, error: 'Please keep questions under 500 characters.' });
    await typeAndSend(refused.el, 'A long question');
    expect(refused.calls).toEqual(['ask']);
    expect(textarea(refused.el).value).toBe('A long question');
    expect(document.querySelector('[role="status"]')?.textContent).toContain('under 500 characters');
    unmount();
    const accepted = await mount();
    await typeAndSend(accepted.el, 'A short question');
    expect(accepted.calls).toEqual(['ask']);
    expect(textarea(accepted.el).value).toBe('');
  });
});

const SCENARIOS: [string, (el: HTMLElement) => Promise<void>][] = [
  ['conversation with its plan (reopened after a refresh)', async () => {}],
  ['opening screen', async (el) => click(byText(el, '+ New conversation'))],
  ['classroom with a student open', async (el) => {
    await click(byText(el, 'Classroom12'));
    await click(el.querySelector('button[title^="Nguyễn Minh Anh"]')!);
  }],
  ['profile pop-up on the Record tab', async (el) => {
    await click(byText(el, 'Classroom12'));
    await click(el.querySelector('button[title^="Nguyễn Minh Anh"]')!);
    await click(byText(el, 'Record'));
  }],
  ['classroom with a question open', async (el) => {
    await click(byText(el, 'Classroom12'));
    await click(buttons(el).find((b) => b.textContent?.includes('Why is p → q not the same as q → p?'))!);
  }],
  ['calendar', async (el) => click(byText(el, 'Calendar'))],
  ['calendar with Lecture 6 open', async (el) => {
    await click(byText(el, 'Calendar'));
    await click(el.querySelector('[data-event="lecture-6"]')!);
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

describe('live teacher boot order', () => {
  it('renders once the first snapshot arrives after a null state', async () => {
    const post = async () => ({ ok: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<LiveTeacherView source={{ state: null, post }} />));
    expect(host.textContent).toContain('Connecting');
    await act(async () => root!.render(<LiveTeacherView source={{ state: stateWithPlan(), post }} />));
    expect(host.textContent).not.toContain('Connecting');
  });
});
