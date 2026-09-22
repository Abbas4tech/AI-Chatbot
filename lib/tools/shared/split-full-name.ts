const WHITESPACE_RE = /\s+/;

/** Splits a customer-supplied full name into Zoho's First_Name/Last_Name
 * fields. A single-word name goes entirely into Last_Name — Zoho requires
 * Last_Name, First_Name is optional. */
export function splitFullName(fullName: string): {
  firstName?: string;
  lastName: string;
} {
  const [firstName, ...rest] = fullName.trim().split(WHITESPACE_RE);
  return {
    firstName: rest.length > 0 ? firstName : undefined,
    lastName: rest.length > 0 ? rest.join(" ") : firstName,
  };
}
