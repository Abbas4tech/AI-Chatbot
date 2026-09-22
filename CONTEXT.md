# Multistage AI Chat Agent

An AI Solutions Engineer assessment project: a conversational agent for an automotive OEM (Mahindra-style) that recognizes which stage of the purchase/ownership lifecycle a customer is in and reads/writes the corresponding Zoho CRM records.

## Customer lifecycle

**Lifecycle Stage**:
One of the four stages a customer occupies in the automotive purchase/ownership journey — New Lead, Ongoing Pipeline, Booked Vehicle, Post-Purchase/Service — each mapped to a distinct Zoho CRM module or workflow.
_Avoid_: Funnel stage, flow (funnel stage is overloaded with a marketing-specific meaning we don't need here).

**Lead**:
An unidentified visitor inquiring about vehicle models, variant pricing, or features, not yet in the sales pipeline. Maps 1:1 to Zoho's Leads module.
_Avoid_: Prospect, visitor.

**Deal**:
An identified prospect actively in the sales pipeline — test drive scheduled, quotation issued — prior to winning. Maps to Zoho's Deals (Potentials) module.
_Avoid_: Opportunity, potential, pipeline record.

**Booking**:
A Deal whose `Stage` is "Closed Won – Booking Done", carrying custom fields for Booking ID, VIN, and allocation status. Not a separate CRM module — see [0005](./docs/adr/0005-booking-as-deal-stage.md).
_Avoid_: Order, sale.

**Case**:
A post-purchase service or complaint record linked to an existing Contact. Maps to Zoho's Cases module.
_Avoid_: Ticket, service ticket (the BRD uses "Cases / Service Tickets" interchangeably; we canonicalize on Zoho's actual module name).

**Contact**:
The record for a person who already owns or has ordered a vehicle — the identity a Case (and, implicitly, a won Deal/Booking) is linked to. Maps to Zoho's Contacts module. Resolved (found-or-created) by phone number automatically inside `createServiceCase` — see [`docs/PRD.md` §5](./docs/PRD.md#5-tool-inventory-proposed).
_Avoid_: Customer, owner (used informally elsewhere in this doc set, but "Contact" is the precise term when referring to the Zoho record itself).

## Agent & integration

**Session**:
A server-side record keyed by an HTTP-only cookie (`mah-sid`) and held in an in-memory `Map` for the lifetime of the dev-server process. Holds stage-scoped Slot Bags — not the message log (which the client re-sends in full each turn, and which is separately persisted client-side in `localStorage` — see [ADR-0012](./docs/adr/0012-client-side-conversation-persistence.md)). See [ADR-0010](./docs/adr/0010-session-store-slot-state-ky-http-client.md).
_Avoid_: Conversation (a Session includes slot/tool state, not the visible message transcript — those are two separate persistence layers, see ADR-0012).

**Slot**:
A single named field that the agent must collect before it can call a stage-completing tool. For example, `email` is a Slot for the Lead stage; `odometerReading` is a Slot for the Service stage. Slots are written server-side when the LLM provides them as tool arguments, and cleared when the CRM write succeeds.
_Avoid_: Field, parameter (those are code-level terms; Slot is the domain concept of "a piece of customer information we are in the process of gathering").

**Slot Bag**:
The per-stage collection of partially-gathered Slots for a Session. `stageSlots.lead` and `stageSlots.service` are the two Slot Bags. A Slot Bag represents uncommitted, in-progress collection — it is empty when no collection is active or after a successful CRM write.
_Avoid_: Form state, slot map.

**Slot Interceptor**:
A cross-cutting wrapper in `route.ts` that sits above every tool's `execute` function. It writes incoming tool arguments into the appropriate Slot Bag before the tool runs, and clears the Slot Bag if the tool returns `{ success: true }`. Individual tool files are not aware of its existence.
_Avoid_: Middleware (implies an HTTP layer; the Slot Interceptor operates at the tool-dispatch layer, not the HTTP layer).

**Tool**:
A single function-calling capability exposed to the LLM (e.g. "search Lead", "create Case") that the model selects at its own discretion each turn — see [0006](./docs/adr/0006-llm-native-intent-routing.md).
_Avoid_: Action, function (function is the underlying mechanism; Tool is the capability as exposed to the model).

**Self Client**:
The non-interactive Zoho OAuth application type used for this server-to-server integration; yields a long-lived `refresh_token` without a redirect-URI login flow.
_Avoid_: OAuth app (too generic — Zoho has other app types with different flows).

**Modular Chat Architecture**:
The SOLID single-responsibility UI breakdown (`components/chat/*`) separating page layout, header navigation, empty state hero, message list iteration, part rendering, and tool execution cards. See [ADR-0011](./docs/adr/0011-modular-chat-components-solid-refactor.md).
_Avoid_: Monolithic view component.

**Ky HTTP Client**:
The tiny, fetch-based HTTP client wrapper configured in `lib/zoho/client.ts` with transparent OAuth bearer token injection and hard per-request timeouts (5s). See [ADR-0010](./docs/adr/0010-session-store-slot-state-ky-http-client.md).
_Avoid_: Raw fetch wrapper.

