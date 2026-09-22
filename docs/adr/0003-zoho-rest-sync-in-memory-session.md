---
status: accepted
---

# Zoho CRM sync via REST API only; conversation state kept in-memory

## Context

The BRD (§3) explicitly permits either "Zoho CRM OAuth 2.0 REST API or Webhooks" for CRM connectivity. The CRM Integration rubric line (25%) asks for "robust OAuth 2.0 token management, accurate data mapping" — it does not ask for push-based synchronization or for the agent to react to CRM changes made outside the conversation (e.g. a human sales rep editing a Deal in the Zoho UI while a chat session is open). Webhooks require a publicly reachable HTTPS endpoint; for local development that means an additional tunnel (ngrok or similar), which is one more moving part that can silently fail during the very demo recording it's supposed to support, and whose URL must be re-registered in Zoho's webhook config every time it changes.

Separately, conversation state (message history, in-progress slot-filling for a service case, etc.) needs to live somewhere across turns of the same session.

## Decision

CRM synchronization is implemented purely through on-demand Zoho CRM REST API calls (OAuth 2.0) — the agent calls out to Zoho synchronously whenever a tool needs live data, and no inbound webhook endpoint is built. Conversation/session state is kept in-memory: a per-dev-server-process store keyed by a session cookie, with no backing database.

## Considered options — CRM sync

1. **REST API, on-demand (chosen).** Agent calls Zoho as part of handling a tool call; no inbound endpoint to host, register, or keep alive.
2. **Webhooks (Zoho → app).** Would only add value if CRM-side changes needed to reflect into an *already-open* chat session without the user asking again — nothing in the BRD requires this.
3. **Both.** Maximal fidelity, but the added engineering cost (tunnel setup, webhook registration, signature verification) isn't rewarded by the rubric and risks a live demo failure mode that pure REST doesn't have.

## Considered options — session persistence

1. **In-memory `Map` (chosen).** Zero infrastructure, resets on process restart.
2. **SQLite file.** Durable across restarts, but adds a schema/migration surface for state that's disposable by design — conversation history isn't the system of record for anything.
3. **Upstash Redis (free tier).** Production-shaped, but another external signup, another credential, another `.env` entry, for a demo that runs in one sitting.

## Consequences

- No tunnel or webhook registration to keep alive during the Loom recording — one fewer live-demo failure mode.
- Token-refresh logic lives entirely inside our own request path, making it easier to reason about and to visibly demonstrate for the 25%-weighted "robust OAuth 2.0 token management" criterion, rather than being split across an inbound webhook handler and an outbound REST client.
- If the dev server restarts mid-demo, conversation history is lost. Mitigated operationally (don't restart mid-recording), not architecturally — an explicit, accepted trade-off.
- This pattern would not scale to multiple server instances (no shared session store). Out of scope by design (§2 of the PRD); documented here so a future reader doesn't mistake this for a production-intended pattern.

## Related

[ADR-0001](./0001-nextjs-fullstack-single-app.md) (a lightweight API-route backend is sufficient specifically because there's no inbound endpoint to host) · [ADR-0005](./0005-booking-as-deal-stage.md) (also a Zoho-modeling decision) · [PRD §6, §9](../PRD.md)
