import { groq } from "@ai-sdk/groq";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { cookies } from "next/headers";
import {
  clearSlots,
  getOrCreateSession,
  type LeadSlots,
  type ServiceSlots,
  writeSlots,
} from "@/lib/session/store";
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
 * Wraps each tool's execute function with the slot interceptor described in
 * docs/adr/0010-session-store-slot-state-ky-http-client.md §Decision 2.
 *
 * - Writes tool arguments into the session's stage-scoped slot bag BEFORE
 *   calling execute (args are already Zod-validated by the AI SDK at this point).
 * - Clears the slot bag AFTER a successful CRM write ({ success: true }).
 * - Tools with no slot bag mapping (lookupVehicleModel, searchDeal, etc.) pass
 *   through untouched — the if/else chain is intentionally exhaustive.
 */
function withSlotInterceptor(
  rawTools: typeof tools,
  sessionId: string
): typeof tools {
  function wrapExecute(
    name: string,
    execute: (args: unknown) => Promise<unknown>
  ) {
    return async (args: unknown) => {
      // Write slots into the session before the CRM call.
      if (name === "createLead") {
        writeSlots(sessionId, "lead", args as Partial<LeadSlots>);
      } else if (name === "createServiceCase") {
        writeSlots(sessionId, "service", args as Partial<ServiceSlots>);
      }

      const result = (await execute(args)) as { success?: boolean } | null;

      // Clear the slot bag on a confirmed CRM write.
      if (result?.success === true) {
        if (name === "createLead") {
          clearSlots(sessionId, "lead");
        }
        if (name === "createServiceCase") {
          clearSlots(sessionId, "service");
        }
      }

      return result;
    };
  }

  return {
    ...rawTools,
    createLead: {
      ...rawTools.createLead,
      execute: wrapExecute(
        "createLead",
        rawTools.createLead.execute as unknown as (
          args: unknown
        ) => Promise<unknown>
      ) as never,
    },
    createServiceCase: {
      ...rawTools.createServiceCase,
      execute: wrapExecute(
        "createServiceCase",
        rawTools.createServiceCase.execute as unknown as (
          args: unknown
        ) => Promise<unknown>
      ) as never,
    },
  };
}

/**
 * The only route in the app.
 *
 * Session management (ADR-0010):
 * - Reads the `mah-sid` HTTP-only cookie set on the first request.
 * - Creates a new server-side session if no cookie is present, and instructs
 *   the browser to store the session ID via Set-Cookie on the response.
 * - Conversation history is still held client-side by useChat (resent in full
 *   each request) — the session store is for slot state only, not message
 *   transport. The useChat contract is unchanged; no client code was modified.
 */
export async function POST(req: Request) {
  const cookieStore = await cookies();

  let sessionId = cookieStore.get("mah-sid")?.value;
  const isNewSession = !sessionId;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }

  // Ensure the session record exists in the store.
  getOrCreateSession(sessionId);

  const { messages }: { messages: UIMessage[] } = await req.json();

  const interceptedTools = withSlotInterceptor(tools, sessionId);

  const result = streamText({
    // Kept from the Gemini era even though Groq hasn't shown this failure
    // mode in this session's testing — cheap insurance, not evidence Groq
    // needs it. See docs/adr/0004-gemini-pro-as-llm-provider.md.
    maxRetries: 0,
    messages: await convertToModelMessages(messages, {
      tools: interceptedTools,
    }),
    model: groq(MODEL_ID),
    // Without this, streamText stops right after a tool call instead of
    // continuing on to turn the tool's result into a reply for the customer.
    stopWhen: stepCountIs(5),
    system: SYSTEM_PROMPT,
    timeout: 20_000,
    tools: interceptedTools,
  });

  const response = result.toUIMessageStreamResponse();

  // Pin the session cookie on the very first response. HttpOnly prevents
  // client-side JS from reading the session ID (XSS-safe). SameSite=Lax
  // is sufficient for a same-origin chat app. Path=/ ensures the cookie is
  // sent on every subsequent request to /api/chat.
  if (isNewSession) {
    response.headers.set(
      "Set-Cookie",
      `mah-sid=${sessionId}; HttpOnly; SameSite=Lax; Path=/`
    );
  }

  return response;
}
