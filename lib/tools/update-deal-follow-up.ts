import { tool } from "ai";
import { z } from "zod";
import { withZohoErrorHandling } from "@/lib/tools/shared/handle-zoho-error";
import { zoho } from "@/lib/zoho/client";
import { ZOHO_MODULES } from "@/lib/zoho/constants";

/** Stage 2 (Ongoing Pipeline) -> Zoho Deals. See docs/PRD.md §4-5. */
export const updateDealFollowUp = tool({
  description:
    "Persist an updated follow-up preference on a Deal already found via searchDeal (Stage 2: Ongoing Pipeline).",
  execute: ({ dealId, followUpPreference }) =>
    withZohoErrorHandling(async () => {
      await zoho.updateRecord(ZOHO_MODULES.DEALS, dealId, {
        Follow_Up_Preference: followUpPreference,
      });
      return { success: true };
    }),
  inputSchema: z.object({
    dealId: z.string(),
    followUpPreference: z
      .string()
      .describe("e.g. 'Call after 6 PM', 'WhatsApp only', 'Weekends only'"),
  }),
});
