import { tool } from "ai";
import { z } from "zod";
import { zoho, ZohoApiError } from "@/lib/zoho/client";

/** Stage 2 (Ongoing Pipeline) -> Zoho Deals. See docs/PRD.md §4-5. */
export const updateDealFollowUp = tool({
  description:
    "Persist an updated follow-up preference on a Deal already found via searchDeal (Stage 2: Ongoing Pipeline).",
  inputSchema: z.object({
    dealId: z.string(),
    followUpPreference: z.string().describe("e.g. 'Call after 6 PM', 'WhatsApp only', 'Weekends only'"),
  }),
  execute: async ({ dealId, followUpPreference }) => {
    try {
      await zoho.updateRecord("Deals", dealId, { Follow_Up_Preference: followUpPreference });
      return { success: true };
    } catch (error) {
      if (error instanceof ZohoApiError) return { success: false, error: error.message };
      throw error;
    }
  },
});
