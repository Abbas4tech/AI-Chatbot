import { tool } from "ai";
import { z } from "zod";
import { zoho, ZohoApiError, criteria } from "@/lib/zoho/client";

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
  inputSchema: z.object({
    bookingId: z.string().optional(),
    phone: z.string().optional(),
  }),
  execute: async ({ bookingId, phone }) => {
    if (!bookingId && !phone) {
      return { success: false, error: "Ask the customer for their Booking ID or phone number before searching." };
    }
    try {
      const deals = bookingId
        ? await zoho.searchRecords("Deals", criteria.equals("Booking_ID", bookingId))
        : await zoho.searchRecords("Deals", criteria.equals("Customer_Phone", phone!));
      const bookings = deals.filter((deal) => deal.Stage === BOOKING_STAGE);
      if (bookings.length === 0) {
        return { success: true, bookings: [], message: "No booking found with that identifier — double-check it with the customer." };
      }
      return { success: true, bookings };
    } catch (error) {
      if (error instanceof ZohoApiError) return { success: false, error: error.message };
      throw error;
    }
  },
});
