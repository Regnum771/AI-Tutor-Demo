import { describe, expect, it } from 'vitest';
import { failingClient, fakeClient, refusingClient } from './fakeClient';
import { AgentError, runAgent, type AgentSpec } from './loop';

const schema = (prop: string) => ({ type: 'object' as const, properties: { [prop]: { type: 'string' } }, required: [prop], additionalProperties: false });

const spec = (over: Partial<AgentSpec<string>> = {}): AgentSpec<string> => ({
  system: 'You are a test agent.',
  tools: [
    { name: 'lookup', description: 'Look something up', input_schema: schema('q'), strict: true },
    { name: 'done', description: 'Finish', input_schema: schema('answer'), strict: true },
  ],
  finish: 'done',
  check: (input) => {
    const a = (input as { answer?: unknown }).answer;
    return typeof a === 'string' && a !== 'bad' ? { ok: true, value: a } : { ok: false, error: 'answer must not be "bad"' };
  },
  exec: (name, input) => ({ name, echo: input.q }),
  label: (name, input) => `Agent · ${name} ${String(input.q)}`,
  ...over,
});
const user = [{ role: 'user' as const, content: 'question' }];
const quiet = { onStep: () => {} };

describe('runAgent', () => {
  it('runs read tools, reports steps and returns the checked finish input', async () => {
    const { client, calls } = fakeClient([[{ tool: 'lookup', input: { q: 'x' } }], [{ tool: 'done', input: { answer: '42' } }]]);
    const steps: string[] = [];
    await expect(runAgent(client, spec(), user, { onStep: (l) => steps.push(l) })).resolves.toBe('42');
    expect(steps).toEqual(['Agent · lookup x']);
    expect(calls).toHaveLength(2);
    expect(calls[1].messages.at(-1)).toEqual({
      role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1_0', content: JSON.stringify({ name: 'lookup', echo: 'x' }) }],
    });
  });
  it('sends the cached system prompt and the refusal fallback, with auto tool choice', async () => {
    const { client, calls } = fakeClient([[{ tool: 'done', input: { answer: 'ok' } }]]);
    await runAgent(client, spec(), user, quiet);
    const p = calls[0];
    expect(p.system).toEqual([{ type: 'text', text: 'You are a test agent.', cache_control: { type: 'ephemeral' } }]);
    expect(p.fallbacks).toBe('default');
    expect(p.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(p.tool_choice).toBeUndefined();
    expect(p.model).toBe(process.env.BEYOND_MODEL ?? 'claude-sonnet-5-5');
  });
  it('returns an error result for an invalid finish input once, then accepts a fix', async () => {
    const { client, calls } = fakeClient([[{ tool: 'done', input: { answer: 'bad' } }], [{ tool: 'done', input: { answer: 'good' } }]]);
    await expect(runAgent(client, spec(), user, quiet)).resolves.toBe('good');
    expect(calls[1].messages.at(-1)).toEqual({
      role: 'user', content: [{ type: 'tool_result', tool_use_id: 'tu_1_0', content: 'answer must not be "bad"', is_error: true }],
    });
  });
  it('gives up after a second invalid finish input', async () => {
    const { client } = fakeClient([[{ tool: 'done', input: { answer: 'bad' } }], [{ tool: 'done', input: { answer: 'bad' } }]]);
    await expect(runAgent(client, spec(), user, quiet)).rejects.toThrow(AgentError);
  });
  it('treats a check that throws on malformed input like an invalid input', async () => {
    const { client, calls } = fakeClient([[{ tool: 'done', input: { answer: 'x' } }], [{ tool: 'done', input: { answer: 'ok' } }]]);
    let first = true;
    const throwing = spec({ check: (input) => {
      if (first) { first = false; throw new TypeError('blocks is not iterable'); }
      return { ok: true, value: (input as { answer: string }).answer };
    } });
    await expect(runAgent(client, throwing, user, quiet)).resolves.toBe('ok');
    expect(JSON.stringify(calls[1].messages.at(-1))).toContain('Malformed done input (blocks is not iterable)');
  });
  it('nudges once when a turn ends without the finish tool', async () => {
    const { client, calls } = fakeClient([[{ text: 'Here you go.' }], [{ tool: 'done', input: { answer: 'ok' } }]]);
    await expect(runAgent(client, spec(), user, quiet)).resolves.toBe('ok');
    expect(calls[1].messages.at(-1)).toEqual({ role: 'user', content: 'Finish by calling the done tool.' });
    const twice = fakeClient([[{ text: 'a' }], [{ text: 'b' }]]);
    await expect(runAgent(twice.client, spec(), user, quiet)).rejects.toThrow('no done call');
  });
  it('turns a failing read tool into an error result', async () => {
    const { client, calls } = fakeClient([[{ tool: 'lookup', input: { q: 'x' } }], [{ tool: 'done', input: { answer: 'ok' } }]]);
    await runAgent(client, spec({ exec: () => { throw new Error('Unknown student id s99.'); } }), user, quiet);
    expect(calls[1].messages.at(-1)).toMatchObject({ content: [{ is_error: true, content: 'Unknown student id s99.' }] });
  });
  it('stops on refusals, API errors and the turn cap', async () => {
    await expect(runAgent(refusingClient, spec(), user, quiet)).rejects.toThrow('refusal');
    await expect(runAgent(failingClient(), spec(), user, quiet)).rejects.toThrow('ECONNREFUSED');
    const loop = fakeClient(Array.from({ length: 3 }, () => [{ tool: 'lookup', input: { q: 'x' } }]));
    await expect(runAgent(loop.client, spec(), user, { ...quiet, maxTurns: 3 })).rejects.toThrow('too many turns');
  });
});
