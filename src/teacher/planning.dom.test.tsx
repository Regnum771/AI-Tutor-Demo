// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ctxFor, stateWithPlan } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
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
