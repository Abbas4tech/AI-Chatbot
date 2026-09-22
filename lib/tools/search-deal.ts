import { tool } from "ai";
import { z } from "zod";
import { zoho, ZohoApiError, criteria } from "@/lib/zoho/client";

/** Stage 2 (Ongoing Pipeline) -> Zoho Deals. See docs/PRD.md §4-5. */
export const searchDeal = tool({
  description:
    "Find an in-pipeline Deal (Stage 2: Ongoing Pipeline) by the customer's phone number or a Deal ID, " +
    "to report test-drive/quotation status.",
  inputSchema: z.object({
    phone: z.string().optional(),
    dealId: z.string().optional(),
  }),
  execute: async ({ phone, dealId }) => {
    if (!phone && !dealId) {
      return { success: false, error: "Ask the customer for their phone number or Deal ID before searching." };
    }
    try {
      const deals = dealId
        ? await zoho.searchRecords("Deals", criteria.equals("id", dealId))
        : await zoho.searchRecords("Deals", criteria.equals("Customer_Phone", phone!));
      return { success: true, deals };
    } catch (error) {
      if (error instanceof ZohoApiError) return { success: false, error: error.message };
      throw error;
    }
  },
});
