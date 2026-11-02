import './env';
import { serve } from '@hono/node-server';
import { networkInterfaces } from 'node:os';
import { anthropicClient } from './agents/client';
import { createApp } from './app';
import { bindAddress, phoneLink, serveBuild } from './hosted';
import { pickLanIp } from './lan';
import { DemoSession } from './session';

const { hosted, hostname, port } = bindAddress(process.env);

/** The laptop's Wi-Fi/LAN address, for the phone QR code. */
const lanIp = (): string | null => process.env.BEYOND_HOST || pickLanIp(networkInterfaces());

const client = anthropicClient();
const session = new DemoSession(client);
const info = () => ({ lanUrl: phoneLink(hosted, lanIp()), offline: client === null });

const app = createApp(session, info);
if (hosted) serveBuild(app, 'dist');

serve({ fetch: app.fetch, port, hostname }, () => {
  console.log(`[beyond] booth server on http://localhost:${port} · ${client ? 'agents online' : 'offline: canned answers'}`);
  console.log(`[beyond] phone: ${info().lanUrl ?? 'no LAN address found'}`);
});
