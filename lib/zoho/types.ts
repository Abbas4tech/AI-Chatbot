export type ZohoRecord = Record<string, unknown> & { id: string };

export interface ZohoErrorEnvelope {
  code?: string;
  data?: Array<{ code?: string; message?: string }>;
  message?: string;
}

export interface TokenCache {
  accessToken: string;
  expiresAt: number;
}
