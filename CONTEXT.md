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
The record for a person who already owns or has ordered a vehicle — the identity a Case (and, implicitly, a won Deal/Booking) is linked to. Maps to Zoho's Contacts module.
_Avoid_: Customer, owner (used informally elsewhere in this doc set, but "Contact" is the precise term when referring to the Zoho record itself). **Not yet seeded as mock data** — see the open gap noted in [`docs/PRD.md` §11](./docs/PRD.md#11-assumptions--risks).

## Agent & integration

**Session**:
The in-memory, per-browser conversation state (message history + routing context), keyed by a session cookie and scoped to the dev-server process's lifetime — see [0003](./docs/adr/0003-zoho-rest-sync-in-memory-session.md).
_Avoid_: Conversation (a Session includes routing/tool state, not just the message log).

**Tool**:
A single function-calling capability exposed to the LLM (e.g. "search Lead", "create Case") that the model selects at its own discretion each turn — see [0006](./docs/adr/0006-llm-native-intent-routing.md).
_Avoid_: Action, function (function is the underlying mechanism; Tool is the capability as exposed to the model).

**Self Client**:
The non-interactive Zoho OAuth application type used for this server-to-server integration; yields a long-lived `refresh_token` without a redirect-URI login flow.
_Avoid_: OAuth app (too generic — Zoho has other app types with different flows).
