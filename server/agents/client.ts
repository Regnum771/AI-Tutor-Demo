import Anthropic from '@anthropic-ai/sdk';

export type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming;
export type AgentMessage = Anthropic.Beta.BetaMessage;

/** The one model call the agents make; tests pass a fake. */
export interface MessagesClient {
  create(params: CreateParams, options?: { signal?: AbortSignal }): Promise<AgentMessage>;
}

/** Read at call time so `.env.local` (loaded by server/env.ts) applies. */
export const model = (): string => process.env.BEYOND_MODEL || 'claude-sonnet-5-5';
const effort = (): 'low' | 'medium' | 'high' => {
  const e = process.env.BEYOND_EFFORT;
  return e === 'low' || e === 'high' ? e : 'medium';
};

/** Every agent request: cached static system prompt, strict tools, auto tool choice, server-side refusal fallback. */
export function request(system: string, tools: Anthropic.Beta.BetaTool[], messages: Anthropic.Beta.BetaMessageParam[]): CreateParams {
  return {
    model: model(),
    max_tokens: 8000,
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    tools,
    messages,
    output_config: { effort: effort() },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  };
}

/** The real client, or null when the booth runs offline: BEYOND_OFFLINE=1, or no key in the environment or `.env.local`. */
export function anthropicClient(): MessagesClient | null {
  if (process.env.BEYOND_OFFLINE === '1') return null;
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return null;
  const sdk = new Anthropic({ timeout: 25_000, maxRetries: 1 });
  return { create: (params, options) => sdk.beta.messages.create(params, options) };
}
