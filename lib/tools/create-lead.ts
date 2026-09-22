import { tool } from "ai";
import { z } from "zod";
import { withZohoErrorHandling } from "@/lib/tools/shared/handle-zoho-error";
import { splitFullName } from "@/lib/tools/shared/split-full-name";
import { zoho } from "@/lib/zoho/client";
import { ZOHO_MODULES } from "@/lib/zoho/constants";

/** Stage 1 (New Lead) -> Zoho Leads. See docs/PRD.md §4-5. */
export const createLead = tool({
  description:
    "Register a new prospect in Zoho CRM Leads after a vehicle-interest conversation (Stage 1: New Lead). " +
    "Only call this once you have all required fields.",
  execute: ({ fullName, phone, email, preferredCity, vehicleModel }) =>
    withZohoErrorHandling(async () => {
      const { firstName, lastName } = splitFullName(fullName);
      const { id } = await zoho.createRecord(ZOHO_MODULES.LEADS, {
        City: preferredCity,
        Company: "Individual",
        Email: email,
        First_Name: firstName,
        Last_Name: lastName,
        Lead_Source: "AI Chat Agent",
        Phone: phone,
        Vehicle_Model: vehicleModel,
      });
      return { leadId: id, success: true };
    }),
  inputSchema: z.object({
    email: z.string().describe("Customer's email address"),
    fullName: z.string().describe("Customer's full name"),
    phone: z.string().describe("Customer's phone number"),
    preferredCity: z
      .string()
      .describe("City where the customer wants to test drive / take delivery"),
    vehicleModel: z
      .string()
      .describe("Vehicle model the customer is interested in"),
  }),
});
