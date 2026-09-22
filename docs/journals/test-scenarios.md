# Test Scenarios — Full BRD Coverage
**Mahindra AI Chat Agent · Scenario Bank for Demo Testing**

> Pre-requisite before running any test:
> - `npm run dev` is running
> - Zoho CRM has the 3 mock records from BRD §4:
>   - **Lead**: Rajesh Sharma — Interested in Thar
>   - **Deal**: Priya Patel — Test Drive Scheduled for XUV700
>   - **Booking**: ID `#MAH-9921` — Scorpio-N Z8L · Stage = "Closed Won – Booking Done"
> - Open browser DevTools → Application → Cookies → confirm `mah-sid` appears after first message

---

## STAGE 1 — New Lead

### ✅ S1-A: Happy Path — Full Lead Creation (XUV700)

**BRD criteria covered:** Vehicle discovery → spec answer → test drive pitch → collect 4 fields → Zoho Leads write
**Rubric:** Agent Design 30% · Zoho CRM 25% · Domain Prompting 20%

| Turn | You type | Expected agent behaviour |
|------|----------|--------------------------|
| 1 | `Hi, what are the features of the XUV700?` | Calls `lookupVehicleModel`. Returns specs — 5/7 seater, ADAS, AdrenoX, panoramic sunroof. Pitches test drive. |
| 2 | `What's the price of the AX7 Diesel variant?` | Calls `lookupVehicleModel` again. Returns price. Does NOT invent a figure. |
| 3 | `Yes I'd like to book a test drive` | Asks for Full Name (one question at a time). |
| 4 | `Arjun Mehta` | Asks for Phone. |
| 5 | `9823456701` | Asks for Email. |
| 6 | `arjun.mehta@gmail.com` | Asks for Preferred City. |
| 7 | `Pune` | Calls `createLead`. Confirms registration. |

**Verify in Zoho:** Leads → new record "Arjun Mehta" · Phone: 9823456701 · Vehicle_Model: XUV700 · City: Pune · Lead_Source: "AI Chat Agent"

---

### ✅ S1-B: Happy Path — Thar Inquiry (different model)

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `Tell me about the Thar RWD` | Specs for Thar. No price invented. |
| 2 | `Book test drive. I'm Sneha Rao, 9900112233, sneha@test.com, Bangalore` | Agent calls `createLead` in one shot since all 4 fields provided. |

**Verify in Zoho:** Lead "Sneha Rao" · Vehicle_Model: Thar

---

### ✅ S1-C: Happy Path — Scorpio-N Variant Comparison

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `What's the difference between Scorpio-N Z4 and Z8L?` | Compares variants. No hallucinated specs. |
| 2 | `I want to enquire. Name: Vikram Singh, Phone: 9711223344, vikram@corp.com, city Mumbai` | Calls `createLead`. |

---

### 🔴 S1-D: Edge Case — Partial info, user corrects mid-collection

**Rubric: Edge-case recovery (30%)**

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `I want a test drive for XUV700` | Asks for name. |
| 2 | `Riya` | Asks for phone. |
| 3 | `Wait, my full name is Riya Kapoor` | Acknowledges correction, asks for phone. Does NOT restart. |
| 4 | `9988776655` | Asks for email. |
| 5 | `riya@kapoor.com` | Asks for city. |
| 6 | `Delhi` | Calls `createLead`. |

**Verify:** Lead "Riya Kapoor" not "Riya" — agent used the correction.

---

### 🔴 S1-E: Edge Case — Agent must NOT invent specs

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `What is the boot space of XUV700 in litres?` | Calls `lookupVehicleModel`. Returns only what catalog has. If missing, says "I don't have that spec — please check mahindra.com." Does NOT fabricate a number. |

---

### 🔴 S1-F: Edge Case — Incomplete lead, user abandons

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `Test drive XUV700 please` | Asks for name. |
| 2 | `Amit` | Asks for phone. |
| 3 | `Actually forget it` | Does NOT call `createLead`. Gracefully acknowledges. |

**Verify in Zoho:** No lead "Amit" created.

---

## STAGE 2 — Ongoing Pipeline

> **Pre-populated mock:** Priya Patel · Deal has test drive scheduled for XUV700

### ✅ S2-A: Happy Path — Check by Phone Number

**BRD criteria:** Existing prospect provides phone → fetch deal status → update follow-up

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `Hi, I want to check my test drive status` | Asks for phone or Deal ID. |
| 2 | `My phone is [Priya Patel's phone from Zoho]` | Calls `searchDeal`. Returns test drive date, dealer, stage. |
| 3 | `Can you change my follow-up to WhatsApp on Friday?` | Calls `updateDealFollowUp`. Confirms update. |

**Verify in Zoho:** Deal record updated with new follow-up preference.

---

### ✅ S2-B: Happy Path — Check by Deal ID

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `Check my deal status, deal ID is [your Deal ID from Zoho]` | Calls `searchDeal` with dealId. Returns status. |

---

### 🔴 S2-C: Edge Case — Wrong phone number (no match)

**Rubric: Edge-case recovery**

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `Check test drive status for phone 0000000000` | Calls `searchDeal`. No results. Agent: "No deal found with that number, please double-check." Does NOT fabricate a deal. |
| 2 | `Oh sorry, it's [correct phone]` | Calls `searchDeal` again. Returns correct record. |

---

### 🔴 S2-D: Edge Case — Quotation field empty in Zoho

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `What is the quotation amount on my deal? Phone: [Priya's phone]` | `searchDeal` returns Zoho data. If Amount field is null, agent says so plainly — does NOT invent a price. |

---

## STAGE 3 — Booked Vehicle

> **Pre-populated mock:** Booking ID `MAH-9921` · Scorpio-N Z8L · Stage = "Closed Won – Booking Done"

### ✅ S3-A: Happy Path — Check by Booking ID

**BRD criteria:** Validate Booking ID → report allocation stage + VIN

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `I've booked a Scorpio-N. My booking ID is MAH-9921` | Calls `searchBooking(bookingId: "MAH-9921")`. Returns allocation stage. |
| 2 | `When will I get the VIN?` | If VIN field is null → "VIN is not yet allocated — typically assigned 5–7 working days before dispatch." Does NOT invent a VIN. |
| 3 | `What about the balance payment link?` | Reports whatever Zoho has. If empty, says dealer will share it — no fabrication. |

**Verify in Zoho:** No update made (Stage 3 is read-only).

---

### ✅ S3-B: Happy Path — Check by Phone Number

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `Track my booking. My phone is [phone on MAH-9921 record]` | Calls `searchBooking(phone)`. Filters for Stage = "Closed Won – Booking Done". Returns MAH-9921. |

---

### 🔴 S3-C: Edge Case — Wrong Booking ID

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `My booking ID is MAH-0000` | Calls `searchBooking`. Empty result. Agent: "No booking found with ID MAH-0000, please double-check." |
| 2 | `Sorry, it's MAH-9921` | Retries. Returns correct record. |

---

### 🔴 S3-D: Edge Case — Phone matches a Deal but not a Booking

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `Track my booking. Phone: [Priya Patel's phone — she is in Deals, not Booking stage]` | `searchBooking` finds Deals but none with "Closed Won – Booking Done". Agent: "No confirmed booking found — do you have a Booking ID?" |

---

## STAGE 4 — Post-Purchase / Service

### ✅ S4-A: Happy Path — Complaint, New Owner (Contact auto-created)

**BRD criteria:** Gather reg + odometer + issue/service type + center → create Case linked to Contact

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `I want to log a complaint. My Scorpio-N AC stopped working` | Asks for registration number. |
| 2 | `MH02CD5678` | Asks for odometer reading. |
| 3 | `15,200 km` | Asks for preferred service center. |
| 4 | `Mahindra Service, Bandra` | Asks for name + phone (if not in session). |
| 5 | `Karan Joshi, 9876001122` | Calls `createServiceCase`. Searches Contact by phone → not found → creates Contact → creates Case. |

**Verify in Zoho:**
- New Contact: Karan Joshi · Phone: 9876001122
- New Case: Subject = "Complaint - MH02CD5678" · Odometer: 15200 · linked to Contact

---

### ✅ S4-B: Happy Path — Periodic Maintenance, Existing Owner (no duplicate Contact)

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `Book my Thar for 30,000 km service` | Asks for reg. |
| 2 | `MH01XY9900` | Asks for odometer. |
| 3 | `30,100` | Asks for service center. |
| 4 | `Mahindra Thane` | Asks for name + phone. |
| 5 | `Karan Joshi, 9876001122` | Calls `createServiceCase`. Finds existing Contact from S4-A. Does NOT duplicate. |

**Verify in Zoho:** NO second Contact for Karan Joshi. New Case linked to existing Contact.

---

### 🔴 S4-C: Edge Case — Odometer correction mid-collection

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `Service complaint — reg MH03ZZ1111` | Asks for odometer. |
| 2 | `Actually wait, reg is MH03ZZ2222` | Acknowledges correction. Asks for odometer with corrected reg. |
| 3 | `22000 km` | Continues collection with corrected reg. |

---

### 🔴 S4-D: Edge Case — Service type ambiguous

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `I want to book service for my XUV700` | Asks what kind: Periodic Maintenance, Complaint, or Breakdown? |
| 2 | `Breakdown, my car won't start` | Service type = "Breakdown". Continues collecting remaining fields. |

---

## STAGE 5 — Context Switch Scenarios

> BRD §3: *"Seamlessly switch context between vehicle discovery and ticket creation."*
> **Rubric: 30% — state persistence across turns**

### ✅ S5-A: New Lead → Pricing Detour → Back to Lead

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `I want to book a test drive for XUV700` | Asks for name. |
| 2 | `Meera Shah` | Asks for phone. |
| 3 | `Actually first — does XUV700 have ADAS?` | Calls `lookupVehicleModel`. Answers. Does NOT lose "Meera Shah". |
| 4 | `Yes okay. 9123456789` | Continues — asks for email. Name NOT re-asked. |
| 5 | `meera@shah.com` | Asks for city. |
| 6 | `Chennai` | Creates Lead for Meera Shah. |

---

### ✅ S5-B: Stage 2 Check → New Lead in same session

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `Check my test drive — phone [Priya's phone]` | Returns Priya's deal. |
| 2 | `My friend also wants to enquire — Rahul Verma, 9012345678, rahul@v.com, Hyderabad` | `createLead` for Rahul. Does NOT confuse with Priya's Deal. |

---

### ✅ S5-C: FULL 4-STAGE JOURNEY — Loom Recording Scenario 🎬

> **This is the demo video scenario. Record this end-to-end.**

| Turn | You type | Tool fired | Zoho module |
|------|----------|------------|-------------|
| 1 | `Hi! Tell me about Scorpio-N features and pricing` | `lookupVehicleModel` | — |
| 2 | `Book test drive. I'm Ankit Jain, 9900887766, ankit@jain.com, Mumbai` | `createLead` | Leads ✅ |
| 3 | `Now check my friend's deal — phone [Priya's phone]` | `searchDeal` | Deals ✅ |
| 4 | `Update her follow-up to email on Monday` | `updateDealFollowUp` | Deals ✅ |
| 5 | `Track booking MAH-9921` | `searchBooking` | Deals (Booking stage) ✅ |
| 6 | `I also have a Thar complaint — AC not working, reg MH04AB7777, 18000 km, Mahindra Worli. My name is Priya Patel, phone [Priya's phone]` | `createServiceCase` | Cases + Contacts ✅ |

**All 4 BRD stages demonstrated. Zoho dashboard should show new/updated records in real time.**

---

## STAGE 6 — Error Handling & Graceful Degradation

> **Rubric: Latency & UI/UX 15% — graceful error handling**

### 🔴 S6-A: Zoho API auth failure

| Step | Action | Expected |
|------|--------|----------|
| 1 | Temporarily set wrong `ZOHO_CLIENT_SECRET` in `.env`, restart server | — |
| 2 | Collect all Lead fields | `createLead` fails with ZohoAuthError |
| 3 | — | Agent: "I was unable to register your enquiry right now due to a system issue. Please try again or contact your nearest Mahindra dealer." Does NOT crash or expose raw error. |

---

### 🔴 S6-B: User tries to skip required fields

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `Create a lead for me, I'm Sam` | Does NOT call `createLead`. Asks for phone. |
| 2 | `I don't have an email, skip it` | Explains email is required. Asks again. |

---

### 🔴 S6-C: Ambiguous intent — Stage 2 vs Stage 3

| Turn | You type | Expected |
|------|----------|----------|
| 1 | `What's my status? Phone: [Priya's phone]` | Calls `searchDeal` (pipeline check). Returns Priya's test drive deal. |
| 2 | `No I mean my booking status` | Calls `searchBooking`. Filters for "Closed Won – Booking Done". Returns result (or "no booking found"). |

---

## Rubric Coverage Map

| Scenario | Agent Design 30% | Zoho CRM 25% | Domain Prompting 20% | Latency/UX 15% | Code Quality 10% |
|---|---|---|---|---|---|
| S1-A | Tool routing ✅ | Lead create ✅ | OEM tone ✅ | Streaming visible ✅ | — |
| S1-D | Edge-case recovery ✅ | No bad write ✅ | — | — | — |
| S1-E | No hallucination ✅ | — | Jargon accuracy ✅ | — | — |
| S1-F | No partial write ✅ | No ghost record ✅ | — | — | — |
| S2-A | State persistence ✅ | Deal search + update ✅ | — | — | — |
| S2-C | Edge-case recovery ✅ | No fabrication ✅ | — | Graceful error ✅ | — |
| S3-A | Tool routing ✅ | Booking search ✅ | VIN/allocation jargon ✅ | — | — |
| S3-C | Edge-case recovery ✅ | No fabricated booking ✅ | — | Graceful error ✅ | — |
| S4-A | Multi-step workflow ✅ | Contact find-or-create + Case ✅ | Service param gathering ✅ | — | — |
| S4-B | Idempotent Contact ✅ | No duplicate Contact ✅ | — | — | — |
| S5-A | Context switch ✅ | — | — | — | — |
| S5-C | All-stages ✅ | All modules ✅ | All tones ✅ | Streaming ✅ | — |
| S6-A | — | OAuth error handling ✅ | — | Graceful degradation ✅ | — |

---

## Pre-Test Checklist

```
□ npm run dev running — no console errors on startup
□ Zoho CRM — 3 mock records confirmed present (Rajesh Sharma, Priya Patel, MAH-9921)
□ DevTools open — Network tab (filter: /api/chat) to watch SSE streaming
□ DevTools open — Application > Cookies (watch mah-sid appear after turn 1)
□ Zoho CRM dashboard open in a second tab — verify writes in real time
□ Note Priya Patel's actual phone number from your Zoho Deal record
□ Note the actual Deal ID from Zoho for S2-B
□ For S5-C: start screen recording BEFORE typing turn 1
```
