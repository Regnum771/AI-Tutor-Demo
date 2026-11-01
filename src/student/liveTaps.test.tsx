// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { approvePlan, type Result } from '../live/reducer';
import type { DemoSource } from '../live/source';
import type { DemoState } from '../live/types';
import { LivePhoneView } from './LivePhone';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ok = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const study = (screen: DemoState['phone']['screen'], over: Partial<DemoState['phone']> = {}) => {
  const s = seedState();
  const rec = ensureRecord(s, 's17');
  rec.reported = { weekday: 30, weekend: 60 };
  rec.plan = {
    createdDay: 40, reason: 'Implication first.', leftOut: [], source: 'agents',
    days: Array.from({ length: 24 }, (_, i) => ({ day: 40 + i, minutes: 20, clo: 'CLO1' as const, concepts: ['implication' as const] })),
  };
  s.phone = { ...s.phone, studentId: 's17', screen, ...over };
  return s;
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;
beforeAll(() => {
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
});
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

type Call = { path: string; body?: unknown };
async function mount(state: DemoState, post: (c: Call) => Promise<{ ok: boolean }>) {
  const calls: Call[] = [];
  const source: DemoSource = { state, post: (path, body) => { calls.push({ path, body }); return post({ path, body }); } };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LivePhoneView source={source} />));
  return { calls, el: host };
}
const button = (el: HTMLElement, text: string) => [...el.querySelectorAll('button')].find((b) => b.textContent?.includes(text))!;
const instant = async () => ({ ok: true });

describe('one tap, one request', () => {
  it('two clicks in the same tick post once', async () => {
    const m = await mount(study('today'), instant);
    const b = button(m.el, 'Next week');
    await act(async () => { b.click(); b.click(); });
    expect(m.calls.map((c) => c.path)).toEqual(['study/next-week']);
  });
  it('a click after the reply posts again', async () => {
    const m = await mount(study('today'), instant);
    await act(async () => button(m.el, 'Next week').click());
    await act(async () => button(m.el, 'Next week').click());
    expect(m.calls).toHaveLength(2);
  });
  it('a failed post releases the latch', async () => {
    let n = 0;
    const m = await mount(study('today'), async () => { if (n++ === 0) throw new Error('offline'); return { ok: true }; });
    await act(async () => { button(m.el, 'Next week').click(); });
    await act(async () => button(m.el, 'Next week').click());
    expect(m.calls).toHaveLength(2);
  });
});

describe('routes', () => {
  const lock = (el: HTMLElement) => el.querySelector('button')!;
  it('the lock notification opens Today in the morning, the plan with a plan, and the picker when idle', async () => {
    let m = await mount(study('lock', { morning: true }), instant);
    await act(async () => lock(m.el).click());
    expect(m.calls).toEqual([{ path: 'study/tab', body: { tab: 'today' } }]);
    act(() => root?.unmount());
    host?.remove();
    m = await mount(ok(approvePlan(stateWithPlan(), 'p1')), instant);
    await act(async () => lock(m.el).click());
    expect(m.calls.map((c) => c.path)).toEqual(['phone/plan']);
    act(() => root?.unmount());
    host?.remove();
    m = await mount(seedState(), instant);
    await act(async () => lock(m.el).click());
    expect(m.calls.map((c) => c.path)).toEqual(['study/open']);
  });
  it('Today rows open the session, the cards and the practice', async () => {
    const s = ok(approvePlan(stateWithPlan(), 'p1'));
    const rec = ensureRecord(s, 's17');
    rec.reported = { weekday: 60, weekend: 60 };
    rec.plan = study('today').study.s17.plan;
    s.plans[0].date = s.day;
    s.phone = { ...s.phone, studentId: 's17', screen: 'today' };
    const m = await mount(s, instant);
    const rows = [...m.el.querySelectorAll('button')].filter((b) => /min$/.test(b.textContent ?? ''));
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const r of rows) await act(async () => r.click());
    expect(m.calls.map((c) => c.path)).toContain('phone/open');
    expect(m.calls).toContainEqual({ path: 'study/tab', body: { tab: 'cards' } });
    expect(m.calls).toContainEqual({ path: 'study/practice', body: { clo: null } });
  });
});

describe('setup input', () => {
  const setup = () => { const s = study('setup'); s.study.s17.reported = null; return s; };
  const type = (el: HTMLElement, i: number, v: string) => {
    const input = el.querySelectorAll('input')[i] as HTMLInputElement;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  it('disables Build my plan and says why when a value is outside 5 to 240', async () => {
    const m = await mount(setup(), instant);
    expect(button(m.el, 'Build my plan').disabled).toBe(false);
    expect(m.el.textContent).not.toContain('Enter 5 to 240 minutes.');
    for (const v of ['', '4', '300']) {
      await act(async () => type(m.el, 0, v));
      expect(button(m.el, 'Build my plan').disabled, v).toBe(true);
      expect(m.el.textContent).toContain('Enter 5 to 240 minutes.');
    }
    await act(async () => type(m.el, 0, '30'));
    await act(async () => type(m.el, 1, '241'));
    expect(button(m.el, 'Build my plan').disabled).toBe(true);
    await act(async () => type(m.el, 1, '5'));
    expect(button(m.el, 'Build my plan').disabled).toBe(false);
  });
});

describe('boot order', () => {
  it('shows the phone when the first snapshot arrives after a null state', async () => {
    const post = async () => ({ ok: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<LivePhoneView source={{ state: null, post }} />));
    expect(host.textContent).toContain('Connecting');
    await act(async () => root!.render(<LivePhoneView source={{ state: study('today'), post }} />));
    expect(host.textContent).not.toContain('Connecting');
    expect(button(host, 'Next week')).toBeTruthy();
  });
});
