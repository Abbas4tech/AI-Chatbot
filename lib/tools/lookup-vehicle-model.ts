import { tool } from "ai";
import { z } from "zod";
import { lookupVehicleModel as lookup } from "@/lib/vehicle-catalog";

/** Stage 1 (New Lead). Not Zoho-backed — see docs/PRD.md §5. */
export const lookupVehicleModel = tool({
  description:
    "Look up authoritative specs and pricing for a Mahindra vehicle model (XUV700, Thar, Scorpio-N). " +
    "Always call this instead of guessing a price or spec from memory.",
  inputSchema: z.object({
    model: z.string().describe("Vehicle model name, e.g. 'XUV700', 'Thar', 'Scorpio-N'"),
    variant: z.string().optional().describe("Specific variant name or keyword, if the customer mentioned one"),
  }),
  execute: async ({ model, variant }) => {
    const result = lookup(model, variant);
    if (!result.found) {
      return {
        found: false,
        message: `No catalog entry for "${model}". Ask the customer to confirm the model name — we only carry XUV700, Thar, and Scorpio-N.`,
      };
    }
    return result;
  },
});
