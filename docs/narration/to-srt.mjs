// Builds narration.srt from the table in narration.md.
import { readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('.', import.meta.url);
const sec = (s) => { const [m, rest] = s.split(':'); return Number(m) * 60 + Number(rest); };
const ts = (x) => {
  const ms = Math.round(x * 1000);
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const rows = readFileSync(new URL('narration.md', dir), 'utf8').split('\n')
  .map((l) => l.match(/^\| (\d+:[\d.]+)–(\d+:[\d.]+) \|[^|]*\| (.+) \|$/)).filter(Boolean);
const srt = rows.map(([, a, b, text], i) => `${i + 1}\n${ts(sec(a))} --> ${ts(sec(b))}\n${text}\n`).join('\n');
writeFileSync(new URL('narration.srt', dir), srt);
console.log(`${rows.length} cues`);
