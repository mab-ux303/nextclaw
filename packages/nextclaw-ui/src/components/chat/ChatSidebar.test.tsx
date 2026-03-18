import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatRunStatusStore } from '@/components/chat/stores/chat-run-status.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  setQuery: vi.fn(),
  selectSession: vi.fn(),
  docOpen: vi.fn()
}));

vi.mock('@/components/chat/presenter/chat-presenter-context', () => ({
  usePresenter: () => ({
    chatSessionListManager: {
      createSession: mocks.createSession,
      setQuery: mocks.setQuery,
      selectSession: mocks.selectSession
    }
  })
}));

vi.mock('@/components/doc-browser', () => ({
  useDocBrowser: () => ({
    open: mocks.docOpen
  })
}));

vi.mock('@/components/common/BrandHeader', () => ({
  BrandHeader: () => <div data-testid="brand-header" />
}));

vi.mock('@/components/common/StatusBadge', () => ({
  StatusBadge: () => <div data-testid="status-badge" />
}));

vi.mock('@/components/providers/I18nProvider', () => ({
  useI18n: () => ({
    language: 'en',
    setLanguage: vi.fn()
  })
}));

vi.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'warm',
    setTheme: vi.fn()
  })
}));

vi.mock('@/stores/ui.store', () => ({
  useUiStore: (selector: (state: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: 'connected' })
}));

describe('ChatSidebar', () => {
  beforeEach(() => {
    mocks.createSession.mockReset();
    mocks.setQuery.mockReset();
    mocks.selectSession.mockReset();
    mocks.docOpen.mockReset();

    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        defaultSessionType: 'native',
        sessionTypeOptions: [
          { value: 'native', label: 'Native' },
          { value: 'codex', label: 'Codex' }
        ]
      }
    });
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        sessions: [],
        query: '',
        isLoading: false
      }
    });
    useChatRunStatusStore.setState({
      snapshot: {
        ...useChatRunStatusStore.getState().snapshot,
        sessionRunStatusByKey: new Map()
      }
    });
  });

  it('closes the create-session menu after choosing a non-default session type', async () => {
    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('Session Type'));
    fireEvent.click(screen.getByText('Codex'));

    expect(mocks.createSession).toHaveBeenCalledWith('codex');
    await waitFor(() => {
      expect(screen.queryByText('Codex')).toBeNull();
    });
  });
});
