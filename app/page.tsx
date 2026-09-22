"use client";

import { useChat } from "@ai-sdk/react";
import { CarIcon } from "lucide-react";
import { useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { MessagePart } from "@/components/chat/message-part";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "What's the price of the XUV700?",
  "I want to check my test drive status, my phone is +91 91234 56789",
  "What's the delivery status for booking MAH-9921?",
  "I need to book a service for my Thar",
];

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, regenerate } = useChat();

  const isBusy = status === "submitted" || status === "streaming";

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text.trim()) {
      return;
    }
    sendMessage({ text: message.text });
    setInput("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  const handleRetry = () => {
    regenerate();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.currentTarget.value);
  };

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col px-4 py-5 md:px-6 md:py-6">
      <header className="mb-5 flex items-center gap-3 border-b pb-5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <CarIcon className="size-5" />
        </div>
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Mahindra AI Assistant
          </h1>
          <p className="text-muted-foreground text-sm">
            Ask about vehicles, check your booking, or log a service request.
          </p>
        </div>
      </header>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-8 p-2 md:p-4">
          {messages.length === 0 ? (
            <ConversationEmptyState
              className="gap-4 py-16"
              description="Ask about a vehicle, check a booking, or log a service request."
              icon={<CarIcon className="size-10" />}
              title="Start a conversation"
            />
          ) : (
            messages.map((message) => (
              <Message className="gap-3" from={message.role} key={message.id}>
                <MessageContent className="text-base leading-relaxed group-[.is-user]:rounded-3xl group-[.is-user]:px-5 group-[.is-user]:py-3.5">
                  {message.parts.map((part, index) => (
                    <MessagePart
                      // biome-ignore lint/suspicious/noArrayIndexKey: parts have no stable id of their own; this array is append-only within a streaming message
                      key={`${message.id}-part-${index}`}
                      messageId={message.id}
                      messageRole={message.role}
                      part={part}
                    />
                  ))}
                </MessageContent>
              </Message>
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          <span>
            Something went wrong reaching the assistant. This is usually
            transient (e.g. the model provider under high load) — try again.
          </span>
          <Button
            onClick={handleRetry}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      ) : null}

      {messages.length === 0 && (
        <Suggestions className="mt-5 gap-2.5">
          {SUGGESTIONS.map((suggestion) => (
            <Suggestion
              className="h-9 px-4 text-sm"
              key={suggestion}
              onClick={handleSuggestionClick}
              size="lg"
              suggestion={suggestion}
            />
          ))}
        </Suggestions>
      )}

      <PromptInput className="mt-5" onSubmit={handleSubmit}>
        <PromptInputTextarea
          className="min-h-[4.5rem] px-4 py-3.5 text-base md:text-base"
          onChange={handleInputChange}
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
