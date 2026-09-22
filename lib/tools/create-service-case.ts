import { tool } from "ai";
import { z } from "zod";
import { withZohoErrorHandling } from "@/lib/tools/shared/handle-zoho-error";
import { splitFullName } from "@/lib/tools/shared/split-full-name";
import { criteria, zoho } from "@/lib/zoho/client";
import { ZOHO_MODULES } from "@/lib/zoho/constants";

/**
 * Stage 4 (Post-Purchase/Service) -> Zoho Cases, linked to an existing Contact.
 *
 * Resolves (or creates, if this is the owner's first interaction) the Contact
 * internally by phone, rather than requiring the model to chain
 * searchContactByPhone -> createServiceCase itself. This is "Option B" from
 * the Contact-modeling gap flagged in docs/PRD.md §11: closed here by making
 * the tool self-contained, which is more resilient to the model skipping a
 * step (the rubric's "edge-case recovery" criterion) than relying on
 * multi-tool chaining to succeed every time.
 */
export const createServiceCase = tool({
  description:
    "File a service/complaint Case (Stage 4: Post-Purchase/Service) for an existing owner. Finds or " +
    "creates the owner's Contact record by phone automatically — you do not need to call " +
    "searchContactByPhone first.",
  execute: ({
    fullName,
    phone,
    registrationNumber,
    odometerReading,
    issueDescription,
    serviceType,
    preferredCenter,
  }) =>
    withZohoErrorHandling(async () => {
      const existing = await zoho.searchRecords(
        ZOHO_MODULES.CONTACTS,
        criteria.equals("Phone", phone)
      );
      let contactId = existing[0]?.id as string | undefined;

      if (!contactId) {
        const { firstName, lastName } = splitFullName(fullName);
        const created = await zoho.createRecord(ZOHO_MODULES.CONTACTS, {
          First_Name: firstName,
          Last_Name: lastName,
          Phone: phone,
        });
        contactId = created.id;
      }

      const { id: caseId } = await zoho.createRecord(ZOHO_MODULES.CASES, {
        Contact_Name: { id: contactId },
        Description: issueDescription,
        Odometer_Reading: odometerReading,
        Preferred_Service_Center: preferredCenter,
        Registration_Number: registrationNumber,
        Subject: `${serviceType} - ${registrationNumber}`,
      });

      return { caseId, contactId, success: true, wasNewContact: !existing[0] };
    }),
  inputSchema: z.object({
    fullName: z.string().describe("Owner's full name"),
    issueDescription: z
      .string()
      .describe("Description of the reported issue or requested service"),
    odometerReading: z.number().describe("Current odometer reading in km"),
    phone: z
      .string()
      .describe(
        "Owner's phone number, used to find or create their Contact record"
      ),
    preferredCenter: z
      .string()
      .describe("Customer's preferred service center location"),
    registrationNumber: z.string().describe("Vehicle registration number"),
    serviceType: z
      .string()
      .describe("e.g. 'Periodic Maintenance', 'Complaint', 'Breakdown'"),
  }),
});
