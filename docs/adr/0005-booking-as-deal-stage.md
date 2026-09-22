---
status: accepted
---

# Booking modeled as a Deal stage, not a separate custom module

## Context

The BRD's own lifecycle table (§2) is internally ambiguous about where "Booked Vehicle" data lives: "Retrieve record from custom module / Deal stage marked as 'Closed Won – Booking Done'" names *both* options in the same cell, effectively leaving this as an implementation decision for the candidate rather than a specified requirement. This is a domain-modeling decision — it determines a canonical term (`Booking`, see [`CONTEXT.md`](../../CONTEXT.md)) and a concrete Zoho schema, not just an implementation detail.

## Decision

A booking is modeled as an existing Deal whose `Stage` = `"Closed Won – Booking Done"`, carrying custom fields for Booking ID, VIN, and allocation status. No separate custom "Bookings" module is created.

## Considered options

1. **Deal + stage + custom fields (chosen).** Reuses the Deals module already being integrated for Stage 2 (Ongoing Pipeline); requires only adding custom fields to an existing module, not designing and provisioning a new module's schema by hand in Zoho's admin UI.
2. **Separate custom "Bookings" module**, linked via lookup fields to Deal/Contact. The more textbook CRM design — a Booking is arguably a distinct business object (allocation, VIN assignment, dispatch, delivery) with its own lifecycle that outlives the "Deal" concept. Rejected here only on time-boxing grounds, not because it's the wrong long-term design: hand-provisioning a custom module's schema is a manual, undocumented-in-code setup step, easy for an evaluator to get wrong or skip when standing up their own Zoho org from the README.
3. **Store booking state as a Case.** Rejected outright: Cases are reserved for Stage 4 (service/post-purchase) per the BRD; overloading them here would make "Case" mean two different things depending on context, working directly against `CONTEXT.md`'s job of keeping domain terms unambiguous.

## Consequences

- One integration surface (Deals: search + update) now serves two lifecycle stages (2 and 3), reducing the number of distinct Zoho modules the tool layer needs to know about.
- No custom module schema to design and manually provision in Zoho before the app can be demoed — one fewer manual setup step in the README.
- **Conflates two different domain concepts** onto one Zoho object type, distinguished only by `Stage`: "negotiation in progress" (Stage 2) and "sale finalized, fulfillment in progress" (Stage 3). In a production system this is exactly the kind of shortcut that causes a "Deals" report to unexpectedly include fulfillment-stage records months later. Recorded explicitly here so this reads as a deliberate, documented trade-off rather than an oversight if it's ever questioned.
- Indirect supporting evidence for this choice: the rubric's own CRM-integration line (BRD §6) names "accurate data mapping across Leads, Deals, and Cases" — three modules, not four. It does not mention a Bookings module, which is consistent with the BRD's author expecting booking data to live inside Deals.

## Related

[ADR-0003](./0003-zoho-rest-sync-in-memory-session.md) · [`CONTEXT.md`](../../CONTEXT.md) (Booking, Deal terms) · [PRD §4, §5](../PRD.md) · [PRD §14](../PRD.md#14-live-zoho-schema--mock-data-as-seeded) (the actual custom fields and mock Booking record created from this decision)
