import { fireEvent, render, screen } from '@testing-library/react';
import { ChatInputBar } from '@/components/chat/ui/chat-input-bar/chat-input-bar';
import type { ChatInputBarProps } from '@/components/chat/view-models/chat-ui.types';

function createInputBarProps(overrides?: Partial<ChatInputBarProps>): ChatInputBarProps {
  return {
    value: 'Hello',
    placeholder: 'Type a message',
    disabled: false,
    onValueChange: vi.fn(),
    onKeyDown: vi.fn(),
    slashMenu: {
      anchorRef: { current: null },
      listRef: { current: null },
      isOpen: false,
      isLoading: false,
      items: [],
      activeIndex: 0,
      activeItem: null,
      texts: {
        slashLoadingLabel: 'Loading',
        slashSectionLabel: 'Skills',
        slashEmptyLabel: 'No result',
        slashHintLabel: 'Hint',
        slashSkillHintLabel: 'Enter to add'
      },
      onSelectItem: vi.fn(),
      onOpenChange: vi.fn(),
      onSetActiveIndex: vi.fn()
    },
    hint: null,
    selectedItems: {
      items: [],
      onRemove: vi.fn()
    },
    toolbar: {
      selects: [],
      actions: {
        isSending: false,
        canStopGeneration: false,
        sendDisabled: false,
        stopDisabled: true,
        stopHint: 'Stop unavailable',
        sendButtonLabel: 'Send',
        stopButtonLabel: 'Stop',
        onSend: vi.fn(),
        onStop: vi.fn()
      }
    },
    ...overrides
  };
}

describe('ChatInputBar', () => {
  it('renders placeholder, selected chips, and calls chip removal', () => {
    const onRemove = vi.fn();

    render(
      <ChatInputBar
        {...createInputBarProps({
          value: '',
          selectedItems: {
            items: [{ key: 'skill:web-search', label: 'Web Search' }],
            onRemove
          }
        })}
      />
    );

    expect(screen.getByPlaceholderText('Type a message')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Web Search/i }));
    expect(onRemove).toHaveBeenCalledWith('skill:web-search');
  });

  it('switches between send and stop controls', () => {
    const onSend = vi.fn();
    const onStop = vi.fn();
    const { rerender } = render(
      <ChatInputBar
        {...createInputBarProps({
          toolbar: {
            selects: [],
            actions: {
              isSending: false,
              canStopGeneration: false,
              sendDisabled: false,
              stopDisabled: true,
              stopHint: 'Stop unavailable',
              sendButtonLabel: 'Send',
              stopButtonLabel: 'Stop',
              onSend,
              onStop
            }
          }
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalled();

    rerender(
      <ChatInputBar
        {...createInputBarProps({
          toolbar: {
            selects: [],
            actions: {
              isSending: true,
              canStopGeneration: true,
              sendDisabled: true,
              stopDisabled: false,
              stopHint: 'Stop unavailable',
              sendButtonLabel: 'Send',
              stopButtonLabel: 'Stop',
              onSend,
              onStop
            }
          }
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalled();
  });
});
