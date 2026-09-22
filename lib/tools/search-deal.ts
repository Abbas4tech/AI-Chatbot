import { tool } from "ai";
import { z } from "zod";
import { criteria, ZohoApiError, zoho } from "@/lib/zoho/client";

/** Stage 2 (Ongoing Pipeline) -> Zoho Deals. See docs/PRD.md §4-5. */
export const searchDeal = tool({
  description:
    "Find an in-pipeline Deal (Stage 2: Ongoing Pipeline) by the customer's phone number or a Deal ID, " +
    "to report test-drive/quotation status.",
  execute: async ({ phone, dealId }) => {
    try {
      if (dealId) {
        const deals = await zoho.searchRecords(
          "Deals",
          criteria.equals("id", dealId)
        );
        return { deals, success: true };
      }
      if (phone) {
        const deals = await zoho.searchRecords(
          "Deals",
          criteria.equals("Customer_Phone", phone)
        );
        return { deals, success: true };
      }
      return {
        error:
          "Ask the customer for their phone number or Deal ID before searching.",
        success: false,
      };
    } catch (error) {
      if (error instanceof ZohoApiError) {
        return { error: error.message, success: false };
      }
      throw error;
    }
  },
  inputSchema: z.object({
    dealId: z.string().optional(),
    phone: z.string().optional(),
  }),
});
