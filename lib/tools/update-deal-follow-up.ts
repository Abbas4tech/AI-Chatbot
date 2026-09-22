import { tool } from "ai";
import { z } from "zod";
import { ZohoApiError, zoho } from "@/lib/zoho/client";

/** Stage 2 (Ongoing Pipeline) -> Zoho Deals. See docs/PRD.md §4-5. */
export const updateDealFollowUp = tool({
  description:
    "Persist an updated follow-up preference on a Deal already found via searchDeal (Stage 2: Ongoing Pipeline).",
  execute: async ({ dealId, followUpPreference }) => {
    try {
      await zoho.updateRecord("Deals", dealId, {
        Follow_Up_Preference: followUpPreference,
      });
      return { success: true };
    } catch (error) {
      if (error instanceof ZohoApiError) {
        return { error: error.message, success: false };
      }
      throw error;
    }
  },
  inputSchema: z.object({
    dealId: z.string(),
    followUpPreference: z
      .string()
      .describe("e.g. 'Call after 6 PM', 'WhatsApp only', 'Weekends only'"),
  }),
});
