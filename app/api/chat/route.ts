import { groq } from "@ai-sdk/groq";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { tools } from "@/lib/tools";

export const maxDuration = 30;

/**
 * Switched from Gemini to Groq — see docs/adr/0004-gemini-pro-as-llm-provider.md's
 * final update for the full trail (Gemini's free tier repeatedly failed to
 * produce a first token within 20s, confirmed live with a timestamped SSE
 * trace, not guessed).
 *
 * "llama-3.3-70b-versatile" (ADR-0009's original choice, matching the BRD's
 * own example) returned 404 model_not_found on the first live request —
 * Groq's lineup moved on since the @ai-sdk/groq package's bundled type
 * strings were published; the SDK's TypeScript types listing a model don't
 * mean it's still live. Confirmed the actual current lineup by querying
 * Groq's /openai/v1/models endpoint directly rather than guessing again.
 * "openai/gpt-oss-120b": one of the few general-purpose (non-audio,
 * non-moderation) chat models actually active on this account, large
 * enough for reliable tool-argument extraction, still Groq-hosted.
 */
const MODEL_ID = "openai/gpt-oss-120b";

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
    // Kept from the Gemini era even though Groq hasn't shown this failure
    // mode in this session's testing — cheap insurance, not evidence Groq
    // needs it. See docs/adr/0004-gemini-pro-as-llm-provider.md.
    maxRetries: 0,
    messages: await convertToModelMessages(messages, { tools }),
    model: groq(MODEL_ID),
    // Without this, streamText stops right after a tool call instead of
    // continuing on to turn the tool's result into a reply for the customer.
    stopWhen: stepCountIs(5),
    system: SYSTEM_PROMPT,
    timeout: 20_000,
    tools,
  });

  return result.toUIMessageStreamResponse();
}
