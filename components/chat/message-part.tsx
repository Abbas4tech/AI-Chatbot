"use client";

import type { useChat } from "@ai-sdk/react";
import type { ToolUIPart } from "ai";
import { MessageResponse } from "@/components/ai-elements/message";
import { ToolCard } from "@/components/chat/tool-card";

type Part = ReturnType<typeof useChat>["messages"][number]["parts"][number];

/**
 * Switches on message part type and renders the appropriate component.
 * Single responsibility: part-type dispatch — no layout, no state.
 *
 * Extracted from app/page.tsx per SOLID SRP.
 */
export function MessagePart({
  messageId,
  messageRole,
  part,
}: {
  messageId: string;
  messageRole: string;
  part: Part;
}) {
  if (part.type === "text") {
    return (
      <MessageResponse key={`${messageId}-text-${messageRole}`}>
        {part.text}
      </MessageResponse>
    );
  }

  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
    const toolPart = part as ToolUIPart;
    return <ToolCard key={toolPart.toolCallId} toolPart={toolPart} />;
  }

  return null;
}
