import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { bindAddress, phoneLink, serveBuild } from './hosted';
import { DemoSession } from './session';

describe('bindAddress', () => {
  it('keeps the local booth on loopback, where only the Vite proxy reaches it', () => {
    expect(bindAddress({})).toEqual({ hosted: false, hostname: '127.0.0.1', port: 8787 });
  });
  it('does not expose a laptop just because its shell has PORT set', () => {
    expect(bindAddress({ PORT: '3000' })).toEqual({ hosted: false, hostname: '127.0.0.1', port: 8787 });
  });
  it('listens on every interface on the port the host assigns', () => {
    expect(bindAddress({ BEYOND_HOSTED: '1', PORT: '3000' })).toEqual({ hosted: true, hostname: '0.0.0.0', port: 3000 });
  });
  it('falls back to the usual port when the host assigns none', () => {
    expect(bindAddress({ BEYOND_HOSTED: '1' })).toEqual({ hosted: true, hostname: '0.0.0.0', port: 8787 });
  });
});

describe('phoneLink', () => {
  it('points the local phone at Vite on the laptop', () => {
    expect(phoneLink(false, '192.168.1.20')).toBe('http://192.168.1.20:5173/student.html?live');
  });
  it('is empty when the laptop has no network', () => {
    expect(phoneLink(false, null)).toBeNull();
  });
  it('is relative when hosted, so the page resolves it against the public URL', () => {
    expect(phoneLink(true, '10.0.0.5')).toBe('/student.html?live');
  });
});

describe('serveBuild', () => {
  const root = mkdtempSync(join(tmpdir(), 'beyond-build-'));
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'teacher.html'), '<title>Teacher</title>');
  writeFileSync(join(root, 'assets', 'app.js'), 'run()');
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const setup = () => {
    const app = createApp(new DemoSession(null), () => ({ lanUrl: '/student.html?live', offline: true }));
    serveBuild(app, root);
    return app;
  };

  it('sends a bare visit to the Director', async () => {
    const r = await setup().request('/');
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('/controller.html');
  });
  it('serves the built pages and assets with their query strings ignored', async () => {
    const app = setup();
    const page = await app.request('/teacher.html?scene=4&t=17000');
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toContain('text/html');
    expect(await page.text()).toBe('<title>Teacher</title>');
    expect(await (await app.request('/assets/app.js')).text()).toBe('run()');
  });
  it('leaves the API answering next to the build', async () => {
    const r = await setup().request('/api/info');
    expect(await r.json()).toEqual({ lanUrl: '/student.html?live', offline: true });
  });
  it('answers 404 for anything else', async () => {
    expect((await setup().request('/missing.html')).status).toBe(404);
  });
});
