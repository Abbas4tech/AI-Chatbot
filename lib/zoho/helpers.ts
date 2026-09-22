import ky from "ky";
import { TOKEN_REFRESH_MARGIN_MS } from "./constants";
import { ZohoAuthError } from "./errors";
import type { TokenCache } from "./types";

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name} (see .env.example)`);
  }
  return value;
}

let tokenCache: TokenCache | null = null;

export async function getAccessToken(): Promise<string> {
  if (
    tokenCache &&
    tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()
  ) {
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
