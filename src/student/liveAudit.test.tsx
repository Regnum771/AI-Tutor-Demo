// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { stateWithPlan } from '../live/fixtures';
import { seedState } from '../live/seed';
import { ensureRecord } from '../live/study/record';
import { approvePlan, phoneAnswer, phoneNext, phoneOpen, phoneShowPlan, phoneSkip, type Result } from '../live/reducer';
import type { DemoSource } from '../live/source';
import type { DemoState } from '../live/types';
import { sessionItems } from '../scenario/practiceBank';
import { LivePhoneView } from './LivePhone';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ok = (r: Result): DemoState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const sent = () => ok(approvePlan(stateWithPlan(), 'p1'));
const practice = () => ok(phoneOpen(sent(), 0));
const progress = () => {
  let s = ok(phoneOpen(ok(phoneSkip(ok(phoneShowPlan(sent())))), 1));
  for (const item of sessionItems('equivalence', true)) s = ok(phoneNext(ok(phoneAnswer(s, item.correct))));
  return s;
};
const study = (screen: DemoState['phone']['screen'], over: Partial<DemoState['phone']> = {}) => () => {
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
const STATES: [string, () => DemoState][] = [
  ['lock with a plan', sent],
  ['plan', () => ok(phoneShowPlan(sent()))],
  ['practice', practice],
  ['practice after a wrong answer', () => ok(phoneAnswer(practice(), 0))],
  ['practice after a right answer', () => ok(phoneAnswer(practice(), 1))],
  ['progress', progress],
  ['idle lock', seedState],
  ['morning lock', study('lock', { morning: true })],
  ['pick', () => ({ ...seedState(), phone: { ...seedState().phone, screen: 'pick' as const } })],
  ['setup', () => { const s = study('setup')(); s.study.s17.reported = null; return s; }],
  ['today', study('today')],
  ['choose practice', study('choosePractice')],
  ['cards', study('cards')],
  ['semester', study('semester')],
  ['check-in', study('checkIn')],
];

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

async function mount(state: DemoState) {
  const calls: string[] = [];
  const source: DemoSource = { state, post: async (path) => { calls.push(path); return { ok: true }; } };
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root!.render(<LivePhoneView source={source} />));
  return { calls, el: host };
}

describe('live phone click audit', () => {
  for (const [name, make] of STATES) {
    it(`every enabled button does something: ${name}`, async () => {
      const first = await mount(make());
      const count = first.el.querySelectorAll('button').length;
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        act(() => root?.unmount());
        host?.remove();
        const m = await mount(make());
        const b = m.el.querySelectorAll('button')[i];
        if (!b || b.disabled) continue;
        const before = m.el.innerHTML;
        await act(async () => b.click());
        expect(m.calls.length > 0 || m.el.innerHTML !== before, `"${b.textContent?.trim()}" in ${name} did nothing`).toBe(true);
      }
    });
  }
});
