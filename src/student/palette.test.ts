import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'src/student');
/** Screens not restyled yet. Each restyle task removes its file; the last one deletes this set. */
const PENDING = new Set(['screens/PlanScreen.tsx', 'screens/PracticeScreen.tsx', 'screens/ProgressScreen.tsx']);
/** Inline hex is allowed only for egg tokens (keep in sync with tailwind.config.js). */
const EGG_HEX = new Set([
  '#F2EDE4', '#F8F4EC', '#FFFDF8', '#DCD3C5', '#1A1714', '#6B6359', '#9C9285', '#FF5B1F', '#FFE5D6',
  '#4F7A5A', '#E4EDE3', '#B5452F', '#F6E1DA',
]);
const BANNED = [/\bC\.(royal|twin)\b/, /\b(slate|purple|violet|indigo|blue|green|red)-\d{2,3}\b/, /\bbg-white\b/, /\btext-white\b/];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('phone palette', () => {
  for (const file of sources(ROOT)) {
    const rel = relative(ROOT, file).replace(/\\/g, '/');
    if (PENDING.has(rel)) continue;
    it(`${rel} uses only egg colours`, () => {
      const src = readFileSync(file, 'utf8');
      for (const re of BANNED) expect(src, `${rel} matches ${re}`).not.toMatch(re);
      const hexes = src.match(/#[0-9A-Fa-f]{6}\b/g) ?? [];
      expect(hexes.filter((h) => !EGG_HEX.has(h.toUpperCase())), `${rel} has non-egg hex`).toEqual([]);
    });
  }
});
