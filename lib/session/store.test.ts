import { describe, expect, it } from "vitest";
import { clearSlots, getOrCreateSession, writeSlots } from "./store";

describe("session store", () => {
  it("creates a new session when none exists", () => {
    const session = getOrCreateSession("test-session-1");
    expect(session.id).toBe("test-session-1");
    expect(session.stageSlots).toEqual({});
    expect(typeof session.createdAt).toBe("number");
  });

  it("returns the existing session if already created", () => {
    const s1 = getOrCreateSession("test-session-2");
    writeSlots("test-session-2", "lead", { fullName: "Rajan Sharma" });
    const s2 = getOrCreateSession("test-session-2");

    expect(s2).toBe(s1);
    expect(s2.stageSlots.lead?.fullName).toBe("Rajan Sharma");
  });

  it("accumulates partial slots sequentially", () => {
    const id = "test-session-3";
    getOrCreateSession(id);

    writeSlots(id, "lead", { fullName: "Priya Patel", phone: "9876543210" });
    writeSlots(id, "lead", {
      email: "priya@example.com",
      preferredCity: "Mumbai",
    });

    const session = getOrCreateSession(id);
    expect(session.stageSlots.lead).toEqual({
      email: "priya@example.com",
      fullName: "Priya Patel",
      phone: "9876543210",
      preferredCity: "Mumbai",
    });
  });

  it("isolates lead slots from service slots", () => {
    const id = "test-session-4";
    getOrCreateSession(id);

    writeSlots(id, "lead", { phone: "9999999999", vehicleModel: "XUV700" });
    writeSlots(id, "service", {
      phone: "8888888888",
      registrationNumber: "MH01AB1234",
    });

    const session = getOrCreateSession(id);
    expect(session.stageSlots.lead?.phone).toBe("9999999999");
    expect(session.stageSlots.service?.phone).toBe("8888888888");
  });

  it("clears slots for a specific stage", () => {
    const id = "test-session-5";
    getOrCreateSession(id);

    writeSlots(id, "lead", { fullName: "Vikram Nair" });
    writeSlots(id, "service", { registrationNumber: "MH02CD5678" });

    clearSlots(id, "lead");

    const session = getOrCreateSession(id);
    expect(session.stageSlots.lead).toBeUndefined();
    expect(session.stageSlots.service?.registrationNumber).toBe("MH02CD5678");
  });
});
