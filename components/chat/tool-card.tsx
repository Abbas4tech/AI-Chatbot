"use client";

import type { ToolUIPart } from "ai";
import { useEffect, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";

/**
 * Displays a single tool call as a collapsible card.
 *
 * Extracted from app/page.tsx — see docs/adr/0010-session-store-slot-state-ky-http-client.md.
 *
 * Its own component (not inlined in the message-parts map) for two reasons:
 * keeps `open` as a genuinely controlled prop — `defaultOpen` only sets
 * initial state, and `toolPart.state` changes on the same mounted
 * instance as a tool call progresses (input-streaming → output-available),
 * which Base UI warns about ("changing the default open state ... after
 * being initialized", confirmed live) — and `setOpen` from `useState` is
 * already a stable function reference, so `onOpenChange={setOpen}` needs no
 * wrapper closure per render.
 */
export function ToolCard({ toolPart }: { toolPart: ToolUIPart }) {
  const [open, setOpen] = useState(toolPart.state === "output-available");

  useEffect(() => {
    if (toolPart.state === "output-available") {
      setOpen(true);
    }
  }, [toolPart.state]);

  return (
    <Tool onOpenChange={setOpen} open={open}>
      <ToolHeader state={toolPart.state} type={toolPart.type} />
      <ToolContent>
        <ToolInput input={toolPart.input} />
        <ToolOutput
          errorText={toolPart.errorText}
          output={
            toolPart.output ? (
              <MessageResponse>
                {JSON.stringify(toolPart.output, null, 2)}
              </MessageResponse>
            ) : undefined
          }
        />
      </ToolContent>
    </Tool>
  );
}
