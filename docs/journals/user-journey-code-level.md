# Code-Level User Journey
## Scenario: Lead collection → pricing detour → service case (context switch)

This trace follows a single browser session through the architecture decided in
[ADR-0010](./adr/0010-session-store-slot-state-ky-http-client.md). Every numbered
step maps to a specific file or code path.

---

## Sequence Diagram

```mermaid
sequenceDiagram
    participant B as Browser (useChat)
    participant R as route.ts
    participant SS as lib/session/store.ts
    participant I as Slot Interceptor
    participant T as lib/tools/*
    participant K as ky (lib/zoho/http.ts)
    participant Z as Zoho CRM API

    Note over B,Z: Turn 1 — "Hi, I'm Rajan, interested in XUV700"

    B->>R: POST /api/chat { messages: [turn1] }
    Note over R: No mah-sid cookie present
    R->>SS: getOrCreateSession() → { id: "uuid-abc", stageSlots: {} }
    R-->>B: Set-Cookie: mah-sid=uuid-abc; HttpOnly
    R->>R: streamText(model, messages, tools)
    R-->>B: stream: "Great, Rajan! What city are you in..."

    Note over B,Z: Turn 2 — "Mumbai. Email rajan@x.com, phone 9876543210"

    B->>R: POST /api/chat { messages: [turn1, turn2] }
    Note over R: Cookie mah-sid=uuid-abc present
    R->>SS: getOrCreateSession("uuid-abc")
    R->>R: streamText → LLM calls createLead(args)
    R->>I: interceptToolCall("createLead", args)
    I->>SS: writeSlots("uuid-abc", "lead", { fullName, phone, email, preferredCity, vehicleModel })
    I->>T: createLead.execute(args)
    T->>K: ky.post("/Leads", { json: {...} })
    K->>K: beforeRequest hook → getAccessToken() [cached]
    K->>Z: POST /crm/v8/Leads
    Z-->>K: { data: [{ details: { id: "LEAD-001" } }] }
    K-->>T: { id: "LEAD-001" }
    T-->>I: { leadId: "LEAD-001", success: true }
    I->>SS: clearSlots("uuid-abc", "lead")
    I-->>R: { leadId: "LEAD-001", success: true }
    R-->>B: stream: "Done! Your test drive inquiry is registered..."

    Note over B,Z: Turn 3 — "What's the price of the XUV700 AX7 Diesel?"

    B->>R: POST /api/chat { messages: [turn1..turn3] }
    R->>SS: getOrCreateSession("uuid-abc")  ← stageSlots.lead is now {}
    R->>R: streamText → LLM calls lookupVehicleModel(args)
    R->>I: interceptToolCall("lookupVehicleModel", args)
    Note over I: no slot bag for this tool → no-op
    I->>T: lookupVehicleModel.execute(args)
    T-->>R: { model: "XUV700", variant: "AX7 Diesel", price: "₹25.5L" }
    R-->>B: stream: "The XUV700 AX7 Diesel is priced at ₹25.5 lakh..."

    Note over B,Z: Turn 4 — "My Scorpio-N MH01AB1234, odometer 12000km, AC not working"

    B->>R: POST /api/chat { messages: [turn1..turn4] }
    R->>SS: getOrCreateSession("uuid-abc")
    R->>R: streamText → LLM calls createServiceCase(args)
    R->>I: interceptToolCall("createServiceCase", args)
    I->>SS: writeSlots("uuid-abc", "service", { registrationNumber, odometerReading, ... })
    I->>T: createServiceCase.execute(args)
    T->>K: ky.get("/Contacts/search?criteria=...")
    K->>Z: search Contacts by phone
    Z-->>K: [] (no existing contact)
    T->>K: ky.post("/Contacts", { json: {...} })
    K->>Z: create Contact
    Z-->>K: { id: "CONTACT-007" }
    T->>K: ky.post("/Cases", { json: { Contact_Name: { id: "CONTACT-007" }, ... } })
    K->>Z: create Case
    Z-->>K: { id: "CASE-042" }
    T-->>I: { caseId: "CASE-042", success: true }
    I->>SS: clearSlots("uuid-abc", "service")
    I-->>R: { caseId: "CASE-042", success: true }
    R-->>B: stream: "Your service case is filed. Reference: CASE-042..."
```

---

## Per-Layer Code Trace

### Layer 0 — Browser (`app/page.tsx`)

```ts
// No change. useChat sends full message history each turn.
const { messages, sendMessage, status } = useChat();
// The browser automatically echoes mah-sid on every request
// to the same origin — no client code needed.
```

---

### Layer 1 — `app/api/chat/route.ts`

```ts
import { cookies } from "next/headers";
import { getOrCreateSession, clearSlots, writeSlots } from "@/lib/session/store";

export async function POST(req: Request) {
  const cookieStore = await cookies();

  // 1. Resolve session — create on first visit, look up on subsequent turns.
  let sessionId = cookieStore.get("mah-sid")?.value;
  const isNew = !sessionId;
  if (!sessionId) sessionId = crypto.randomUUID();

  const session = getOrCreateSession(sessionId);

  const { messages } = await req.json();

  // 2. Wrap tools with slot interceptor before passing to streamText.
  const interceptedTools = wrapWithSlotInterceptor(tools, sessionId);

  const result = streamText({
    maxRetries: 0,
    messages: await convertToModelMessages(messages, { tools: interceptedTools }),
    model: groq(MODEL_ID),
    stopWhen: stepCountIs(5),
    system: SYSTEM_PROMPT,
    timeout: 20_000,
    tools: interceptedTools,
  });

  const response = result.toUIMessageStreamResponse();

  // 3. Set HTTP-only cookie on the first response only.
  if (isNew) {
    response.headers.set(
      "Set-Cookie",
      `mah-sid=${sessionId}; HttpOnly; SameSite=Lax; Path=/`
    );
  }

  return response;
}
```

---

### Layer 2 — `lib/session/store.ts` *(new file)*

```ts
export interface LeadSlots {
  fullName: string;
  phone: string;
  email: string;
  preferredCity: string;
  vehicleModel: string;
}

export interface ServiceSlots {
  fullName: string;
  phone: string;
  registrationNumber: string;
  odometerReading: number;
  issueDescription: string;
  serviceType: string;
  preferredCenter: string;
}

export interface Session {
  id: string;
  createdAt: number;
  stageSlots: {
    lead?: Partial<LeadSlots>;
    service?: Partial<ServiceSlots>;
  };
}

// Module-level singleton — lives for the lifetime of the dev server process.
const store = new Map<string, Session>();

export function getOrCreateSession(id: string): Session {
  if (!store.has(id)) {
    store.set(id, { id, createdAt: Date.now(), stageSlots: {} });
  }
  return store.get(id)!;
}

export function writeSlots(
  id: string,
  stage: "lead" | "service",
  slots: Partial<LeadSlots> | Partial<ServiceSlots>
): void {
  const session = store.get(id);
  if (!session) return;
  session.stageSlots[stage] = {
    ...(session.stageSlots[stage] ?? {}),
    ...slots,
  } as never;
}

export function clearSlots(id: string, stage: "lead" | "service"): void {
  const session = store.get(id);
  if (session) delete session.stageSlots[stage];
}
```

---

### Layer 3 — Slot Interceptor (helper in `route.ts`)

```ts
// Wraps tools transparently. Individual tool files are not touched.
function wrapWithSlotInterceptor(
  tools: Record<string, Tool>,
  sessionId: string
) {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [
      name,
      {
        ...tool,
        execute: async (args: unknown) => {
          // Write slots BEFORE execution (args are Zod-validated by the AI SDK).
          if (name === "createLead") {
            writeSlots(sessionId, "lead", args as Partial<LeadSlots>);
          } else if (name === "createServiceCase") {
            writeSlots(sessionId, "service", args as Partial<ServiceSlots>);
          }

          const result = await tool.execute(args);

          // Clear slots AFTER successful CRM write.
          if (result?.success === true) {
            if (name === "createLead") clearSlots(sessionId, "lead");
            if (name === "createServiceCase") clearSlots(sessionId, "service");
          }

          return result;
        },
      },
    ])
  );
}
```

---

### Layer 4 — `lib/zoho/*` (ky replacement)

As of [ADR-0012](./adr/0012-zoho-client-split-and-tool-dedup.md), this layer is
split by responsibility rather than one file — the trace below shows which
file each piece actually lives in.

```ts
// lib/zoho/http.ts — one shared ky instance per process, token injected via
// beforeRequest hook. requiredEnv/getAccessToken imported from helpers.ts.
const zohoApi = ky.extend({
  baseUrl: `https://www.zohoapis.${dc}/crm/v8/`,
  timeout: 5_000,   // hard 5s ceiling per Zoho call
  headers: { "Content-Type": "application/json" },
  hooks: {
    beforeRequest: [
      async ({ request }) => {
        const token = await getAccessToken(); // lib/zoho/helpers.ts — cache + refresh
        request.headers.set("Authorization", `Zoho-oauthtoken ${token}`);
      },
    ],
  },
});

// lib/zoho/helpers.ts — token refresh uses a separate one-off ky call
// (different base URL); tokenCache is module-level state private to this file.
async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return tokenCache.accessToken;
  }
  const data = await ky
    .post(`https://accounts.zoho.${dc}/oauth/v2/token`, {
      body: new URLSearchParams({ client_id, client_secret, grant_type: "refresh_token", refresh_token }),
      timeout: 5_000,
    })
    .json<{ access_token?: string; expires_in?: number; error?: string }>();

  if (!data.access_token) throw new ZohoAuthError(data.error ?? "unknown"); // lib/zoho/errors.ts
  tokenCache = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return tokenCache.accessToken;
}

// lib/zoho/client.ts — the only file tools import from. Public facade:
// `zoho.{createRecord,searchRecords,updateRecord}` + `criteria`, both built
// on `zohoRequest()` from http.ts. Module names (`ZOHO_MODULES.LEADS`, etc.)
// come from constants.ts; ZohoApiError is imported from errors.ts directly
// by tool files, not re-exported through client.ts.
```

---

## Key Invariants After This Change

| Invariant | Where enforced |
|---|---|
| Every request has a session | `getOrCreateSession` in `route.ts` |
| Session ID never touches client JS | HTTP-only cookie (`mah-sid`) |
| Slot bag = uncommitted collection only | `clearSlots` on `success: true` |
| No `phone` collision across stages | Stage-scoped bags (`lead.phone` ≠ `service.phone`) |
| Zoho calls time out at 5 s | `ky` instance `timeout` option |
| Token refreshed transparently | `beforeRequest` hook |
| Tool files unchanged | Interceptor is above the tool layer |
| `useChat` contract unchanged | Client still sends full message history |
