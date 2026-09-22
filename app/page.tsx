"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const SUGGESTIONS = [
  "What's the price of the XUV700?",
  "I want to check my test drive status, my phone is +91 91234 56789",
  "What's the delivery status for booking MAH-9921?",
  "I need to book a service for my Thar",
];

export default function ChatPage() {
  const { messages, sendMessage, status, error, regenerate } = useChat();
  const [input, setInput] = useState("");

  const isBusy = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || isBusy) return;
    sendMessage({ text: input });
    setInput("");
  }

  return (
    <div className="mx-auto flex h-dvh max-w-3xl flex-col p-4">
      <header className="mb-4 border-b pb-4">
        <h1 className="text-xl font-semibold">Mahindra AI Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Ask about vehicles, check your booking, or log a service request.
        </p>
      </header>

      <ScrollArea className="flex-1 pr-2">
        {messages.length === 0 && (
          <div className="grid gap-2 pt-4">
            {SUGGESTIONS.map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                className="h-auto justify-start whitespace-normal text-left"
                onClick={() => sendMessage({ text: suggestion })}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-4 pb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback>{message.role === "user" ? "You" : "AI"}</AvatarFallback>
              </Avatar>

              <div className={`flex max-w-[80%] flex-col gap-2 ${message.role === "user" ? "items-end" : "items-start"}`}>
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <Card
                        key={`${message.id}-text-${index}`}
                        className={`px-3 py-2 text-sm ${
                          message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                      >
                        {part.text}
                      </Card>
                    );
                  }

                  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                    const toolPart = part as unknown as {
                      type: string;
                      toolName?: string;
                      state: string;
                      output?: unknown;
                    };
                    const toolName = toolPart.toolName ?? part.type.replace("tool-", "");
                    return (
                      <Badge key={`${message.id}-tool-${index}`} variant="secondary" className="font-mono text-xs">
                        {toolName} · {toolPart.state}
                      </Badge>
                    );
                  }

                  return null;
                })}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <Card className="mb-4 flex items-center justify-between gap-3 border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
            <span>
              Something went wrong reaching the assistant. This is usually transient (e.g. the model
              provider under high load) — try again.
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => regenerate()}>
              Retry
            </Button>
          </Card>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t pt-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isBusy}
        />
        <Button type="submit" disabled={isBusy || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
