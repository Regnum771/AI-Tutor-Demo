import type { AgentMessage, CreateParams, MessagesClient } from './client';

export type FakeBlock = { tool: string; input: Record<string, unknown> } | { text: string };

const message = (n: number, content: unknown[], stop: string): AgentMessage =>
  ({
    id: `msg_${n}`, type: 'message', role: 'assistant', model: 'fake', content,
    stop_reason: stop, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 },
  }) as unknown as AgentMessage;

/** Replays one scripted assistant turn per request and records a copy of every request. */
export function fakeClient(turns: FakeBlock[][]) {
  const calls: CreateParams[] = [];
  let n = 0;
  const client: MessagesClient = {
    async create(params) {
      calls.push(structuredClone(params));
      const turn = turns[n++];
      if (!turn) throw new Error('fake client: script exhausted');
      const content = turn.map((b, i) =>
        'tool' in b ? { type: 'tool_use', id: `tu_${n}_${i}`, name: b.tool, input: b.input } : { type: 'text', text: b.text, citations: null });
      return message(n, content, content.some((c) => c.type === 'tool_use') ? 'tool_use' : 'end_turn');
    },
  };
  return { client, calls };
}

/** Every request fails, like an unreachable API. */
export const failingClient = (text = 'connect ECONNREFUSED'): MessagesClient => ({
  create: async () => {
    throw new Error(text);
  },
});

/** Every request is declined by the safety classifiers. */
export const refusingClient: MessagesClient = { create: async () => message(0, [], 'refusal') };
