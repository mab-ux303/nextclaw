import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatConversationPanel } from '@/components/chat/ChatConversationPanel';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  goToProviders: vi.fn()
}));

vi.mock('@nextclaw/agent-chat-ui', () => ({
  useStickyBottomScroll: () => ({
    onScroll: vi.fn()
  })
}));

vi.mock('@/components/chat/nextclaw', () => ({
  ChatInputBarContainer: () => <div data-testid="chat-input-bar" />,
  ChatMessageListContainer: () => <div data-testid="chat-message-list" />
}));

vi.mock('@/components/chat/ChatWelcome', () => ({
  ChatWelcome: () => <div data-testid="chat-welcome" />
}));

vi.mock('@/components/chat/presenter/chat-presenter-context', () => ({
  usePresenter: () => ({
    chatThreadManager: {
      deleteSession: mocks.deleteSession,
      goToProviders: mocks.goToProviders,
      createSession: vi.fn()
    }
  })
}));

describe('ChatConversationPanel', () => {
  beforeEach(() => {
    mocks.deleteSession.mockReset();
    mocks.goToProviders.mockReset();
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        isProviderStateResolved: true,
        modelOptions: [{ value: 'openai/gpt-5.1', modelLabel: 'gpt-5.1', providerLabel: 'OpenAI' } as never],
        sessionTypeLabel: 'Codex',
        selectedSessionKey: null,
        sessionDisplayName: undefined,
        canDeleteSession: false,
        isDeletePending: false,
        isHistoryLoading: false,
        uiMessages: [],
        isSending: false,
        isAwaitingAssistantOutput: false
      }
    });
  });

  it('shows the draft session type in the conversation header', () => {
    render(<ChatConversationPanel />);

    expect(screen.getByText('New Task')).toBeTruthy();
    expect(screen.getByText('Codex')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
