export type ChatChain = 'legacy' | 'ncp';

const DEFAULT_CHAT_CHAIN: ChatChain = 'ncp';

function normalizeChatChain(value: string | null | undefined): ChatChain | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'legacy' || normalized === 'ncp') {
    return normalized;
  }
  return null;
}

export function resolveChatChain(search: string): ChatChain {
  const fromSearch = normalizeChatChain(new URLSearchParams(search).get('chatChain'));
  if (fromSearch) {
    return fromSearch;
  }
  const fromEnv = normalizeChatChain(import.meta.env.VITE_CHAT_CHAIN);
  return fromEnv ?? DEFAULT_CHAT_CHAIN;
}
