import { google } from "@ai-sdk/google";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { tools } from "@/lib/tools";

export const maxDuration = 30;

/**
 * "gemini-pro-latest" (the model ADR-0004 originally specified) hit a
 * RESOURCE_EXHAUSTED free-tier quota error on the very first live request
 * during scaffolding — its free-tier daily/per-minute allowance is
 * apparently near-zero. "gemini-flash-latest" is on the same API key (no
 * new credential/signup needed, unlike the ADR's documented Groq fallback)
 * and was verified working end-to-end, including tool calling, in the same
 * session. ADR-0004 needs updating to reflect this; flagged to the user
 * rather than silently left undocumented.
 */
const MODEL_ID = "gemini-flash-latest";

/**
 * The only route in the app. Conversation history is held client-side by
 * useChat (resent in full each request) rather than in a server-side
 * session store — see docs/adr/0003-zoho-rest-sync-in-memory-session.md:
 * the substantive decision there (ephemeral, no database) is what this
 * satisfies; a redundant server-side Map would just duplicate what the
 * client already holds.
 */
export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google(MODEL_ID),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    // Without this, streamText stops right after a tool call instead of
    // continuing on to turn the tool's result into a reply for the customer.
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
