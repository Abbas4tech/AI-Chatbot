---
status: accepted
---

# Server-side session store, explicit slot state, and `ky` as the HTTP client

## Context

The BRD (§3, Multistage AI Chat Agent) requires:

> **State Management**: Maintain conversational history and session state to
> seamlessly switch context between vehicle discovery and ticket creation.

The evaluation rubric awards **30% of the total score** to "Agent Design & Function
Calling", with "state persistence across turns" and "edge-case recovery" as explicit
sub-criteria.

ADR-0003 declared that session state would be kept in a server-side in-memory `Map`
keyed by session cookie. The built implementation diverged silently: the server is
stateless; `useChat` re-sends the entire message history on every request, and the
server reads it, feeds it to the LLM, and discards it. No `Map` was ever created, no
cookie was ever set.

Three concrete problems surface from that gap:

1. **No server-side slot state.** When the LLM is mid-way through collecting the four
   fields for a new Lead, those partial values exist only inside the raw message history.
   There is no authoritative server-side record of "we have `name` and `phone`, still
   need `email` and `city`". This is fragile under long conversations and invisible to
   debugging.

2. **Page refresh = full session loss.** `useChat` state lives in React's component
   tree. A tab refresh destroys it. The demo evaluator refreshes; context is gone.

3. **`zohoFetch` uses raw `fetch` with no timeout at the call-site level.** A hung Zoho
   call silently consumes the entire 20-second `streamText` budget.

## Decision

### 1 — Server-side session store (in-memory `Map`)

A module-level `Map<string, Session>` lives in `lib/session/store.ts`. The session is
keyed by a UUID stored in an **HTTP-only cookie** (`mah-sid`), set by the server on
the first `POST /api/chat` where no cookie is present.

The server reads the cookie on every request, looks up (or creates) the `Session`
record, and uses it for slot state only. The full `messages` array from the client
is still forwarded to the LLM unchanged — `useChat` contract is untouched.

On process restart the store is lost. Accepted trade-off (mitigated operationally).

### 2 — Explicit stage-scoped slot state

```ts
interface Session {
  id: string;
  createdAt: number;
  stageSlots: {
    lead?: Partial<LeadSlots>;
    service?: Partial<ServiceSlots>;
  };
}

interface LeadSlots {
  fullName: string;
  phone: string;
  email: string;
  preferredCity: string;
  vehicleModel: string;
}

interface ServiceSlots {
  fullName: string;
  phone: string;
  registrationNumber: string;
  odometerReading: number;
  issueDescription: string;
  serviceType: string;
  preferredCenter: string;
}
```

Stage-scoped bags prevent `phone` collected for a Lead from colliding with `phone`
collected for a Service Case — same real-world value, different CRM destinations.

**Slot population** — a thin interceptor in `route.ts` wraps each tool's `execute`
call. When the LLM resolves a tool call, the interceptor reads the validated arguments
and writes them into the appropriate slot bag. Zero prompt changes; deterministic.

**Slot reset** — after `createLead` or `createServiceCase` returns `{ success: true }`,
the corresponding slot bag is cleared. The slot bag means "in-progress, uncommitted
collection" — stale values cannot bleed into a second collection of the same type.

### 3 — `ky` as the HTTP client for Zoho API calls

A single shared `ky` instance replaces raw `fetch` in `lib/zoho/client.ts`:

- `prefixUrl`: `https://www.zohoapis.${dc}/crm/v8`
- `timeout`: 5000 ms (hard per-request ceiling)
- `beforeRequest` hook: calls `getAccessToken()` (caching + refresh logic unchanged),
  injects `Authorization: Zoho-oauthtoken <token>`

The token-refresh call (to `accounts.zoho.${dc}`) is a separate one-off `ky` call
with its own 5-second timeout and does not share the CRM instance.

## Considered options

### Session transport

| Option | Why not chosen |
|---|---|
| HTTP-only cookie **(chosen)** | Survives page refresh; XSS-safe; no client code change |
| `X-Session-Id` header (client-generated) | Client controls the key; `localStorage` loss orphans session |
| `sessionId` in JSON body | Visible in network tab; leaks token to JS that reads request bodies |

### Slot update mechanism

| Option | Why not chosen |
|---|---|
| Interceptor around tool `execute` **(chosen)** | Deterministic; typed args already validated by Zod; zero prompt changes |
| Explicit `updateSlots` tool | Extra LLM reasoning surface; additional failure mode during demos |
| Post-success parsing | Only captures committed writes, not mid-collection partial state |

### HTTP client

| Option | Why not chosen |
|---|---|
| `ky` **(chosen)** | Fetch-based; TypeScript-first; 3 KB; `beforeRequest` hook; `timeout` built-in |
| `ofetch` | Similar ergonomics; primarily Nuxt-ecosystem; heavier |
| Raw `fetch` | Per-call timeouts require manual `AbortController`; no hooks |

## Consequences

- First `POST /api/chat` response must include `Set-Cookie: mah-sid=<uuid>; HttpOnly`.
  In Next.js App Router: `cookies().set()` from `next/headers` inside the route handler.
- The in-memory `Map` is not shared across serverless invocations. Not a concern for
  `next dev` demo mode. Future upgrade path: replace `Map` with Upstash Redis; session
  key and slot shape stay identical.
- `ky` adds one production runtime dependency.
- Tool interceptor logic is a pure cross-cutting concern layered above individual tool
  files — `create-lead.ts` and `create-service-case.ts` are untouched.
- Slot state is **supplementary** to message history. The LLM still reads the full
  client message payload each turn; slot store is for server-side auditability and
  partial-collection tracking.

## Update: the "page refresh = full session loss" problem from Context was only half-solved here

This ADR's own Context section listed page refresh as one of three motivating problems, but the Decision above only ever addressed slot state — the visible message transcript itself was never persisted anywhere, client or server. That gap sat live and undocumented until a direct question surfaced it: refreshing the page really did wipe the entire visible conversation, leaving the slot bag this ADR builds as the *only* survivor — which is invisible to the user and, at the time, wasn't even read back into a new conversation.

[ADR-0012](./0012-client-side-conversation-persistence.md) closes that remaining half with `localStorage` persistence of the message transcript, client-side. The two layers are complementary, not overlapping: this ADR's slot bags track *partial CRM-write progress* server-side (survives reload, not a server restart); ADR-0012 tracks the *visible transcript* client-side (survives reload, not a cleared browser). Read ADR-0012 for why message history specifically wasn't folded into this ADR's `Session` type — it's a deliberate separation, not an oversight.

## Related

[ADR-0003](./0003-zoho-rest-sync-in-memory-session.md) — this ADR supersedes the
session-persistence section of 0003 ·
[ADR-0006](./0006-llm-native-intent-routing.md) — tool routing; the interceptor sits
above the same dispatch ·
[BRD §3](../resources/FDE%20Candidate%20Assessment%20BRD%20.md)
