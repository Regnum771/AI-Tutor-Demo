import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { clearInterval, setInterval } from 'node:timers';
import type { StudyTab } from '../src/live/study/reducer';
import type { CardRating, DemoState, StudyDay } from '../src/live/types';
import type { CloId } from '../src/scenario/course';
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
    const write = (event: string, data: string) => { stream.writeSSE({ event, data }).catch(() => undefined); };
    const send = (s: DemoState) => write('state', JSON.stringify(s));
    const off = session.subscribe(send);
    const ping = setInterval(() => write('ping', ''), 15_000);
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
  app.post('/api/phone/next', (c) => reply(c, session.phoneNext()));
  app.post('/api/phone/goto', async (c) => reply(c, session.phoneGoto(Number((await body(c)).item))));
  app.post('/api/phone/again', (c) => reply(c, session.phoneAgain()));
  app.post('/api/phone/finish', (c) => reply(c, session.phoneFinish()));
  app.post('/api/phone/continue', (c) => reply(c, session.phoneContinue()));
  app.post('/api/phone/skip', (c) => reply(c, session.phoneSkip()));
  app.post('/api/study/open', (c) => reply(c, session.studyOpen()));
  app.post('/api/study/pick', async (c) => reply(c, session.studyPick(String((await body(c)).studentId))));
  app.post('/api/study/setup', async (c) => {
    const b = await body(c);
    return reply(c, session.studySetup(Number(b.weekday), Number(b.weekend)));
  });
  app.post('/api/study/tab', async (c) => reply(c, session.studyTab(String((await body(c)).tab) as StudyTab)));
  app.post('/api/study/practice', async (c) => {
    const b = await body(c);
    if (b.clo != null && typeof b.clo !== 'string') return c.json({ ok: false, error: 'clo must be a string' }, 400);
    return reply(c, session.studyPractice(typeof b.clo === 'string' ? (b.clo as CloId) : null));
  });
  app.post('/api/study/rate', async (c) => {
    const b = await body(c);
    return reply(c, session.studyRate(String(b.cardId), String(b.rating) as CardRating));
  });
  app.post('/api/study/check-in', (c) => reply(c, session.studyCheckIn()));
  app.post('/api/study/next-day', async (c) => {
    const b = await body(c);
    if (b.check != null && typeof b.check !== 'string') return c.json({ ok: false, error: 'check must be a string' }, 400);
    return reply(c, session.nextDay(typeof b.check === 'string' ? (b.check as StudyDay['check']) : null));
  });
  app.post('/api/study/next-week', (c) => reply(c, session.nextWeek()));
  app.post('/api/study/simulate-drop', (c) => reply(c, session.simulateDrop()));
  app.post('/api/reset', (c) => {
    session.reset();
    return c.json({ ok: true });
  });

  return app;
}
