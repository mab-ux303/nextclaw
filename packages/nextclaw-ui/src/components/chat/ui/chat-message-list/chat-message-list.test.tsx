import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatMessageList } from '@/components/chat/ui/chat-message-list/chat-message-list';

describe('ChatMessageList', () => {
  it('renders user, assistant, and tool content and supports code copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText
      }
    });

    render(
      <ChatMessageList
        messages={[
          {
            id: 'user-1',
            role: 'user',
            roleLabel: 'You',
            timestampLabel: '10:00',
            parts: [{ type: 'markdown', text: 'Hello' }]
          },
          {
            id: 'assistant-1',
            role: 'assistant',
            roleLabel: 'Assistant',
            timestampLabel: '10:01',
            parts: [{ type: 'markdown', text: '```ts\nconst x = 1;\n```' }]
          },
          {
            id: 'tool-1',
            role: 'tool',
            roleLabel: 'Tool',
            timestampLabel: '10:02',
            parts: [
              {
                type: 'tool-card',
                card: {
                  kind: 'result',
                  toolName: 'web_search',
                  hasResult: true,
                  titleLabel: 'Tool Result',
                  outputLabel: 'View Output',
                  emptyLabel: 'No output',
                  output: 'done'
                }
              }
            ]
          }
        ]}
        isSending
        hasStreamingDraft={false}
        texts={{
          copyCodeLabel: 'Copy',
          copiedCodeLabel: 'Copied',
          typingLabel: 'Typing...'
        }}
      />
    );

    expect(screen.getByText('You · 10:00')).toBeTruthy();
    expect(screen.getByText('Assistant · 10:01')).toBeTruthy();
    expect(screen.getByText('Tool Result')).toBeTruthy();
    expect(screen.getByText('Typing...')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('const x = 1;');
    });
  });
});
