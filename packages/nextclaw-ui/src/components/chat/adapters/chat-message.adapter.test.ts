import { ToolInvocationStatus, type UiMessage } from '@nextclaw/agent-chat';
import { adaptChatMessages } from '@/components/chat/adapters/chat-message.adapter';

describe('adaptChatMessages', () => {
  it('maps markdown, reasoning, and tool parts into UI view models', () => {
    const messages: UiMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        meta: {
          status: 'final',
          timestamp: '2026-03-17T10:00:00.000Z'
        },
        parts: [
          { type: 'text', text: 'hello world' },
          {
            type: 'reasoning',
            reasoning: 'internal reasoning',
            details: []
          },
          {
            type: 'tool-invocation',
            toolInvocation: {
              status: ToolInvocationStatus.RESULT,
              toolCallId: 'call-1',
              toolName: 'web_search',
              args: '{"q":"hello"}',
              result: { ok: true }
            }
          }
        ]
      }
    ];

    const adapted = adaptChatMessages({
      uiMessages: messages,
      formatTimestamp: (value) => `formatted:${value}`,
      texts: {
        roleLabels: {
          user: 'You',
          assistant: 'Assistant',
          tool: 'Tool',
          system: 'System',
          fallback: 'Message'
        },
        reasoningLabel: 'Reasoning',
        toolCallLabel: 'Tool Call',
        toolResultLabel: 'Tool Result',
        toolNoOutputLabel: 'No output',
        toolOutputLabel: 'View Output'
      }
    });

    expect(adapted).toHaveLength(1);
    expect(adapted[0]?.roleLabel).toBe('Assistant');
    expect(adapted[0]?.timestampLabel).toBe('formatted:2026-03-17T10:00:00.000Z');
    expect(adapted[0]?.parts.map((part) => part.type)).toEqual(['markdown', 'reasoning', 'tool-card']);
    expect(adapted[0]?.parts[2]).toMatchObject({
      type: 'tool-card',
      card: {
        titleLabel: 'Tool Call',
        outputLabel: 'View Output'
      }
    });
  });

  it('maps non-standard roles back to the generic message role', () => {
    const adapted = adaptChatMessages({
      uiMessages: [
        {
          id: 'data-1',
          role: 'data',
          parts: [{ type: 'text', text: 'payload' }]
        }
      ],
      formatTimestamp: () => 'formatted',
      texts: {
        roleLabels: {
          user: 'You',
          assistant: 'Assistant',
          tool: 'Tool',
          system: 'System',
          fallback: 'Message'
        },
        reasoningLabel: 'Reasoning',
        toolCallLabel: 'Tool Call',
        toolResultLabel: 'Tool Result',
        toolNoOutputLabel: 'No output',
        toolOutputLabel: 'View Output'
      }
    });

    expect(adapted[0]?.role).toBe('message');
    expect(adapted[0]?.roleLabel).toBe('Message');
  });
});
