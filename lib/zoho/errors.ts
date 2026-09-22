/** Distinct from ZohoApiError so token-refresh failures are never confused
 * with CRM-data errors during debugging — see docs/PRD.md §6. */
export class ZohoAuthError extends Error {
  constructor(zohoErrorCode: string) {
    super(`Zoho OAuth token refresh failed: ${zohoErrorCode}`);
    this.name = "ZohoAuthError";
  }
}

export class ZohoApiError extends Error {
  status: number;
  zohoCode?: string;

  constructor(
    message: string,
    status: number,
    zohoCode?: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ZohoApiError";
    this.status = status;
    this.zohoCode = zohoCode;
  }
}
