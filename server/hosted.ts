import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';

const PORT = 8787;
const VITE_PORT = 5173;
const PHONE_PATH = '/student.html?live';

/** Hosted mode is an explicit switch (the Dockerfile sets it), so a stray PORT never opens a laptop to its network. */
export function bindAddress(env: Record<string, string | undefined>) {
  if (env.BEYOND_HOSTED !== '1') return { hosted: false, hostname: '127.0.0.1', port: PORT };
  return { hosted: true, hostname: '0.0.0.0', port: Number(env.PORT) || PORT };
}

/** The phone's address. Hosted, the server does not know its public URL, so the page resolves a relative link. */
export const phoneLink = (hosted: boolean, ip: string | null): string | null =>
  hosted ? PHONE_PATH : ip ? `http://${ip}:${VITE_PORT}${PHONE_PATH}` : null;

/** Hosted, there is no Vite: this one server sends the built pages next to /api. */
export function serveBuild(app: Hono, root: string) {
  app.get('/', (c) => c.redirect('/controller.html'));
  app.use('*', serveStatic({ root }));
}
