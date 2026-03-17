import { type UiMessage } from '@nextclaw/agent-chat';
import {
  stringifyUnknown,
  summarizeToolArgs,
  type ToolCard
} from '@/lib/chat-message';
import type {
  ChatMessageRole,
  ChatMessageViewModel,
  ChatToolPartViewModel
} from '@/components/chat/view-models/chat-ui.types';

export type ChatMessageAdapterTexts = {
  roleLabels: {
    user: string;
    assistant: string;
    tool: string;
    system: string;
    fallback: string;
  };
  reasoningLabel: string;
  toolCallLabel: string;
  toolResultLabel: string;
  toolNoOutputLabel: string;
  toolOutputLabel: string;
};

function resolveMessageTimestamp(message: UiMessage): string {
  const candidate = message.meta?.timestamp;
  if (candidate && Number.isFinite(Date.parse(candidate))) {
    return candidate;
  }
  return new Date().toISOString();
}

function resolveRoleLabel(role: UiMessage['role'], texts: ChatMessageAdapterTexts['roleLabels']): string {
  if (role === 'user') {
    return texts.user;
  }
  if (role === 'assistant') {
    return texts.assistant;
  }
  if (role === 'tool') {
    return texts.tool;
  }
  if (role === 'system') {
    return texts.system;
  }
  return texts.fallback;
}

function resolveUiRole(role: UiMessage['role']): ChatMessageRole {
  if (role === 'user' || role === 'assistant' || role === 'tool' || role === 'system') {
    return role;
  }
  return 'message';
}

function buildToolCard(toolCard: ToolCard, texts: ChatMessageAdapterTexts): ChatToolPartViewModel {
  return {
    kind: toolCard.kind,
    toolName: toolCard.name,
    summary: toolCard.detail,
    output: toolCard.text,
    hasResult: Boolean(toolCard.hasResult),
    titleLabel: toolCard.kind === 'call' ? texts.toolCallLabel : texts.toolResultLabel,
    outputLabel: texts.toolOutputLabel,
    emptyLabel: texts.toolNoOutputLabel
  };
}

export function adaptChatMessages(params: {
  uiMessages: UiMessage[];
  texts: ChatMessageAdapterTexts;
  formatTimestamp: (value: string) => string;
}): ChatMessageViewModel[] {
  return params.uiMessages.map((message) => ({
    id: message.id,
    role: resolveUiRole(message.role),
    roleLabel: resolveRoleLabel(message.role, params.texts.roleLabels),
    timestampLabel: params.formatTimestamp(resolveMessageTimestamp(message)),
    status: message.meta?.status,
    parts: message.parts
      .map((part) => {
        if (part.type === 'text') {
          const text = part.text.trim();
          if (!text) {
            return null;
          }
          return {
            type: 'markdown' as const,
            text
          };
        }
        if (part.type === 'reasoning') {
          const text = part.reasoning.trim();
          if (!text) {
            return null;
          }
          return {
            type: 'reasoning' as const,
            text,
            label: params.texts.reasoningLabel
          };
        }
        if (part.type === 'tool-invocation') {
          const invocation = part.toolInvocation;
          const detail = summarizeToolArgs(invocation.parsedArgs ?? invocation.args);
          const rawResult = typeof invocation.error === 'string' && invocation.error.trim()
            ? invocation.error.trim()
            : invocation.result != null
              ? stringifyUnknown(invocation.result).trim()
              : '';
          const hasResult =
            invocation.status === 'result' || invocation.status === 'error' || invocation.status === 'cancelled';
          const card: ToolCard = {
            kind: invocation.status === 'result' && !invocation.args ? 'result' : 'call',
            name: invocation.toolName,
            detail,
            text: rawResult || undefined,
            callId: invocation.toolCallId || undefined,
            hasResult
          };
          return {
            type: 'tool-card' as const,
            card: buildToolCard(card, params.texts)
          };
        }
        return null;
      })
      .filter((part) => part !== null)
  }));
}
