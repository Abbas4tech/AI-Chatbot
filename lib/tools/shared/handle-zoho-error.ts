import { ZohoApiError } from "@/lib/zoho/errors";

/**
 * Maps a thrown ZohoApiError to the `{ success: false, error }` shape every
 * Zoho-backed tool returns to the model; any other error still throws.
 */
export async function withZohoErrorHandling<T>(
  fn: () => Promise<T>
): Promise<T | { error: string; success: false }> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ZohoApiError) {
      return { error: error.message, success: false };
    }
    throw error;
  }
}
