import { describe, expect, it, vi } from 'vitest';
import type { MessagesClient } from './agents/client';
import { createApp } from './app';
import { DemoSession } from './session';

const MA = 'Why did Minh Anh’s quiz score drop?';
const setup = (client: MessagesClient | null = null) => {
  const session = new DemoSession(client);
  const app = createApp(session, () => ({ lanUrl: 'http://192.168.1.20:5173/student.html?live', offline: client === null }));
  const post = (path: string, body: unknown = {}) =>
    app.request(`/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { session, app, post };
};

describe('booth HTTP API', () => {
  it('serves the booth info and the state', async () => {
    const { app } = setup();
    expect(await (await app.request('/api/info')).json()).toEqual({ lanUrl: 'http://192.168.1.20:5173/student.html?live', offline: true });
    expect(await (await app.request('/api/state')).json()).toMatchObject({ epoch: 0, clock: 900 });
  });
  it('ask answers 202 at once; plan and phone routes drive the flow', async () => {
    const { session, post } = setup();
    const r = await post('ask', { text: MA });
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ ok: true, conversationId: 'c1' });
    await vi.waitFor(() => expect(session.state.busy).toBe(false));
    expect((await post('plan/edit', { planId: 'p1', sessionIndex: 3, time: '20:00' })).status).toBe(200);
    expect((await post('plan/approve', { planId: 'p1' })).status).toBe(200);
    expect((await post('phone/plan')).status).toBe(200);
    expect((await post('phone/open', { sessionIndex: 0 })).status).toBe(200);
    expect((await post('phone/answer', { option: 0 })).status).toBe(200);
    expect(session.state.phone.result).toBe('wrong');
  });
  it('reports bad commands as 400', async () => {
    const { post } = setup();
    const bad = await post('plan/approve', { planId: 'nope' });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ ok: false, error: 'Only a proposed plan can be approved.' });
    expect((await post('ask', { text: '' })).status).toBe(400);
  });
  it('answers 409 while the agents are working', async () => {
    const { post } = setup({ create: () => new Promise(() => {}) });
    expect((await post('ask', { text: MA })).status).toBe(202);
    expect((await post('ask', { text: MA })).status).toBe(409);
  });
  it('reset bumps the epoch', async () => {
    const { session, post } = setup();
    expect((await post('reset')).status).toBe(200);
    expect(session.state.epoch).toBe(1);
  });
  it('streams the state over SSE', async () => {
    const { app } = setup();
    const res = await app.request('/api/events');
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain('event: state');
    expect(text).toContain('"epoch":0');
    await reader.cancel();
  });
  it('pushes every change, and forgets a client that leaves', async () => {
    const { app, session, post } = setup();
    const res = await app.request('/api/events');
    const reader = res.body!.getReader();
    await reader.read();
    await post('reset');
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain('"epoch":1');
    await reader.cancel();
    const listeners = (session as unknown as { listeners: Set<unknown> }).listeners;
    await vi.waitFor(() => expect(listeners.size).toBe(0));
  });
});
