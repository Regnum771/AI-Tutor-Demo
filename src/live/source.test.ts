import { afterEach, describe, expect, it, vi } from 'vitest';
import { postJson } from './source';

afterEach(() => vi.restoreAllMocks());

describe('postJson', () => {
  it('gives up on a request that never settles after 10 seconds, so the phone can tap again', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => AbortSignal.abort(new DOMException('timed out', 'TimeoutError')));
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => new Promise((_, reject) => {
      if (!init.signal) return; // never settles
      init.signal.addEventListener('abort', () => reject(init.signal!.reason));
      if (init.signal.aborted) reject(init.signal.reason);
    }));
    expect(await postJson('phone/next')).toEqual({ ok: false });
    expect(timeout).toHaveBeenCalledWith(10_000);
    vi.unstubAllGlobals();
  });
});
