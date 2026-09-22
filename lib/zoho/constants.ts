/** Zoho CRM module API names used by the tools. Single source of truth so a
 * typo'd module literal fails at the call site, not silently against the API. */
export const ZOHO_MODULES = {
  CASES: "Cases",
  CONTACTS: "Contacts",
  DEALS: "Deals",
  LEADS: "Leads",
} as const;

/**
 * Deal `Stage` field values the tools filter on. Booking is modeled as a Deal
 * stage, not a separate module — see docs/adr/0005-booking-as-deal-stage.md.
 */
export const DEAL_STAGES = {
  BOOKING: "Closed Won - Booking Done",
} as const;

// Refresh the OAuth token a little before actual expiry rather than reacting to a 401.
export const TOKEN_REFRESH_MARGIN_MS = 60_000;
