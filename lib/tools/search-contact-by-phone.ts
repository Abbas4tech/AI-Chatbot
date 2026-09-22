import { tool } from "ai";
import { z } from "zod";
import { withZohoErrorHandling } from "@/lib/tools/shared/handle-zoho-error";
import { criteria, zoho } from "@/lib/zoho/client";
import { ZOHO_MODULES } from "@/lib/zoho/constants";

/** Stage 3/4 identity confirmation -> Zoho Contacts. See docs/PRD.md §4-5. */
export const searchContactByPhone = tool({
  description:
    "Resolve an existing customer's Contact record by phone number, to confirm identity (Stage 3/4). " +
    "createServiceCase already does this internally for filing a Case — use this tool only when you need " +
    "to confirm identity without necessarily filing a Case.",
  execute: ({ phone }) =>
    withZohoErrorHandling(async () => {
      const contacts = await zoho.searchRecords(
        ZOHO_MODULES.CONTACTS,
        criteria.equals("Phone", phone)
      );
      return { contacts, success: true };
    }),
  inputSchema: z.object({
    phone: z.string(),
  }),
});
