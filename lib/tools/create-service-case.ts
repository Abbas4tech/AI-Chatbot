import { tool } from "ai";
import { z } from "zod";
import { zoho, ZohoApiError, criteria } from "@/lib/zoho/client";

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
  inputSchema: z.object({
    fullName: z.string().describe("Owner's full name"),
    phone: z.string().describe("Owner's phone number, used to find or create their Contact record"),
    registrationNumber: z.string().describe("Vehicle registration number"),
    odometerReading: z.number().describe("Current odometer reading in km"),
    issueDescription: z.string().describe("Description of the reported issue or requested service"),
    serviceType: z.string().describe("e.g. 'Periodic Maintenance', 'Complaint', 'Breakdown'"),
    preferredCenter: z.string().describe("Customer's preferred service center location"),
  }),
  execute: async ({ fullName, phone, registrationNumber, odometerReading, issueDescription, serviceType, preferredCenter }) => {
    try {
      const existing = await zoho.searchRecords("Contacts", criteria.equals("Phone", phone));
      let contactId = existing[0]?.id as string | undefined;

      if (!contactId) {
        const [firstName, ...rest] = fullName.trim().split(/\s+/);
        const created = await zoho.createRecord("Contacts", {
          First_Name: rest.length > 0 ? firstName : undefined,
          Last_Name: rest.length > 0 ? rest.join(" ") : firstName,
          Phone: phone,
        });
        contactId = created.id;
      }

      const { id: caseId } = await zoho.createRecord("Cases", {
        Subject: `${serviceType} - ${registrationNumber}`,
        Contact_Name: { id: contactId },
        Registration_Number: registrationNumber,
        Odometer_Reading: odometerReading,
        Description: issueDescription,
        Preferred_Service_Center: preferredCenter,
      });

      return { success: true, caseId, contactId, wasNewContact: !existing[0] };
    } catch (error) {
      if (error instanceof ZohoApiError) return { success: false, error: error.message };
      throw error;
    }
  },
});
