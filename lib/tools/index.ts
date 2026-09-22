import { createLead } from "./create-lead";
import { createServiceCase } from "./create-service-case";
import { lookupVehicleModel } from "./lookup-vehicle-model";
import { searchBooking } from "./search-booking";
import { searchContactByPhone } from "./search-contact-by-phone";
import { searchDeal } from "./search-deal";
import { updateDealFollowUp } from "./update-deal-follow-up";

/**
 * Flat tool set, no gating — the model chooses freely every turn.
 * See docs/adr/0006-llm-native-intent-routing.md.
 */
export const tools = {
  createLead,
  createServiceCase,
  lookupVehicleModel,
  searchBooking,
  searchContactByPhone,
  searchDeal,
  updateDealFollowUp,
};
