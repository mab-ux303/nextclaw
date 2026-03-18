import { describe, expect, it, vi } from 'vitest';
import { resolveChatChain } from '@/components/chat/chat-chain';

describe('resolveChatChain', () => {
  it('defaults to ncp when no query or env override is provided', () => {
    vi.stubEnv('VITE_CHAT_CHAIN', '');

    expect(resolveChatChain('')).toBe('ncp');
  });

  it('allows explicit legacy rollback from query string', () => {
    vi.stubEnv('VITE_CHAT_CHAIN', 'ncp');

    expect(resolveChatChain('?chatChain=legacy')).toBe('legacy');
  });

  it('accepts env override when query string is absent', () => {
    vi.stubEnv('VITE_CHAT_CHAIN', 'legacy');

    expect(resolveChatChain('')).toBe('legacy');
  });
});
