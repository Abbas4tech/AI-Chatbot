/**
 * Zoho CRM REST client — public facade.
 * See docs/adr/0012-zoho-client-split-and-tool-dedup.md.
 *
 * Internals (types, constants, error classes, token refresh, the ky instance)
 * live in sibling files under lib/zoho/ — this file only exposes what tool
 * callers need.
 */

import { ZohoApiError } from "./errors";
import { zohoRequest } from "./http";
import type { ZohoRecord } from "./types";

/** Zoho's /search endpoint criteria syntax, e.g. `(Phone:equals:+919876543210)`. */
export const criteria = {
  equals: (field: string, value: string | number) =>
    `(${field}:equals:${value})`,
};

export const zoho = {
  async createRecord(
    module: string,
    fields: Record<string, unknown>
  ): Promise<{ id: string }> {
    const result = await zohoRequest<{
      data: Array<{ details: { id: string } }>;
    }>("post", module, { json: { data: [fields] } });

    const id = result?.data?.[0]?.details?.id;
    if (!id) {
      throw new ZohoApiError(
        "Zoho did not return a record id after create",
        500
      );
    }
    return { id };
  },

  async searchRecords(
    module: string,
    criteriaExpr: string
  ): Promise<ZohoRecord[]> {
    const result = await zohoRequest<{ data?: ZohoRecord[] }>(
      "get",
      `${module}/search`,
      { searchParams: { criteria: criteriaExpr } }
    );
    return result?.data ?? [];
  },

  async updateRecord(
    module: string,
    id: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    await zohoRequest("put", `${module}/${id}`, {
      json: { data: [{ id, ...fields }] },
    });
  },
};
