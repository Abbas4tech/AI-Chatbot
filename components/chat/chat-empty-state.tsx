"use client";

import { CarIcon } from "lucide-react";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";

const STARTER_PROMPTS = [
  "What's the price of the XUV700?",
  "I want to check my test drive status, my phone is +91 91234 56789",
  "What's the delivery status for booking MAH-9921?",
  "I need to book a service for my Thar",
];

/**
 * Empty-conversation hero shown inside the message list before the first
 * turn. Extracted from app/page.tsx per ADR-0011.
 */
export function ChatEmptyStateHero() {
  return (
    <ConversationEmptyState
      className="gap-4 py-16"
      description="Ask about a vehicle, check a booking, or log a service request."
      icon={<CarIcon className="size-10" />}
      title="Start a conversation"
    />
  );
}

/**
 * Quick-start suggestion chips — one example per lifecycle stage (BRD §2).
 * Rendered below the prompt input only while the conversation is empty.
 */
export function ChatSuggestions({
  onSuggestionClick,
}: {
  onSuggestionClick: (suggestion: string) => void;
}) {
  return (
    <Suggestions className="mt-5 gap-2.5">
      {STARTER_PROMPTS.map((suggestion) => (
        <Suggestion
          className="h-9 px-4 text-sm"
          key={suggestion}
          onClick={onSuggestionClick}
          size="lg"
          suggestion={suggestion}
        />
      ))}
    </Suggestions>
  );
}
