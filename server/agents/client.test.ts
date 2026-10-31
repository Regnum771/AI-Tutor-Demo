import { afterEach, describe, expect, it, vi } from 'vitest';
import { anthropicClient } from './client';

describe('anthropicClient', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is offline without credentials or with BEYOND_OFFLINE=1', () => {
    vi.stubEnv('BEYOND_OFFLINE', '');
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
    expect(anthropicClient()).toBeNull();
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    expect(anthropicClient()).not.toBeNull();
    vi.stubEnv('BEYOND_OFFLINE', '1');
    expect(anthropicClient()).toBeNull();
  });
});
