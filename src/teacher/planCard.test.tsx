// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { ctxFor, planFor, stateWithPlan } from '../live/fixtures';
import { LiveProvider } from '../live/LiveContext';
import type { Plan } from '../live/types';
import { LivePlanCard } from './LivePanel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('plan card editing', () => {
  it('time inputs follow the plan after a session is removed, even if one was touched', async () => {
    const base = planFor('pathway');
    const plan: Plan = {
      ...base,
      sessions: [
        base.sessions[0],
        { ...base.sessions[0], time: '16:00', title: 'Worked examples' },
        base.sessions[1],
      ],
    };
    const ctx = ctxFor(stateWithPlan());
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const draw = (p: Plan) => root.render(<LiveProvider value={ctx}><LivePlanCard plan={p} /></LiveProvider>);
    await act(async () => draw(plan));
    const edit = [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Edit')!;
    await act(async () => edit.click());
    const first = () => host.querySelector('input') as HTMLInputElement;
    first().value = '15:45'; // typed but not yet saved
    await act(async () => draw({ ...plan, sessions: plan.sessions.slice(1) }));
    expect(first().value).toBe('16:00');
    act(() => root.unmount());
    host.remove();
  });
});
