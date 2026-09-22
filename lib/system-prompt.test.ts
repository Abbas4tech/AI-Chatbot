import { describe, expect, it } from "vitest";
import { SYSTEM_PROMPT } from "./system-prompt";

describe("SYSTEM_PROMPT", () => {
  it("contains all 4 lifecycle stage definitions", () => {
    expect(SYSTEM_PROMPT).toContain("1. **New Lead**");
    expect(SYSTEM_PROMPT).toContain("2. **Ongoing Pipeline**");
    expect(SYSTEM_PROMPT).toContain("3. **Booked Vehicle**");
    expect(SYSTEM_PROMPT).toContain("4. **Post-Purchase / Service**");
  });

  it("references key tool names for intent routing", () => {
    expect(SYSTEM_PROMPT).toContain("lookupVehicleModel");
    expect(SYSTEM_PROMPT).toContain("createLead");
    expect(SYSTEM_PROMPT).toContain("searchDeal");
    expect(SYSTEM_PROMPT).toContain("updateDealFollowUp");
    expect(SYSTEM_PROMPT).toContain("searchBooking");
    expect(SYSTEM_PROMPT).toContain("createServiceCase");
  });

  it("includes OEM brand context and vehicle lineup", () => {
    expect(SYSTEM_PROMPT).toContain("Mahindra");
    expect(SYSTEM_PROMPT).toContain("Thar");
    expect(SYSTEM_PROMPT).toContain("XUV700");
    expect(SYSTEM_PROMPT).toContain("Scorpio-N");
  });
});
