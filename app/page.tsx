"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { ChatContainer } from "@/components/chat/chat-container";

const STORAGE_KEY = "mahindra-chat-messages";

function loadStoredMessages(): UIMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UIMessage[]) : [];
  } catch {
    return [];
  }
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const { messages, sendMessage, status, error, regenerate, setMessages } =
    useChat();

  // Restore a previously saved conversation once, after mount. Kept out of
  // useState's initializer so the server-prerendered empty state and the
  // client's first paint match (no hydration mismatch) — the saved history
  // is swapped in right after, via setMessages.
  useEffect(() => {
    const stored = loadStoredMessages();
    if (stored.length > 0) {
      setMessages(stored);
    }
    setIsHydrated(true);
  }, [setMessages]);

  // Persist on every change, but only once the stored conversation (if any)
  // has actually been loaded — otherwise this fires on mount with an empty
  // `messages` array and overwrites the history we're about to restore.
  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Storage full or unavailable (e.g. private browsing) — chat still
      // works, it just won't survive a reload this time.
    }
  }, [messages, isHydrated]);

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
