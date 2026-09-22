/**
 * Zoho CRM REST client — ky-based, replacing raw fetch.
 * See docs/adr/0010-session-store-slot-state-ky-http-client.md §Decision 3.
 *
 * Design:
 * - One shared `ky` instance for all CRM API calls (baseUrl + 5 s timeout).
 * - `beforeRequest` hook injects the current access token (cached in module
 *   scope, proactively refreshed via a separate one-off ky call).
 * - ZohoAuthError and ZohoApiError are kept unchanged so callers don't need
 *   updating — the public surface of this module is identical to the fetch
 *   version.
 */

import ky, { HTTPError } from "ky";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name} (see .env.example)`);
  }
  return value;
}

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

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

// Refresh a little before actual expiry rather than reacting to a 401.
const REFRESH_MARGIN_MS = 60_000;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return tokenCache.accessToken;
  }

  const dc = requiredEnv("ZOHO_DC");
  const params = new URLSearchParams({
    client_id: requiredEnv("ZOHO_CLIENT_ID"),
    client_secret: requiredEnv("ZOHO_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: requiredEnv("ZOHO_REFRESH_TOKEN"),
  });

  // Separate one-off ky call — different base URL from CRM instance, own 5 s timeout.
  const data = await ky
    .post(`https://accounts.zoho.${dc}/oauth/v2/token`, {
      body: params,
      timeout: 5000,
    })
    .json<{ access_token?: string; error?: string; expires_in?: number }>();

  if (!data.access_token) {
    throw new ZohoAuthError(data.error ?? "unknown_error");
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return tokenCache.accessToken;
}

/**
 * Shared ky instance for all Zoho CRM v8 calls.
 * Uses ky 2.x API: `baseUrl` (not prefixUrl), `ky.extend()` (not ky.create()),
 * and the `beforeRequest` hook receives a state object `{ request }`.
 */
function createZohoKyInstance() {
  const dc = requiredEnv("ZOHO_DC");

  return ky.extend({
    // Trailing slash required so relative paths like "Leads" resolve correctly.
    baseUrl: `https://www.zohoapis.${dc}/crm/v8/`,
    headers: { "Content-Type": "application/json" },
    hooks: {
      beforeRequest: [
        async ({ request }) => {
          const token = await getAccessToken();
          request.headers.set("Authorization", `Zoho-oauthtoken ${token}`);
        },
      ],
    },
    // Hard 5 s ceiling per Zoho call — prevents one hung request from consuming
    // the full 20 s streamText budget. See ADR-0010 §Decision 3.
    timeout: 5000,
  });
}

// Instantiated once per module load (once per dev-server process).
const zohoApi = createZohoKyInstance();

interface ZohoErrorEnvelope {
  code?: string;
  data?: Array<{ code?: string; message?: string }>;
  message?: string;
}

/**
 * Thin wrapper that normalises Zoho's error envelope and 204 No Content,
 * matching the previous fetch-based behaviour callers depended on.
 */
async function zohoRequest<T>(
  method: "get" | "post" | "put",
  path: string,
  options: { json?: unknown; searchParams?: Record<string, string> } = {}
): Promise<T | null> {
  try {
    const response = await zohoApi[method](path, {
      ...(options.json === undefined ? {} : { json: options.json }),
      ...(options.searchParams ? { searchParams: options.searchParams } : {}),
    });

    // Zoho returns 204 No Content for e.g. a search with no matches.
    if (response.status === 204) {
      return null;
    }

    return response.json<T>();
  } catch (err) {
    if (err instanceof HTTPError) {
      const data = await err.response
        .json<ZohoErrorEnvelope>()
        .catch((): ZohoErrorEnvelope => ({}));
      const zohoCode = data.code ?? data.data?.[0]?.code;
      const message =
        data.message ??
        data.data?.[0]?.message ??
        `Zoho API request failed (${err.response.status})`;
      // biome-ignore lint/style/useErrorCause: cause is forwarded via ErrorOptions → super(message, options) in ZohoApiError
      throw new ZohoApiError(message, err.response.status, zohoCode, {
        cause: err,
      });
    }
    throw err;
  }
}

export type ZohoRecord = Record<string, unknown> & { id: string };

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
