---
status: accepted
---

# `createServiceCase` wrote to a Cases field that doesn't exist, silently orphaning every Case from its Contact

## Context

The user reported: a customer named "Sharon DeCosta" raised a complaint (AC not working) through the chat agent, but the resulting Case in Zoho showed the name **"Abbas Shaikh"** instead — the developer's own name, not the customer's. That's alarming on its face: it looks like session/context bleed between users, or a hardcoded placeholder leaking into production data.

It wasn't either of those. Verified end-to-end against live Zoho data before touching any code, per this project's standing discipline (check the real API, don't assume from a label — the same method that caught ADR-0009's deprecated-model bug and the §14 schema fields):

1. Queried `Contacts` directly: the Contact record was correct — `First_Name: "Sharan"`, `Last_Name: "Dcosta"`, right phone number. Its `Owner` field read `"Abbas shaikh"` — but `Owner` is Zoho's built-in "which CRM account created/owns this record" field, present on *every* record in the account, and always the account holder. Nothing wrong there.
2. Queried the `Cases` record the tool had created: **`Contact_Name: null`**. The Case existed, had the right registration number and description, but was never actually linked to any Contact.
3. Queried `GET /crm/v8/settings/fields?module=Cases` — Zoho's Cases module has **no field called `Contact_Name` at all**. The real lookup field that links a Case to a Contact is `Related_To` (a lookup into the `Contacts` module).

`lib/tools/create-service-case.ts` was writing `Contact_Name: { id: contactId }` in its `createRecord(ZOHO_MODULES.CASES, ...)` call. Since `Contact_Name` isn't a real field on Cases, Zoho's create API silently dropped that key rather than erroring — the Case was created successfully, just with no Contact link. Every Case ever created by this tool has this problem, not just the one the user happened to notice.

**What the user actually saw**: with the real Contact link blank, Zoho's UI had nothing else customer-identifying to show prominently for that Case, so the "Abbas Shaikh" surfaced from the `Owner` field read as if it were the customer's name. The bug is real and serious (silent data loss on every Case), but it is not name confusion, session bleed, or a hardcoded value anywhere in this codebase — confirmed by grepping the entire repo for "Abbas" and finding nothing relevant.

## Decision

Change `lib/tools/create-service-case.ts`'s Case-creation payload from `Contact_Name: { id: contactId }` to `Related_To: { id: contactId }` — the field name Zoho's own schema actually defines.

## Verification

Not just read from the code — checked against live data and the live schema, both before and after:

1. **Root cause confirmed** by fetching `GET /crm/v8/settings/fields?module=Cases` and filtering to `data_type == "lookup"`: `Related_To` (→ Contacts) is listed; `Contact_Name` is not a field on this module at all.
2. **Existing broken record repaired**: the user's own test Case (`Complaint - KA01AB1234`, linked to nothing) was patched via a direct `PUT /crm/v8/Cases` call setting `Related_To: { id: <Sharan Dcosta's Contact id> }`, then re-read to confirm `Related_To.name == "Sharan Dcosta"`.
3. **Fix verified end-to-end through the real app, not just the API directly**: ran the dev server, drove it with a headless browser (same `puppeteer-core` + system Chrome setup as [ADR-0012](./0012-client-side-conversation-persistence.md)), sent a full Stage 4 complaint ("Priya Verma", phone, registration, odometer, AC complaint) through the actual chat UI, and confirmed the resulting live Case had `Related_To: { name: "Priya Verma", id: ... }` correctly populated.
4. `docs/journals/zoho-tool-verification-runbook.md` (the Stage 4 verification section) told testers to check `Contact_Name.id` — carrying the same wrong assumption forward into future manual test runs. Corrected to check `Related_To.id` instead, with a note explaining why, so the mistake doesn't get silently re-validated as "working" by someone following the runbook without independently checking the schema.

## Consequences

- **Any Case created before this fix has no Contact link.** Checked directly: the account had exactly two Cases total at the time of this fix — the one the user reported (patched, see Verification) and the one created during this fix's own live test (created correctly from the start, post-fix). Nothing was left unaudited, but this is a point-in-time fact about this account's small demo dataset, not a guarantee — anyone finding an older, unlinked Case later should apply the same `Related_To` patch.
- **Lesson for this project, stated plainly**: `Contact_Name` was assumed rather than verified when `create-service-case.ts` was first written — the one Zoho field name in this codebase that *wasn't* checked against `/settings/fields` the way every other custom field in §14 was. Zoho's create API not erroring on an unrecognized field name is itself a sharp edge worth remembering: a rejected/unrecognized key doesn't always fail loudly, so "the API call returned success" is not sufficient verification that the data actually landed where intended — reading the record back is.
- No schema/migration risk: `Related_To` is a stock Zoho field, not a custom one: no Settings API changes needed, unlike the custom fields in §14.

## Related

[ADR-0003](./0003-zoho-rest-sync-in-memory-session.md) / `docs/PRD.md` §5, §14 (tool inventory and schema reference this should have been cross-checked against originally) · [ADR-0012](./0012-client-side-conversation-persistence.md) (same browser-verification method reused here) · `docs/journals/zoho-tool-verification-runbook.md` (Stage 4 section, corrected)
