/**
 * Slot interceptor — wraps tool execute functions with session slot side-effects.
 * See docs/adr/0010-session-store-slot-state-ky-http-client.md §Decision 2.
 *
 * Single responsibility: write args into the stage-scoped slot bag before the
 * CRM call, and clear the bag after a confirmed write ({ success: true }).
 * All other tools pass through untouched via the rawTools spread.
 *
 * Extracted from app/api/chat/route.ts so the route can focus solely on HTTP
 * concerns (cookie management, streamText invocation).
 */

import {
  clearSlots,
  type LeadSlots,
  type ServiceSlots,
  writeSlots,
} from "@/lib/session/store";
import type { tools } from "@/lib/tools";

function wrapExecute(
  name: string,
  sessionId: string,
  execute: (args: unknown) => Promise<unknown>
) {
  return async (args: unknown) => {
    // Write args into the slot bag before the CRM call. Args are already
    // Zod-validated by the AI SDK at this point so the cast is safe.
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

/**
 * Returns a copy of `rawTools` where `createLead` and `createServiceCase`
 * have their execute functions wrapped with slot side-effects for the given
 * session. All other tools are returned as-is via the spread.
 */
export function withSlotInterceptor(
  rawTools: typeof tools,
  sessionId: string
): typeof tools {
  return {
    ...rawTools,
    createLead: {
      ...rawTools.createLead,
      execute: wrapExecute(
        "createLead",
        sessionId,
        rawTools.createLead.execute as unknown as (
          args: unknown
        ) => Promise<unknown>
      ) as never,
    },
    createServiceCase: {
      ...rawTools.createServiceCase,
      execute: wrapExecute(
        "createServiceCase",
        sessionId,
        rawTools.createServiceCase.execute as unknown as (
          args: unknown
        ) => Promise<unknown>
      ) as never,
    },
  };
}
