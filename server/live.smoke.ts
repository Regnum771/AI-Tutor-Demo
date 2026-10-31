import './env';
import { planProblems } from '../src/live/plans';
import { anthropicClient } from './agents/client';
import { evidenceIds } from './agents/sas';
import { DemoSession } from './session';

/** One real question against the API: the answer must come from the agents, cite real evidence, and any plan must pass the policy. */
const fail = (why: string): never => {
  console.error(`FAIL: ${why}`);
  process.exit(1);
};

const client = anthropicClient() ?? fail('no client: set ANTHROPIC_API_KEY in .env.local and unset BEYOND_OFFLINE');
const session = new DemoSession(client);
const started = Date.now();
const r = session.ask('Why did Minh Anh’s quiz score drop?', null);
if (!r.ok) fail(r.error);
else await r.done;

const conv = session.state.conversations[0];
const reply = conv.msgs[1];
if (!reply || reply.role !== 'assistant') fail('no answer');
else {
  if (reply.source !== 'agents') fail(`answered "${reply.source}" (see the [beyond] warning above for why)`);
  const known = evidenceIds(session.state);
  const cites = reply.blocks.flatMap((b) => b.cites);
  if (cites.length === 0) fail('the answer cites no evidence');
  const unknown = cites.filter((id) => !known.has(id));
  if (unknown.length) fail(`unknown evidence ids: ${unknown.join(', ')}`);
  const plan = session.state.plans[0];
  if (plan) {
    const problems = planProblems(plan, session.state);
    if (problems.length) fail(`plan breaks the policy: ${problems.join(' ')}`);
  }
  console.log(`PASS in ${((Date.now() - started) / 1000).toFixed(1)} s · "${conv.title}" · ${cites.length} citations · plan: ${plan ? `${plan.kind}, ${plan.sessions.length} sessions` : 'none'}`);
  for (const b of reply.blocks) console.log(`  ${b.kind === 'li' ? '•' : ' '} ${b.text}  [${b.cites.join(', ')}]`);
}
