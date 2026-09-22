#!/usr/bin/env bash
# Seeds the mock CRM data required by the BRD (docs/resources/FDE Candidate Assessment BRD .md, §4):
#   1 Lead (Rajesh Sharma - Thar), 1 active Deal (Priya Patel - XUV700),
#   1 Booking Deal (#MAH-9921 - Scorpio-N Z8L), modeled per docs/adr/0005-booking-as-deal-stage.md.
#
# Requires ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_DC in .env.local.
# Safe to re-run: Zoho will create duplicate records rather than erroring, so check
# the CRM before re-running if you're not intentionally re-seeding.
#
# Does NOT create a Contact record — Stage 4 (Post-Purchase/Service) needs one to
# link a Case to, and none exists yet. This is a known open gap; see
# docs/PRD.md §11 (Assumptions & risks) for the two ways to close it.

set -euo pipefail
cd "$(dirname "$0")/.."

set -a
source .env.local
set +a

ACCESS_TOKEN=$(curl -s -X POST "https://accounts.zoho.${ZOHO_DC}/oauth/v2/token" \
  -d "grant_type=refresh_token" \
  -d "client_id=${ZOHO_CLIENT_ID}" \
  -d "client_secret=${ZOHO_CLIENT_SECRET}" \
  -d "refresh_token=${ZOHO_REFRESH_TOKEN}" | jq -r '.access_token')

if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "Failed to mint access token — check ZOHO_* values in .env.local" >&2
  exit 1
fi

echo "=== Creating Lead: Rajesh Sharma (Thar) ==="
curl -s -X POST "https://www.zohoapis.${ZOHO_DC}/crm/v8/Leads" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "Last_Name": "Sharma",
      "First_Name": "Rajesh",
      "Company": "Individual",
      "Phone": "+91 98765 43210",
      "Email": "rajesh.sharma@example.com",
      "City": "Pune",
      "Vehicle_Model": "Thar",
      "Lead_Source": "Website"
    }]
  }' | jq '.'

echo "=== Creating Deal: Priya Patel - XUV700 (Ongoing Pipeline) ==="
curl -s -X POST "https://www.zohoapis.${ZOHO_DC}/crm/v8/Deals" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "Deal_Name": "Priya Patel - XUV700 Test Drive",
      "Stage": "Proposal/Price Quote",
      "Closing_Date": "'"$(date -v+21d +%Y-%m-%d 2>/dev/null || date -d '+21 days' +%Y-%m-%d)"'",
      "Amount": 1900000,
      "Customer_Phone": "+91 91234 56789",
      "Description": "Test drive scheduled; awaiting quotation confirmation."
    }]
  }' | jq '.'

echo "=== Creating Booking Deal: #MAH-9921 - Scorpio-N Z8L (Vikram Nair) ==="
curl -s -X POST "https://www.zohoapis.${ZOHO_DC}/crm/v8/Deals" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "Deal_Name": "Booking MAH-9921 - Scorpio-N Z8L (Vikram Nair)",
      "Stage": "Closed Won - Booking Done",
      "Closing_Date": "'"$(date +%Y-%m-%d)"'",
      "Amount": 2400000,
      "Customer_Phone": "+91 99887 76655",
      "Booking_ID": "MAH-9921",
      "Allocation_Status": "Dispatch Pending"
    }]
  }' | jq '.'

echo "Done. VIN was deliberately left unset on the booking record (allocation still pending) — a realistic demo state for the 'VIN allocation' query in Stage 3."
