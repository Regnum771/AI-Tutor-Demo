// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AssistantMsg } from '../live/types';
import { PAST, teacherFrame, type TeacherEvent } from './frame';
import { TeacherScreen, type TeacherActions } from './TeacherScreen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeAll(() => {
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  // happy-dom has no layout: give every element a tall scroll height so pinning is visible.
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => 1000 });
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const noop = () => {};
const actions: TeacherActions = {
  send: noop, open: noop, reset: noop, setView: noop, approve: noop, edit: noop, showPanel: noop, select: noop, askStudent: noop, askClass: noop,
};
const answer: AssistantMsg = {
  role: 'assistant', source: 'agents', canned: null, followUps: [], panel: null, stamp: null,
  blocks: [{ kind: 'p', text: 'First block.', cites: [] }, { kind: 'p', text: 'Second block.', cites: [] }],
};
const events: TeacherEvent[] = [
  { at: PAST, type: 'title', title: 'Minh Anh', sansTitle: true },
  { at: 0, type: 'send', text: 'Why did Minh Anh’s quiz score drop?' },
  { at: 0, type: 'assistant', kind: 'live', live: answer, blockMs: 250 },
];
const render = (t: number) => act(() => root!.render(<TeacherScreen frame={teacherFrame(events, t)} actions={actions} />));

describe('live chat scrolling', () => {
  it('leaves the thread where the teacher scrolled once an answer has finished revealing', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    render(5_000);
    const thread = [...host.querySelectorAll('div')].find((d) => d.scrollTop > 0);
    expect(thread, 'the thread pins to the bottom when the answer lands').toBeDefined();
    thread!.scrollTop = 0;
    render(6_000);
    render(9_000);
    expect(thread!.scrollTop).toBe(0);
  });
});
