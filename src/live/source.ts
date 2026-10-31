import { useEffect, useState } from 'react';
import type { DemoState } from './types';

export interface DemoSource {
  state: DemoState | null;
  /** POST /api/<path>; resolves to the JSON reply, or `{ ok: false }` when the server is unreachable. */
  post(path: string, body?: unknown): Promise<{ ok: boolean; [k: string]: unknown }>;
}

export async function postJson(path: string, body: unknown = {}): Promise<{ ok: boolean; [k: string]: unknown }> {
  try {
    const r = await fetch(`/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json()) as { ok: boolean };
  } catch {
    return { ok: false };
  }
}

/** Live demo state over SSE. EventSource reconnects on its own and the server resends the full state. */
export function useServerSource(): DemoSource {
  const [state, setState] = useState<DemoState | null>(null);
  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('state', (e) => setState(JSON.parse((e as MessageEvent<string>).data) as DemoState));
    return () => es.close();
  }, []);
  return { state, post: postJson };
}
