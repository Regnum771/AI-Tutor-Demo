import '../env';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { anthropicClient, model } from '../agents/client';
import { CASES, type Case } from './cases';
import { Budget, metered, newUsage, STAGES, T, textOf, type Check, type LoopPoint, type Turn, type Usage } from './harness';

/**
 * The agent eval: 36 cases from one-fact lookups to the closed feedback loop under pressure, graded on the live demo state.
 *
 *   npm run eval                       all cases, real API
 *   npm run eval -- --offline          control run on the canned fallback (free): the graders must fail most of it
 *   npm run eval -- --level 1,2        some levels
 *   npm run eval -- --only L4.3,L5.1   some cases
 *   npm run eval -- --repeat 2         each case twice, to expose flaky behaviour
 *   npm run eval -- --cap 6            stop spending at $6 (default)
 */
const flag = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i < 0 ? null : process.argv[i + 1] ?? '';
};
const offline = process.argv.includes('--offline');
const levels = flag('level')?.split(',').map(Number) ?? null;
const only = flag('only')?.split(',') ?? null;
const repeat = Number(flag('repeat') ?? 1);
const concurrency = Number(flag('concurrency') ?? 4);
const budget = new Budget(Number(flag('cap') ?? 6));
const CASE_TIMEOUT_MS = 300_000;

interface Result {
  id: string; level: number; title: string; run: number; pass: boolean; ms: number;
  checks: Check[]; turns: Omit<Turn, 'msg'>[]; loop: LoopPoint[]; usage: Usage;
  /** The final conversations (including unprompted adapt updates) and plans, for reading a run back. */
  conversations: unknown[]; plans: unknown[];
}

const real = offline ? null : anthropicClient();
if (!offline && !real) {
  console.error('No client: set ANTHROPIC_API_KEY in .env.local, or pass --offline for the control run.');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const dir = join('docs', 'evals');
mkdirSync(dir, { recursive: true });
const base = join(dir, `${stamp}${offline ? '-offline' : ''}`);
const jsonl = `${base}.jsonl`;
writeFileSync(jsonl, '');

const timeout = (ms: number) => new Promise<never>((_, reject) => { setTimeout(() => reject(new Error(`case timed out after ${ms / 1000} s`)), ms).unref(); });

async function runCase(c: Case, run: number): Promise<Result> {
  const usage = newUsage();
  const t = new T(real ? metered(real, usage, budget) : null);
  const started = Date.now();
  try {
    await Promise.race([c.run(t), timeout(CASE_TIMEOUT_MS)]);
  } catch (e) {
    t.checks.push({ stage: 'Sense', name: 'the case ran to the end', pass: false, detail: e instanceof Error ? e.message : String(e) });
  }
  const r: Result = {
    id: c.id, level: c.level, title: c.title, run, ms: Date.now() - started, usage, loop: t.loop, checks: t.checks,
    pass: t.checks.length > 0 && t.checks.every((x) => x.pass),
    turns: t.turns.map(({ msg: _msg, ...turn }) => turn),
    plans: t.state.plans,
    conversations: t.state.conversations.map((c) => ({
      id: c.id,
      title: c.title,
      msgs: c.msgs.map((m) => (m.role === 'teacher' ? m : { role: m.role, source: m.source, stamp: m.stamp, text: textOf(m) })),
    })),
  };
  appendFileSync(jsonl, `${JSON.stringify(r)}\n`);
  const failed = t.checks.filter((x) => !x.pass).length;
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${c.id.padEnd(6)} ${(r.ms / 1000).toFixed(1).padStart(6)} s  $${usage.cost.toFixed(3)}  ${c.title}${failed ? `  (${failed} of ${t.checks.length} checks failed)` : ''}`);
  return r;
}

const chosen = CASES.filter((c) => (!levels || levels.includes(c.level)) && (!only || only.includes(c.id)));
const queue = Array.from({ length: repeat }, (_, run) => chosen.map((c) => ({ c, run }))).flat();
const results: Result[] = [];
const started = Date.now();
await Promise.all(Array.from({ length: concurrency }, async () => {
  for (let job = queue.shift(); job; job = queue.shift()) results.push(await runCase(job.c, job.run));
}));
results.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id, undefined, { numeric: true }) || a.run - b.run);

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : 'n/a');
const bar = (a: number, b: number) => {
  const n = b ? Math.round((a / b) * 20) : 0;
  return `${'█'.repeat(n)}${'░'.repeat(20 - n)}`;
};
const allChecks = results.flatMap((r) => r.checks);
const passed = results.filter((r) => r.pass).length;
const total = results.reduce((u, r) => ({
  calls: u.calls + r.usage.calls, input: u.input + r.usage.input, output: u.output + r.usage.output,
  cacheRead: u.cacheRead + r.usage.cacheRead, cacheWrite: u.cacheWrite + r.usage.cacheWrite, cost: u.cost + r.usage.cost,
}), newUsage());
const turns = results.flatMap((r) => r.turns).map((t) => t.ms).sort((a, b) => a - b);
const quantile = (q: number) => (turns.length ? `${(turns[Math.min(turns.length - 1, Math.floor(q * turns.length))] / 1000).toFixed(1)} s` : 'n/a');

const LEVEL_NAME = ['', 'Sense: one lookup, one fact', 'Diagnose: reasoning over evidence', 'Intervene and Oversee: plans with the teacher in charge', 'Adapt: the closed loop', 'Hard: pressure, traps and failure', 'The student’s semester: plans, replans and the road to the exam'];
const lines: string[] = [];
const out = (s = '') => lines.push(s);
out(`# Beyond agent eval, ${stamp.replace('T', ' ')}`);
out();
out(`**${offline ? 'Control run: offline fallback, no agents' : `Model \`${model()}\`, effort \`${process.env.BEYOND_EFFORT ?? 'medium'}\``}.** ${passed} of ${results.length} cases passed (${pct(passed, results.length)}), ${allChecks.filter((c) => c.pass).length} of ${allChecks.length} checks passed (${pct(allChecks.filter((c) => c.pass).length, allChecks.length)}).`);
out();
out(`Wall time ${((Date.now() - started) / 1000).toFixed(0)} s · ${total.calls} model calls · estimated cost $${total.cost.toFixed(2)} · question latency median ${quantile(0.5)}, slowest ${quantile(0.999)}.`);
out();
out('## The feedback loop');
out();
out('Every check belongs to one stage of the loop the product claims to close.');
out();
out('```');
out('Sense ──▶ Diagnose ──▶ Intervene ──▶ Oversee ──▶ Adapt');
out('  ▲                                                 │');
out('  └──────────── new evidence from the phone ◀───────┘');
out('```');
out();
out('| Stage | Checks passed | |');
out('|---|---|---|');
for (const stage of STAGES) {
  const cs = allChecks.filter((c) => c.stage === stage);
  const ok = cs.filter((c) => c.pass).length;
  out(`| ${stage} | ${ok} of ${cs.length} (${pct(ok, cs.length)}) | \`${bar(ok, cs.length)}\` |`);
}
out();
out('## By level');
out();
out('| Level | Cases passed | Checks passed |');
out('|---|---|---|');
for (let level = 1; level <= 6; level++) {
  const rs = results.filter((r) => r.level === level);
  if (rs.length === 0) continue;
  const cs = rs.flatMap((r) => r.checks);
  out(`| ${level}. ${LEVEL_NAME[level]} | ${rs.filter((r) => r.pass).length} of ${rs.length} | ${cs.filter((c) => c.pass).length} of ${cs.length} |`);
}
out();
const loops = results.filter((r) => r.loop.length > 0);
if (loops.length) {
  out('## Loop trajectories');
  out();
  out('Measured on the live state after each cycle: the target concept, the student’s band, and the class need-support count.');
  out();
  for (const r of loops) {
    out(`**${r.id} ${r.title}**${r.run ? ` (run ${r.run + 1})` : ''}`);
    out();
    out('```');
    out(r.loop.map((p) => `${p.label} @${p.clock}: ${p.value.toFixed(2)} ${p.status}, ${p.needSupport} need support`).join('\n  ▶ '));
    out('```');
    out();
  }
}
const failures = results.filter((r) => !r.pass);
if (failures.length) {
  out('## Failures');
  out();
  for (const r of failures) {
    out(`### ${r.id} ${r.title}${r.run ? ` (run ${r.run + 1})` : ''}`);
    out();
    for (const c of r.checks.filter((x) => !x.pass)) out(`- **${c.stage}: ${c.name}**${c.detail ? `  \n  ${c.detail.replace(/\n/g, ' ').slice(0, 400)}` : ''}`);
    out();
  }
}
out('## All cases');
out();
out('| Case | Result | Checks | Time | Cost | |');
out('|---|---|---|---|---|---|');
for (const r of results) out(`| ${r.id}${r.run ? ` #${r.run + 1}` : ''} | ${r.pass ? 'pass' : '**FAIL**'} | ${r.checks.filter((c) => c.pass).length}/${r.checks.length} | ${(r.ms / 1000).toFixed(1)} s | $${r.usage.cost.toFixed(3)} | ${r.title} |`);
out();
out(`Full transcripts, one case per line: \`${jsonl.replace(/\\/g, '/')}\`.`);
writeFileSync(`${base}.md`, `${lines.join('\n')}\n`);

console.log(`\n${passed}/${results.length} cases, ${allChecks.filter((c) => c.pass).length}/${allChecks.length} checks, $${total.cost.toFixed(2)}, ${((Date.now() - started) / 1000).toFixed(0)} s`);
console.log(`Report: ${base}.md`);
process.exit(0);
