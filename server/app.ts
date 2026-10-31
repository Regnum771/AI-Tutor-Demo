import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { clearInterval, setInterval } from 'node:timers';
import type { DemoState } from '../src/live/types';
import type { DemoSession } from './session';

export interface BoothInfo { lanUrl: string | null; offline: boolean }

type Body = Record<string, unknown>;
const body = async (c: Context): Promise<Body> => (await c.req.json().catch(() => ({}))) as Body;
const reply = (c: Context, r: { ok: true } | { ok: false; error: string }) => (r.ok ? c.json({ ok: true }) : c.json(r, 400));

export function createApp(session: DemoSession, info: () => BoothInfo) {
  const app = new Hono();

  app.get('/api/info', (c) => c.json(info()));
  app.get('/api/state', (c) => c.json(session.state));

  // The full state on connect and after every change; EventSource reconnects on its own.
  app.get('/api/events', (c) => streamSSE(c, (stream) => new Promise<void>((resolve) => {
    const send = (s: DemoState) => void stream.writeSSE({ event: 'state', data: JSON.stringify(s) });
    const off = session.subscribe(send);
    const ping = setInterval(() => void stream.writeSSE({ event: 'ping', data: '' }), 15_000);
    ping.unref();
    stream.onAbort(() => {
      clearInterval(ping);
      off();
      resolve();
    });
    send(session.state);
  })));

  app.post('/api/ask', async (c) => {
    const b = await body(c);
    const r = session.ask(String(b.text ?? ''), typeof b.conversationId === 'string' ? b.conversationId : null);
    return r.ok ? c.json({ ok: true, conversationId: r.conversationId }, 202) : c.json({ ok: false, error: r.error }, r.status);
  });
  app.post('/api/plan/edit', async (c) => {
    const b = await body(c);
    return reply(c, session.edit(String(b.planId), Number(b.sessionIndex), {
      time: typeof b.time === 'string' ? b.time : undefined, remove: b.remove === true,
    }));
  });
  app.post('/api/plan/approve', async (c) => reply(c, session.approve(String((await body(c)).planId))));
  app.post('/api/plan/dismiss', async (c) => reply(c, session.dismiss(String((await body(c)).planId))));
  app.post('/api/phone/plan', (c) => reply(c, session.phonePlan()));
  app.post('/api/phone/open', async (c) => reply(c, session.phoneOpen(Number((await body(c)).sessionIndex))));
  app.post('/api/phone/answer', async (c) => reply(c, session.phoneAnswer(Number((await body(c)).option))));
  app.post('/api/phone/next', (c) => {
    const r = session.phoneNext();
    return reply(c, r.ok ? { ok: true } : r);
  });
  app.post('/api/phone/skip', (c) => reply(c, session.phoneSkip()));
  app.post('/api/reset', (c) => {
    session.reset();
    return c.json({ ok: true });
  });

  return app;
}
