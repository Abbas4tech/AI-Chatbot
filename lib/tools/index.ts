import { lookupVehicleModel } from "./lookup-vehicle-model";
import { createLead } from "./create-lead";
import { searchDeal } from "./search-deal";
import { updateDealFollowUp } from "./update-deal-follow-up";
import { searchBooking } from "./search-booking";
import { searchContactByPhone } from "./search-contact-by-phone";
import { createServiceCase } from "./create-service-case";

/**
 * Flat tool set, no gating — the model chooses freely every turn.
 * See docs/adr/0006-llm-native-intent-routing.md.
 */
export const tools = {
  lookupVehicleModel,
  createLead,
  searchDeal,
  updateDealFollowUp,
  searchBooking,
  searchContactByPhone,
  createServiceCase,
};
