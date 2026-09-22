"use client";

import type { useChat } from "@ai-sdk/react";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { ChatSuggestions } from "@/components/chat/chat-empty-state";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import { Button } from "@/components/ui/button";

type ChatState = ReturnType<typeof useChat>;

interface ChatContainerProps {
  error: ChatState["error"];
  input: string;
  messages: ChatState["messages"];
  onInputChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onRetry: () => void;
  onSubmit: (message: PromptInputMessage) => void;
  onSuggestionClick: (suggestion: string) => void;
  status: ChatState["status"];
}

/**
 * Top-level layout: header, message list, error banner, empty-state
 * suggestions, and the prompt input — wired to state/handlers owned by
 * app/page.tsx's useChat call. Extracted from app/page.tsx per ADR-0011.
 */
export function ChatContainer({
  messages,
  status,
  error,
  input,
  onInputChange,
  onSubmit,
  onSuggestionClick,
  onRetry,
}: ChatContainerProps) {
  const isBusy = status === "submitted" || status === "streaming";

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col px-4 py-5 md:px-6 md:py-6">
      <ChatHeader />

      <ChatMessageList messages={messages} />

      {error ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          <span>
            Something went wrong reaching the assistant. This is usually
            transient (e.g. the model provider under high load) — try again.
          </span>
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            Retry
          </Button>
        </div>
      ) : null}

      {messages.length === 0 && (
        <ChatSuggestions onSuggestionClick={onSuggestionClick} />
      )}

      <PromptInput className="mt-5" onSubmit={onSubmit}>
        <PromptInputTextarea
          className="min-h-[4.5rem] px-4 py-3.5 text-base md:text-base"
          onChange={onInputChange}
          placeholder="Type your message..."
          value={input}
        />
        <PromptInputSubmit
          className="mr-1.5 mb-1.5 size-9 rounded-full"
          disabled={!input.trim() || isBusy}
          size="icon-sm"
          status={status}
        />
      </PromptInput>
    </div>
  );
}
