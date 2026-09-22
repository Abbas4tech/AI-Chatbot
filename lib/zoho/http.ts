import ky, { HTTPError } from "ky";
import { ZohoApiError } from "./errors";
import { getAccessToken, requiredEnv } from "./helpers";
import type { ZohoErrorEnvelope } from "./types";

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

/**
 * Thin wrapper that normalises Zoho's error envelope and 204 No Content,
 * matching the previous fetch-based behaviour callers depended on.
 */
export async function zohoRequest<T>(
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
