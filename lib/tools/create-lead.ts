import { tool } from "ai";
import { z } from "zod";
import { ZohoApiError, zoho } from "@/lib/zoho/client";

const WHITESPACE_RE = /\s+/;

/** Stage 1 (New Lead) -> Zoho Leads. See docs/PRD.md §4-5. */
export const createLead = tool({
  description:
    "Register a new prospect in Zoho CRM Leads after a vehicle-interest conversation (Stage 1: New Lead). " +
    "Only call this once you have all required fields.",
  execute: async ({ fullName, phone, email, preferredCity, vehicleModel }) => {
    const [firstName, ...rest] = fullName.trim().split(WHITESPACE_RE);
    const lastName = rest.length > 0 ? rest.join(" ") : firstName;

    try {
      const { id } = await zoho.createRecord("Leads", {
        City: preferredCity,
        Company: "Individual",
        Email: email,
        First_Name: rest.length > 0 ? firstName : undefined,
        Last_Name: lastName,
        Lead_Source: "AI Chat Agent",
        Phone: phone,
        Vehicle_Model: vehicleModel,
      });
      return { leadId: id, success: true };
    } catch (error) {
      if (error instanceof ZohoApiError) {
        return { error: error.message, success: false };
      }
      throw error;
    }
  },
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
