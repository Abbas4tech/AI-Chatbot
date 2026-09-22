/**
 * Zoho CRM REST client. OAuth token management + a thin wrapper over the
 * search/create/update operations the tool layer needs.
 *
 * Design per docs/adr/0003-zoho-rest-sync-in-memory-session.md: REST-only,
 * no webhooks. Access tokens are cached in a module-level variable (not
 * per-session — there's one Self Client credential for the whole app) and
 * refreshed proactively, per docs/PRD.md §6.
 */

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

  constructor(message: string, status: number, zohoCode?: string) {
    super(message);
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

  const response = await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
    body: params,
    method: "POST",
  });
  const data = await response.json().catch(() => ({}));

  if (!(response.ok && data.access_token)) {
    throw new ZohoAuthError(data.error ?? `http_${response.status}`);
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return tokenCache.accessToken;
}

async function zohoFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T | null> {
  const dc = requiredEnv("ZOHO_DC");
  const accessToken = await getAccessToken();

  const response = await fetch(`https://www.zohoapis.${dc}/crm/v8${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  // Zoho returns 204 No Content for e.g. a search with no matches.
  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const zohoCode = data?.code ?? data?.data?.[0]?.code;
    const message =
      data?.message ??
      data?.data?.[0]?.message ??
      `Zoho API request failed (${response.status})`;
    throw new ZohoApiError(message, response.status, zohoCode);
  }

  return data as T;
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
    const result = await zohoFetch<{
      data: Array<{ details: { id: string } }>;
    }>(`/${module}`, {
      body: JSON.stringify({ data: [fields] }),
      method: "POST",
    });
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
    const result = await zohoFetch<{ data?: ZohoRecord[] }>(
      `/${module}/search?criteria=${encodeURIComponent(criteriaExpr)}`
    );
    return result?.data ?? [];
  },

  async updateRecord(
    module: string,
    id: string,
    fields: Record<string, unknown>
  ): Promise<void> {
    await zohoFetch(`/${module}/${id}`, {
      body: JSON.stringify({ data: [{ id, ...fields }] }),
      method: "PUT",
    });
  },
};
