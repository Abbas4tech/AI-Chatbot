---
status: accepted
---

# Client-side conversation persistence via `localStorage`

## Context

A direct question surfaced a real gap: "If I reload the app, will all chats be gone?" The answer, at the time, was yes — `useChat` (`app/page.tsx`) holds `messages` only in React component state. Nothing persists it: no `localStorage`, no server-side message store, no `id`/resume wiring against the AI SDK's chat persistence. A reload resets `messages` to `[]`.

This traces back to [ADR-0010](./0010-session-store-slot-state-ky-http-client.md)'s own Context section, which listed "page refresh = full session loss" as one of three problems motivating the session store — but ADR-0010's actual Decision and Consequences scoped the fix to **slot state only** ("Slot state is supplementary to message history. The LLM still reads the full client message payload each turn..."). The visible conversation transcript was never addressed. That gap sat undocumented as a live risk until this question surfaced it directly.

**What the BRD actually requires here — checked word-for-word, not assumed** (§3, Technical Requirements):

> **State Management:** Maintain conversational history and session state to seamlessly switch context between vehicle discovery and ticket creation.

And the rubric (§6):

> **Agent Design & Function Calling (30%)**: Accuracy in tool routing, **state persistence across turns**, edge-case recovery.

Neither line mentions browser refresh or reload. Both are about **context-switching within one continuous session** (e.g. a user moving from a pricing question straight into a service complaint without restarting) and **turn-to-turn memory within that session** — both of which were already solid before this ADR, via LLM-native routing ([ADR-0006](./0006-llm-native-intent-routing.md)) and the full message history being resent every turn. **This ADR is not fixing a literal BRD requirement.** It's closing a gap that a BRD-adjacent risk analysis surfaced: an evaluator refreshing the page mid-review would see an empty chat with no indication anything had happened, which reads as broken regardless of whether the BRD technically mandates surviving that action. That judgment call was made explicitly with the user, not assumed unilaterally.

## Decision

Persist `useChat`'s `messages` array to `localStorage` (key: `mahindra-chat-messages`), restored on mount.

Implementation (`app/page.tsx`):

- **Load, once, in a `useEffect`** — not in `useState`'s initializer. The page is statically prerendered (`○ /` in the build output), so the server-rendered HTML always reflects an empty conversation. Reading `localStorage` in the initializer would run on the client's first render too, before hydration reconciles against that server HTML, and could disagree with it — the classic hydration-mismatch failure mode. Loading in an effect guarantees the exact same first paint as the server, then swaps in the saved conversation immediately after, client-only.
- **A `isHydrated` state flag, not just a ref, gates the persist effect.** The load effect and the persist effect (`useEffect` on `[messages]`) both run on mount. Without the gate, the persist effect fires first with `messages` still `[]` (the load effect's `setMessages` call is an async state update, not applied yet in the same commit) and overwrites the very history being restored. `isHydrated` starts `false`, flips to `true` inside the load effect, and the persist effect no-ops until it sees `true` — by which point `messages` reflects the restored value.
- **`try`/`catch` around every `localStorage` call.** Private browsing, a full quota, or a disabled storage API should degrade to "this session won't be remembered," never a crash.

## Considered options

1. **`localStorage` persistence (chosen).** Restores the full visible transcript — user turns, assistant replies, tool-call cards — exactly as they were. Solves the actual failure mode (evaluator refreshes, sees nothing) completely, not partially.
2. **Inject the existing slot bag (ADR-0010) into the system prompt when a session already has partial data.** Considered and rejected as the primary fix: once option 1 restores the full message history, the model already sees its own prior turns (including what it already asked for and collected) — this would be redundant in the normal case. It would only add value in the narrow edge case of `localStorage` being cleared while the `mah-sid` cookie and server-side slot bag survive (different browser profile pointed at the same server process, manual storage wipe) — judged too rare to justify the added complexity for this project's scope.
3. **Do nothing; document as a known limitation.** Rejected — the fix is small (~30 lines, no new dependencies, no new files) and the failure mode is exactly the kind of rough edge a demo evaluator is likely to hit by accident.

## Consequences

- **Per-browser, not per-account.** A different browser or a different machine starts with an empty conversation — expected and acceptable for a single-user demo app with no auth layer.
- **No expiry or manual clear.** A stale conversation from earlier testing persists indefinitely until `localStorage` is cleared by other means. Acceptable for a take-home assessment; a production version would want a visible "New conversation" action and/or a TTL.
- **Two independent persistence layers now exist, deliberately, not redundantly:**
  - Server-side (`lib/session/store.ts`, ADR-0010): stage-scoped **slot bags** — partial CRM-write progress, keyed by the `mah-sid` cookie. Survives a page reload but not a dev-server restart, and is invisible to the user.
  - Client-side (this ADR): the **visible message transcript** — everything the user actually sees. Survives a page reload but not a cleared browser profile or a different device.
  Neither alone covered the realistic demo scenario (evaluator refreshes mid-conversation on the same browser); together they do.
- **`CONTEXT.md`'s "Session" glossary entry needed a clarifying line** — it already stated a Session excludes the message log, but that clarification now points here for where the message log *is* actually persisted, rather than leaving "the client re-sends it each turn" as the only explanation.

## Verification

Live-tested in a real browser, not inferred from the code alone — `chromium-cli` and Playwright were both unavailable in this environment, so `puppeteer-core` was installed (scratchpad only, no project dependency added) and pointed at the system's existing Google Chrome install:

1. Started the dev server, navigated to the app.
2. Sent "What's the price of the XUV700?", waited for the full tool-call (`lookupVehicleModel`) and the assistant's streamed reply to complete.
3. Screenshotted, reloaded the page, waited for the restore effect, screenshotted again.
4. **Before and after reload were pixel-identical** — the tool-call card, the price figures, and the test-drive follow-up question all survived intact. Zero console errors (`page.on("console"/"pageerror")` both empty).

## Related

[ADR-0010](./0010-session-store-slot-state-ky-http-client.md) — server-side slot state; this ADR is the message-history counterpart it explicitly left unaddressed · [ADR-0003](./0003-zoho-rest-sync-in-memory-session.md) — original state-management decision · [ADR-0006](./0006-llm-native-intent-routing.md) — why context-switching works without a separate router · `CONTEXT.md` "Session" entry · [BRD §3, §6](../resources/FDE%20Candidate%20Assessment%20BRD%20.md)
