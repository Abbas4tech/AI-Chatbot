import { describe, expect, it, vi } from "vitest";
import { withSlotInterceptor } from "./interceptor";
import { getOrCreateSession } from "./store";

describe("withSlotInterceptor", () => {
  it("intercepts createLead execution to write slots before execution and clear on success", async () => {
    const sessionId = "interceptor-test-1";
    getOrCreateSession(sessionId);

    const mockExecute = vi
      .fn()
      .mockResolvedValue({ leadId: "LEAD-123", success: true });
    const mockTools = {
      createLead: { execute: mockExecute } as never,
      createServiceCase: { execute: vi.fn() } as never,
      lookupVehicleModel: { execute: vi.fn() } as never,
      searchBooking: { execute: vi.fn() } as never,
      searchContactByPhone: { execute: vi.fn() } as never,
      searchDeal: { execute: vi.fn() } as never,
      updateDealFollowUp: { execute: vi.fn() } as never,
    };

    const wrapped = withSlotInterceptor(mockTools, sessionId);

    const leadArgs = {
      email: "amit@example.com",
      fullName: "Amit Verma",
      phone: "9123456789",
      preferredCity: "Delhi",
      vehicleModel: "Thar",
    };

    const executeLead = wrapped.createLead.execute as (
      args: unknown
    ) => Promise<unknown>;
    const result = await executeLead(leadArgs);

    expect(mockExecute).toHaveBeenCalledWith(leadArgs, undefined);
    expect(result).toEqual({ leadId: "LEAD-123", success: true });

    // Since success is true, clearSlots should have run after writing slots
    const session = getOrCreateSession(sessionId);
    expect(session.stageSlots.lead).toBeUndefined();
  });

  it("retains slots if tool execution fails or succeeds=false", async () => {
    const sessionId = "interceptor-test-2";
    getOrCreateSession(sessionId);

    const mockExecute = vi
      .fn()
      .mockResolvedValue({ error: "API limit", success: false });
    const mockTools = {
      createLead: { execute: mockExecute } as never,
      createServiceCase: { execute: vi.fn() } as never,
      lookupVehicleModel: { execute: vi.fn() } as never,
      searchBooking: { execute: vi.fn() } as never,
      searchContactByPhone: { execute: vi.fn() } as never,
      searchDeal: { execute: vi.fn() } as never,
      updateDealFollowUp: { execute: vi.fn() } as never,
    };

    const wrapped = withSlotInterceptor(mockTools, sessionId);

    const leadArgs = {
      fullName: "Amit Verma",
      phone: "9123456789",
    };

    const executeLead = wrapped.createLead.execute as (
      args: unknown
    ) => Promise<unknown>;
    await executeLead(leadArgs);

    const session = getOrCreateSession(sessionId);
    expect(session.stageSlots.lead).toEqual({
      fullName: "Amit Verma",
      phone: "9123456789",
    });
  });
});
