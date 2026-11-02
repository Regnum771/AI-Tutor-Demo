import './env';
import { planProblems } from '../src/live/plans';
import { anthropicClient } from './agents/client';
import { citableIds } from './agents/sas';
import { playOpenSession } from './playSession';
import { DemoSession } from './session';

/**
 * The whole agent path against the real API. One question: the answer must come from the agents, cite real evidence and
 * produce a plan that passes the policy. Then the phone runs that plan to its mastery check: the update must come from the agents too.
 */
function fail(why: string): never {
  console.error(`FAIL: ${why}`);
  process.exit(1);
}
const must = (r: { ok: true } | { ok: false; error: string }) => {
  if (!r.ok) fail(r.error);
};

const client = anthropicClient() ?? fail('no client: set ANTHROPIC_API_KEY in .env.local and unset BEYOND_OFFLINE');
const session = new DemoSession(client);
const started = Date.now();
const r = session.ask('Why did Minh Anh’s quiz score drop?', null);
if (!r.ok) fail(r.error);
await r.done;

const conv = session.state.conversations[0];
const reply = conv.msgs[1];
if (!reply || reply.role !== 'assistant') fail('no answer');
if (reply.source !== 'agents') fail(`answered "${reply.source}" (see the [beyond] warning above for why)`);
const known = citableIds(session.state);
const cites = reply.blocks.flatMap((b) => b.cites);
if (cites.length === 0) fail('the answer cites no evidence');
const unknown = cites.filter((id) => !known.has(id));
if (unknown.length) fail(`unknown evidence ids: ${unknown.join(', ')}`);
const plan = session.state.plans[0];
if (!plan) fail('the question produced no plan: see the [beyond] warning above');
const problems = planProblems(plan, session.state);
if (problems.length) fail(`plan breaks the policy: ${problems.join(' ')}`);
console.log(`ANSWER in ${((Date.now() - started) / 1000).toFixed(1)} s · "${conv.title}" · ${cites.length} citations · plan: ${plan.kind}, ${plan.sessions.length} sessions`);
for (const b of reply.blocks) console.log(`  ${b.kind === 'li' ? '•' : ' '} ${b.text}  [${b.cites.join(', ')}]`);

if (plan.kind !== 'pathway') fail(`the question produced a ${plan.kind} plan: the phone path needs a pathway`);
const check = plan.sessions.findIndex((s) => s.isMasteryCheck);
const concept = plan.sessions[check]?.concept;
if (!concept) fail('the plan has no mastery check on a practice concept');
must(session.approve(plan.id));
must(session.phonePlan());
must(session.phoneSkip());
must(session.phoneOpen(check));
await playOpenSession(session);

const update = session.state.conversations[0].msgs.at(-1);
if (update?.role !== 'assistant') fail('no update after the mastery check');
if (update.source !== 'agents') fail(`the update came from "${update.source}" (see the [beyond] warning above for why)`);
const followUp = session.state.plans.find((p) => p.id !== plan.id);
console.log(`ADAPT · follow-up: ${followUp ? `${followUp.status}, ${followUp.sessions.length} sessions` : 'none'}`);
for (const b of update.blocks) console.log(`  ${b.kind === 'li' ? '•' : ' '} ${b.text}`);
console.log(`PASS in ${((Date.now() - started) / 1000).toFixed(1)} s`);
process.exit(0);
