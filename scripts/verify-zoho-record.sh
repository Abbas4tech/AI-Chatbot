#!/usr/bin/env bash
# Read-only lookup against Zoho CRM to confirm a chat-driven tool call actually
# landed — companion to seed-zoho-mock-data.sh, reusing the same auth pattern.
# Lets you verify a create/update from the terminal instead of clicking
# through the Zoho UI after every test prompt.
#
# Usage: ./scripts/verify-zoho-record.sh <Module> <criteria>
# Examples:
#   ./scripts/verify-zoho-record.sh Leads "(Phone:equals:+91 90111 22333)"
#   ./scripts/verify-zoho-record.sh Deals "(Customer_Phone:equals:+91 91234 56789)"
#   ./scripts/verify-zoho-record.sh Contacts "(Phone:equals:+91 90000 11111)"
#   ./scripts/verify-zoho-record.sh Cases "(Registration_Number:equals:KA01AB1234)"
#
# Criteria syntax matches lib/zoho/client.ts's own `criteria.equals()` helper —
# the exact same query shape the app issues internally.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -lt 2 ]; then
  echo "Usage: $0 <Module> <criteria>" >&2
  echo 'Example: $0 Leads "(Phone:equals:+91 90111 22333)"' >&2
  exit 1
fi

MODULE="$1"
CRITERIA="$2"

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

curl -s -G "https://www.zohoapis.${ZOHO_DC}/crm/v8/${MODULE}/search" \
  --data-urlencode "criteria=${CRITERIA}" \
  -H "Authorization: Zoho-oauthtoken ${ACCESS_TOKEN}" | jq '.'
