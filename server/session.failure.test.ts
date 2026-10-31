import { describe, expect, it, vi } from 'vitest';

vi.mock('./agents/orchestrate', async (importOriginal) => {
  const real = await importOriginal<typeof import('./agents/orchestrate')>();
  return { ...real, answer: vi.fn(async () => { throw new TypeError('boom'); }) };
});

import { DemoSession } from './session';

describe('DemoSession failures', () => {
  it('a run that fails for a reason other than reset frees the session and tells the teacher', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const session = new DemoSession(null);
    const r = session.ask('Why did Minh Anh’s quiz score drop?', null);
    if (!r.ok) throw new Error(r.error);
    await r.done;
    const c = session.state.conversations[0];
    expect(session.state.busy).toBe(false);
    expect(c.pending).toBeNull();
    expect(c.msgs.at(-1)).toMatchObject({ role: 'assistant', source: 'system' });
    expect(warn).toHaveBeenCalledOnce();
    expect(session.ask('And now?', c.id).ok).toBe(true);
    warn.mockRestore();
  });
});
