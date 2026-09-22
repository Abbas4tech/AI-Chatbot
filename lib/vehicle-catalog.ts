/**
 * Local reference dataset backing the `lookupVehicleModel` tool
 * (docs/PRD.md §5) — kept out of Zoho and out of the model's parametric
 * knowledge so pricing/specs in conversation are never hallucinated.
 *
 * Prices and specs below are illustrative mock figures for the demo, not
 * live MSRP data.
 */

export type VehicleCatalogEntry = {
  model: string;
  variant: string;
  priceInr: number;
  keySpecs: string[];
};

export const vehicleCatalog: VehicleCatalogEntry[] = [
  {
    model: "Thar",
    variant: "AX (O) 4x4 Diesel MT",
    priceInr: 1650000,
    keySpecs: ["2.2L mHawk diesel, 130hp", "4x4 with low-range transfer case", "Convertible soft-top", "5-speed manual"],
  },
  {
    model: "Thar",
    variant: "LX 4x2 Petrol AT",
    priceInr: 1450000,
    keySpecs: ["2.0L mStallion petrol, 150hp", "6-speed torque-converter automatic", "Hardtop", "Cruise control"],
  },
  {
    model: "XUV700",
    variant: "AX7 Diesel AT 7-Str",
    priceInr: 2450000,
    keySpecs: ["2.2L diesel, 185hp", "ADAS Level 2", "7-seater", "Panoramic sunroof"],
  },
  {
    model: "XUV700",
    variant: "AX5 Petrol MT 5-Str",
    priceInr: 1500000,
    keySpecs: ["2.0L turbo petrol, 200hp", "5-seater", "Dual 10.25-inch displays"],
  },
  {
    model: "Scorpio-N",
    variant: "Z8L Diesel 4WD AT",
    priceInr: 2650000,
    keySpecs: ["2.2L diesel, 172hp", "4WD with terrain modes", "Captain seats, 7-seater", "Sky Roof"],
  },
  {
    model: "Scorpio-N",
    variant: "Z4 Diesel MT 2WD",
    priceInr: 1400000,
    keySpecs: ["2.2L diesel, 130hp", "2WD", "6-speed manual"],
  },
];

export function lookupVehicleModel(model: string, variant?: string) {
  const modelMatches = vehicleCatalog.filter(
    (entry) => entry.model.toLowerCase() === model.toLowerCase()
  );

  if (modelMatches.length === 0) {
    return { found: false as const };
  }

  const variantMatches = variant
    ? modelMatches.filter((entry) => entry.variant.toLowerCase().includes(variant.toLowerCase()))
    : modelMatches;

  return {
    found: true as const,
    entries: variantMatches.length > 0 ? variantMatches : modelMatches,
  };
}
