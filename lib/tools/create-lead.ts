import { tool } from "ai";
import { z } from "zod";
import { zoho, ZohoApiError } from "@/lib/zoho/client";

/** Stage 1 (New Lead) -> Zoho Leads. See docs/PRD.md §4-5. */
export const createLead = tool({
  description:
    "Register a new prospect in Zoho CRM Leads after a vehicle-interest conversation (Stage 1: New Lead). " +
    "Only call this once you have all required fields.",
  inputSchema: z.object({
    fullName: z.string().describe("Customer's full name"),
    phone: z.string().describe("Customer's phone number"),
    email: z.string().describe("Customer's email address"),
    preferredCity: z.string().describe("City where the customer wants to test drive / take delivery"),
    vehicleModel: z.string().describe("Vehicle model the customer is interested in"),
  }),
  execute: async ({ fullName, phone, email, preferredCity, vehicleModel }) => {
    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    const lastName = rest.length > 0 ? rest.join(" ") : firstName;

    try {
      const { id } = await zoho.createRecord("Leads", {
        First_Name: rest.length > 0 ? firstName : undefined,
        Last_Name: lastName,
        Company: "Individual",
        Phone: phone,
        Email: email,
        City: preferredCity,
        Vehicle_Model: vehicleModel,
        Lead_Source: "AI Chat Agent",
      });
      return { success: true, leadId: id };
    } catch (error) {
      if (error instanceof ZohoApiError) {
        return { success: false, error: error.message };
      }
      throw error;
    }
  },
});
