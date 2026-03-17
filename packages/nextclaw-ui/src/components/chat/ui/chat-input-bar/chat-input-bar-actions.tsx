import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChatInputBarActionsProps } from '@/components/chat/view-models/chat-ui.types';
import { ArrowUp, Square } from 'lucide-react';

export function ChatInputBarActions(props: ChatInputBarActionsProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      {props.sendError?.trim() ? (
        <div className="max-w-[420px] text-right text-[11px] text-red-600">{props.sendError}</div>
      ) : null}
      <div className="flex items-center gap-2">
        {props.isSending ? (
          props.canStopGeneration ? (
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded-full"
              aria-label={props.stopButtonLabel}
              onClick={() => void props.onStop()}
              disabled={props.stopDisabled}
            >
              <Square className="h-3 w-3 fill-current" />
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 rounded-full"
                      aria-label={props.stopButtonLabel}
                      disabled
                    >
                      <Square className="h-3 w-3 fill-current" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-xs">{props.stopHint}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        ) : (
          <Button
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label={props.sendButtonLabel}
            onClick={() => void props.onSend()}
            disabled={props.sendDisabled}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
