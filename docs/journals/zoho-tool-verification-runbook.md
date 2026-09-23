# Zoho Tool Verification Runbook

Closes [PRD §12 item 9](../PRD.md#12-open-items--next-steps): the six
Zoho-backed tools have only been validated via direct REST calls (the seed
script), never via the LLM actually choosing and calling them in conversation.
This is a rehearsal script — run it once before recording the Loom demo, so
you already know every prompt lands correctly instead of finding out on camera.

**Setup**

```sh
pnpm dev                        # http://localhost:3000
```

Keep a second terminal free for `./scripts/verify-zoho-record.sh` calls, and
optionally the Zoho CRM tab open for a visual double-check.

All phone numbers below come straight from `scripts/seed-zoho-mock-data.sh` —
**type them exactly as shown, spaces included**. `criteria.equals()` in
`lib/zoho/client.ts` is an exact-match search; `+919123456789` will not match
a record stored as `+91 91234 56789`. (Worth knowing as a real edge case, not
just a testing gotcha — a customer texting digits-only would hit the same
miss. Not fixed here, just flagged.)

---

## Stage 1 — New Lead (`lookupVehicleModel` → `createLead`)

**Prompt 1** (triggers `lookupVehicleModel`):
> Hi, I'm interested in the XUV700. What variants and pricing do you have?

Expect: a `lookupVehicleModel` tool-call card, then a reply listing the two
seeded XUV700 variants (AX7 Diesel AT 7-Str ₹24.5L, AX5 Petrol MT 5-Str ₹15L)
with no invented specs.

**Prompt 2** (triggers `createLead` — use a fresh persona, not Rajesh Sharma,
so you're not creating a same-name duplicate):
> I'd like to book a test drive. My name is Ananya Verma, phone +91 90111 22333, email ananya.verma@example.com, and I'm in Bangalore.

Expect: a `createLead` tool-call card returning `{ success: true, leadId }`,
and a reply confirming the inquiry is registered.

**Verify:**

```sh
./scripts/verify-zoho-record.sh Leads "(Phone:equals:+91 90111 22333)"
```

Check the returned record: `First_Name=Ananya`, `Last_Name=Verma`,
`City=Bangalore`, `Vehicle_Model=XUV700`, `Lead_Source=AI Chat Agent`.

---

## Stage 2 — Ongoing Pipeline (`searchDeal` → `updateDealFollowUp`)

Uses the seeded Priya Patel deal (`Customer_Phone = +91 91234 56789`,
`Stage = Proposal/Price Quote`, `Amount = 1900000`).

**Prompt 1** (triggers `searchDeal`):
> Hi, I'm following up on my test drive for the XUV700. My phone number is +91 91234 56789.

Expect: a `searchDeal` tool-call card, then a reply reporting the deal stage
and the ₹19,00,000 quote — matching the seeded amount, not a hallucinated one.

**Prompt 2** (triggers `updateDealFollowUp`, using the `dealId` the model
just resolved from prompt 1 — no need to repeat it):
> Can you update my follow-up preference to "Call after 6 PM"?

Expect: an `updateDealFollowUp` tool-call card returning `{ success: true }`.

**Verify:**

```sh
./scripts/verify-zoho-record.sh Deals "(Customer_Phone:equals:+91 91234 56789)"
```

Check `Follow_Up_Preference = "Call after 6 PM"` on the returned record.

---

## Stage 3 — Booked Vehicle (`searchBooking`)

Uses the seeded booking (`Booking_ID = MAH-9921`,
`Stage = Closed Won - Booking Done`, `Allocation_Status = Dispatch Pending`,
`VIN` deliberately unset).

**Prompt:**
> I booked a Scorpio-N, Booking ID MAH-9921. Can you tell me the delivery status and whether my VIN has been assigned?

Expect: a `searchBooking` tool-call card, then a reply stating allocation is
**Dispatch Pending** and that a VIN hasn't been assigned yet — this is the
"don't imply a VIN exists when it doesn't" edge case from the system prompt
(`lib/system-prompt.ts`). If the model invents a VIN, that's a real bug to
fix before recording, not just a bad take.

**Verify** (read-only — nothing should change in Zoho):

```sh
./scripts/verify-zoho-record.sh Deals "(Booking_ID:equals:MAH-9921)"
```

Confirm the reply's stated allocation status and VIN (absence) match this
record exactly.

**Bonus edge-case check** (rubric explicitly weights "edge-case recovery"):
> What about my booking MAH-0000?

Expect a graceful "no booking found, double-check the ID" reply — no crash,
no fabricated data. Worth having this one in your back pocket for the Loom
even if you don't lead with it.

---

## Stage 4 — Post-Purchase/Service (`createServiceCase`, self-contained Contact resolution)

Use a **phone number not already in Zoho** so you can see `createServiceCase`
find-or-create the Contact itself (`wasNewContact: true` in the tool result).

**Prompt:**
> Hi, I own a Scorpio-N, registration KA01AB1234. My name is Suresh Kumar, phone +91 90000 11111. The AC isn't cooling, odometer is at 15000 km, and I'd like this filed as a complaint. My preferred service center is the Koramangala center.

Expect: a `createServiceCase` tool-call card returning
`{ success: true, caseId, contactId, wasNewContact: true }`, and a reply
confirming the case with a reference number.

**Verify — two records to check:**

```sh
./scripts/verify-zoho-record.sh Contacts "(Phone:equals:+91 90000 11111)"
./scripts/verify-zoho-record.sh Cases "(Registration_Number:equals:KA01AB1234)"
```

Confirm the Contact was auto-created (`First_Name=Suresh`, `Last_Name=Kumar`),
and the Case has `Odometer_Reading=15000`, `Preferred_Service_Center` mentioning
Koramangala, and **`Related_To.id`** matching the Contact's `id` — not
`Contact_Name`, which isn't a real field on Zoho's Cases module (verified via
`/settings/fields?module=Cases`; the actual Contact lookup there is
`Related_To`). `createServiceCase` wrote to `Contact_Name` for a while, which
Zoho silently dropped rather than erroring — every Case created before this
fix has `Related_To: null` even though the Contact itself was created
correctly. See [ADR-0013](../adr/0013-cases-contact-lookup-field-name-bug.md).

**Follow-up prompt** (triggers `searchContactByPhone`, confirms identity
resolution works standalone too, not just inside `createServiceCase`):
> Can you confirm there's a customer record for phone +91 90000 11111?

Expect a `searchContactByPhone` tool-call card returning the same Contact
just created.

---

## Context-switch check (why this matters for the 30%-weighted rubric line)

Run Stage 3's prompt **immediately after** Stage 1's, in the same browser
session, without refreshing. The BRD explicitly requires switching context
mid-conversation (§3, "seamlessly switch context between vehicle discovery
and ticket creation"). If the model handles the stage switch without you
re-stating earlier context, and `mah-sid`'s slot bag correctly stayed scoped
to Stage 1 (per [ADR-0010](../adr/0010-session-store-slot-state-ky-http-client.md)),
that's the state-persistence criterion satisfied live, not just in code.

---

## If something doesn't land

- **Tool wasn't called at all**: check the tool-call card never appeared — the
  model may have answered from its own reasoning instead of calling the tool.
  Re-check `lib/system-prompt.ts`'s stage instructions for that scenario.
- **Tool was called with wrong/missing args**: check the model asked a
  clarifying question first — if it guessed instead of asking, that's the
  "ask one clear question at a time" system-prompt rule not holding.
- **Verify script returns `"data": []`**: almost always the phone-format
  exact-match issue flagged above — retype the number with the exact spacing
  from the seed script.
- **Verify script fails to mint a token**: same failure mode as
  `seed-zoho-mock-data.sh` — check `ZOHO_*` values in `.env.local`.

Once every stage above is confirmed clean, you're unblocked on
[PRD §12 item 11](../PRD.md#12-open-items--next-steps) (record the Loom) —
this runbook doubles as your demo script: read the prompts in order, switch
to the Zoho tab after each stage instead of the terminal, and you have your
5–7 minute walkthrough.
