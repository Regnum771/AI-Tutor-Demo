import type Anthropic from '@anthropic-ai/sdk';
import { request, type MessagesClient } from './client';

export type Check<T> = (input: unknown) => { ok: true; value: T } | { ok: false; error: string };

export interface AgentSpec<T> {
  system: string;
  tools: Anthropic.Beta.BetaTool[];
  /** The tool whose call ends the run; its checked input is the result. */
  finish: string;
  check: Check<T>;
  /** Runs a read tool. Throwing sends an error result back to the model. */
  exec(name: string, input: Record<string, unknown>): unknown;
  /** Thinking-line copy for a tool call, or null to show nothing. */
  label(name: string, input: Record<string, unknown>): string | null;
}

export interface RunOptions {
  onStep(line: string): void;
  signal?: AbortSignal;
  maxTurns?: number;
}

export class AgentError extends Error {}

/** Manual tool-use loop: read tools run locally until the model calls `spec.finish` with an input that passes `spec.check`. */
export async function runAgent<T>(client: MessagesClient, spec: AgentSpec<T>, messages: Anthropic.Beta.BetaMessageParam[], opts: RunOptions): Promise<T> {
  const history = [...messages];
  let finishRetries = 1;
  let nudged = false;
  for (let turn = 0; turn < (opts.maxTurns ?? 8); turn++) {
    const res = await client.create(request(spec.system, spec.tools, history), { signal: opts.signal });
    if (res.stop_reason === 'refusal') throw new AgentError('refusal');
    if (res.stop_reason === 'max_tokens') throw new AgentError('max_tokens');
    // Append the full content (thinking blocks included) so the history stays append-only.
    history.push({ role: 'assistant', content: res.content });
    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (uses.length === 0) {
      if (nudged) throw new AgentError(`no ${spec.finish} call`);
      nudged = true;
      history.push({ role: 'user', content: `Finish by calling the ${spec.finish} tool.` });
      continue;
    }
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of uses) {
      const input = (use.input ?? {}) as Record<string, unknown>;
      if (use.name === spec.finish) {
        const checked = spec.check(input);
        if (checked.ok) return checked.value;
        if (finishRetries-- <= 0) throw new AgentError(checked.error);
        results.push({ type: 'tool_result', tool_use_id: use.id, content: checked.error, is_error: true });
        continue;
      }
      const line = spec.label(use.name, input);
      if (line) opts.onStep(line);
      try {
        results.push({ type: 'tool_result', tool_use_id: use.id, content: JSON.stringify(spec.exec(use.name, input)) });
      } catch (e) {
        results.push({ type: 'tool_result', tool_use_id: use.id, content: e instanceof Error ? e.message : String(e), is_error: true });
      }
    }
    history.push({ role: 'user', content: results });
  }
  throw new AgentError('too many turns');
}
