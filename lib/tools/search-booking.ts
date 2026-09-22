import { tool } from "ai";
import { z } from "zod";
import { criteria, ZohoApiError, zoho } from "@/lib/zoho/client";

/**
 * Stage 3 (Booked Vehicle) -> Zoho Deals filtered to the booking Stage.
 * Booking is modeled as a Deal, not a separate module — see
 * docs/adr/0005-booking-as-deal-stage.md.
 */
const BOOKING_STAGE = "Closed Won - Booking Done";

export const searchBooking = tool({
  description:
    "Find a booked vehicle (Stage 3: Booked Vehicle) by Booking ID or phone number. Reports allocation " +
    "stage, VIN (if assigned yet), and the booking amount.",
  execute: async ({ bookingId, phone }) => {
    try {
      let deals: Awaited<ReturnType<typeof zoho.searchRecords>> | null = null;

      if (bookingId) {
        deals = await zoho.searchRecords(
          "Deals",
          criteria.equals("Booking_ID", bookingId)
        );
      } else if (phone) {
        deals = await zoho.searchRecords(
          "Deals",
          criteria.equals("Customer_Phone", phone)
        );
      }

      if (deals === null) {
        return {
          error:
            "Ask the customer for their Booking ID or phone number before searching.",
          success: false,
        };
      }

      const bookings = deals.filter((deal) => deal.Stage === BOOKING_STAGE);
      if (bookings.length === 0) {
        return {
          bookings: [],
          message:
            "No booking found with that identifier — double-check it with the customer.",
          success: true,
        };
      }
      return { bookings, success: true };
    } catch (error) {
      if (error instanceof ZohoApiError) {
        return { error: error.message, success: false };
      }
      throw error;
    }
  },
  inputSchema: z.object({
    bookingId: z.string().optional(),
    phone: z.string().optional(),
  }),
});
