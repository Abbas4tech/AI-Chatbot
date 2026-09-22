/**
 * Server-side session store — see docs/adr/0010-session-store-slot-state-ky-http-client.md.
 *
 * A module-level Map<string, Session> keyed by the `mah-sid` HTTP-only cookie UUID.
 * Lives for the lifetime of the dev-server process; resets on restart (accepted
 * trade-off per ADR-0010 §Consequences).
 *
 * Slot bags represent IN-PROGRESS, UNCOMMITTED field collection only. They are
 * written when the LLM supplies tool arguments and cleared when the CRM write
 * succeeds — so stale values never bleed into a second collection of the same type.
 */

export interface LeadSlots {
  email: string;
  fullName: string;
  phone: string;
  preferredCity: string;
  vehicleModel: string;
}

export interface ServiceSlots {
  fullName: string;
  issueDescription: string;
  odometerReading: number;
  phone: string;
  preferredCenter: string;
  registrationNumber: string;
  serviceType: string;
}

export interface Session {
  createdAt: number;
  id: string;
  /** Stage-scoped slot bags — keyed by lifecycle stage name. */
  stageSlots: {
    lead?: Partial<LeadSlots>;
    service?: Partial<ServiceSlots>;
  };
}

// Module-level singleton. Not shared across serverless instances — fine for next dev.
const store = new Map<string, Session>();

export function getOrCreateSession(id: string): Session {
  if (!store.has(id)) {
    store.set(id, { createdAt: Date.now(), id, stageSlots: {} });
  }
  return store.get(id) as Session;
}

export function writeSlots(
  id: string,
  stage: "lead" | "service",
  slots: Partial<LeadSlots> | Partial<ServiceSlots>
): void {
  const session = store.get(id);
  if (!session) {
    return;
  }
  // Merge into existing partial bag so sequential turns accumulate.
  session.stageSlots[stage] = {
    ...(session.stageSlots[stage] ?? {}),
    ...slots,
  } as never;
}

export function clearSlots(id: string, stage: "lead" | "service"): void {
  const session = store.get(id);
  if (session) {
    delete session.stageSlots[stage];
  }
}
