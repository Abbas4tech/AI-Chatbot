"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { ChatContainer } from "@/components/chat/chat-container";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, regenerate } = useChat();

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

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.currentTarget.value);
  };

  return (
    <ChatContainer
      error={error}
      input={input}
      messages={messages}
      onInputChange={handleInputChange}
      onRetry={regenerate}
      onSubmit={handleSubmit}
      onSuggestionClick={handleSuggestionClick}
      status={status}
    />
  );
}
