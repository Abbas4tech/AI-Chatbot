import { describe, expect, it } from "vitest";
import { lookupVehicleModel } from "./vehicle-catalog";

describe("lookupVehicleModel", () => {
  it("finds all variants for a known model, case-insensitively", () => {
    const result = lookupVehicleModel("thar");
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.every((entry) => entry.model === "Thar")).toBe(
        true
      );
    }
  });

  it("narrows to a matching variant when one is given", () => {
    const result = lookupVehicleModel("XUV700", "AX7");
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].variant).toContain("AX7");
    }
  });

  it("falls back to all variants when the requested variant doesn't match", () => {
    const result = lookupVehicleModel("Thar", "nonexistent-variant");
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.entries.length).toBeGreaterThan(1);
    }
  });

  it("reports not found for an unknown model", () => {
    const result = lookupVehicleModel("Bolero");
    expect(result.found).toBe(false);
  });
});
