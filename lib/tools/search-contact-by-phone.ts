import { tool } from "ai";
import { z } from "zod";
import { criteria, ZohoApiError, zoho } from "@/lib/zoho/client";

/** Stage 3/4 identity confirmation -> Zoho Contacts. See docs/PRD.md §4-5. */
export const searchContactByPhone = tool({
  description:
    "Resolve an existing customer's Contact record by phone number, to confirm identity (Stage 3/4). " +
    "createServiceCase already does this internally for filing a Case — use this tool only when you need " +
    "to confirm identity without necessarily filing a Case.",
  execute: async ({ phone }) => {
    try {
      const contacts = await zoho.searchRecords(
        "Contacts",
        criteria.equals("Phone", phone)
      );
      return { contacts, success: true };
    } catch (error) {
      if (error instanceof ZohoApiError) {
        return { error: error.message, success: false };
      }
      throw error;
    }
  },
  inputSchema: z.object({
    phone: z.string(),
  }),
});
