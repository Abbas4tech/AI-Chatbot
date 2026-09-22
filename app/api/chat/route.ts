import { groq } from "@ai-sdk/groq";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { cookies } from "next/headers";
import { withSlotInterceptor } from "@/lib/session/interceptor";
import { getOrCreateSession } from "@/lib/session/store";
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
 * The only route in the app.
 *
 * Session management (ADR-0010):
 * - Reads the `mah-sid` HTTP-only cookie on every request.
 * - Creates a new server-side session on the first request and pins the ID
 *   via Set-Cookie on the response.
 * - Conversation history is held client-side by useChat (resent in full each
 *   request) — the session store is for slot state only, not message transport.
 *   The useChat contract is unchanged; no client code was modified.
 *
 * Slot interception is delegated to lib/session/interceptor.ts.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();

  let sessionId = cookieStore.get("mah-sid")?.value;
  const isNewSession = !sessionId;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }

  getOrCreateSession(sessionId);

  const { messages }: { messages: UIMessage[] } = await req.json();

  const interceptedTools = withSlotInterceptor(tools, sessionId);

  const result = streamText({
    // Kept from the Gemini era even though Groq hasn't shown this failure
    // mode — cheap insurance. See docs/adr/0004-gemini-pro-as-llm-provider.md.
    maxRetries: 0,
    messages: await convertToModelMessages(messages, {
      tools: interceptedTools,
    }),
    model: groq(MODEL_ID),
    // Without this, streamText stops right after a tool call instead of
    // continuing to turn the tool result into a reply for the customer.
    stopWhen: stepCountIs(5),
    system: SYSTEM_PROMPT,
    timeout: 20_000,
    tools: interceptedTools,
  });

  const response = result.toUIMessageStreamResponse();

  // Pin the session cookie on the very first response. HttpOnly prevents
  // client-side JS from reading the session ID (XSS-safe). SameSite=Lax
  // is sufficient for a same-origin chat app. Path=/ ensures the cookie is
  // sent on every subsequent /api/chat request.
  if (isNewSession) {
    response.headers.set(
      "Set-Cookie",
      `mah-sid=${sessionId}; HttpOnly; SameSite=Lax; Path=/`
    );
  }

  return response;
}
