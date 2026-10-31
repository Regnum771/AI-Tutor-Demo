import { existsSync } from 'node:fs';

// Imported first by server/index.ts so the key and BEYOND_* settings are in place before anything reads them.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
