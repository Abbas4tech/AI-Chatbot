"use client";

import type { useChat } from "@ai-sdk/react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { ChatEmptyStateHero } from "@/components/chat/chat-empty-state";
import { MessagePart } from "@/components/chat/message-part";

type Messages = ReturnType<typeof useChat>["messages"];

/**
 * Scrollable message list: empty-state hero when there's no history yet,
 * otherwise one <Message> per turn with role-based alignment. Extracted
 * from app/page.tsx per ADR-0011.
 */
export function ChatMessageList({ messages }: { messages: Messages }) {
  return (
    <Conversation className="min-h-0 flex-1">
      <ConversationContent className="gap-8 p-2 md:p-4">
        {messages.length === 0 ? (
          <ChatEmptyStateHero />
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
  );
}
