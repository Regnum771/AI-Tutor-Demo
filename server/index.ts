import './env';
import { serve } from '@hono/node-server';
import { networkInterfaces } from 'node:os';
import { anthropicClient } from './agents/client';
import { createApp } from './app';
import { pickLanIp } from './lan';
import { DemoSession } from './session';

const PORT = 8787;
const VITE_PORT = 5173;

/** The laptop's Wi-Fi/LAN address, for the phone QR code. */
const lanIp = (): string | null => process.env.BEYOND_HOST || pickLanIp(networkInterfaces());

const client = anthropicClient();
const session = new DemoSession(client);
const info = () => {
  const ip = lanIp();
  return { lanUrl: ip ? `http://${ip}:${VITE_PORT}/student.html?live` : null, offline: client === null };
};

serve({ fetch: createApp(session, info).fetch, port: PORT, hostname: '127.0.0.1' }, () => {
  console.log(`[beyond] booth server on http://localhost:${PORT} · ${client ? 'agents online' : 'offline: canned answers'}`);
  console.log(`[beyond] phone: ${info().lanUrl ?? 'no LAN address found'}`);
});
