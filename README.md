# Multistage AI Chat Agent

Automotive OEM conversational agent — recognizes which of four customer-lifecycle stages a user is in and reads/writes the matching Zoho CRM records live. Built for the AI Solutions Engineer take-home assessment; see [`docs/resources/FDE Candidate Assessment BRD.md`](./docs/resources/FDE%20Candidate%20Assessment%20BRD%20.md) for the source requirements.

Full design reasoning lives in [`docs/PRD.md`](./docs/PRD.md), decisions in [`docs/adr/`](./docs/adr/), domain vocabulary in [`CONTEXT.md`](./CONTEXT.md). This README covers only how to run the project.

## Status

Foundation phase complete: tech stack, architecture, and CRM data model decided (see ADRs), Gemini and Zoho credentials obtained, Zoho custom schema created and mock data (BRD §4) seeded via script. Application code has not been scaffolded yet — this README will grow execution steps as that happens.

## Environment setup

Copy `.env.example` to `.env.local` and fill in:

| Variable | Where to get it |
| :---- | :---- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Free API key from [Google AI Studio](https://aistudio.google.com/api-keys). Not the same as a Gemini Advanced/Google One subscription — see [ADR-0004](./docs/adr/0004-gemini-pro-as-llm-provider.md). |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET` | Create a **Self Client** at `api-console.zoho.<your-dc>` → Client Secret tab. |
| `ZOHO_REFRESH_TOKEN` | From the same Self Client's **Generate Code** tab (scope `ZohoCRM.modules.ALL,ZohoCRM.settings.ALL`), exchanged for a refresh token via a one-time POST to `https://accounts.zoho.<dc>/oauth/v2/token`. Full walkthrough: [`docs/PRD.md` §13](./docs/PRD.md#13-credentials--environment-reference). |
| `ZOHO_DC` | Your Zoho data center suffix (`com`, `in`, `eu`, ...) — visible in the API console's URL. |

**Never commit `.env.local` or paste secret values anywhere outside it** — it's gitignored by default.

## Zoho CRM: custom fields & mock data

The app depends on a few fields beyond Zoho's stock Leads/Deals schema. **Before running the seed script**, add these manually in Zoho (Setup → Customization → Modules and Fields — full rationale in [`docs/adr/0005-booking-as-deal-stage.md`](./docs/adr/0005-booking-as-deal-stage.md)):

- **Leads**: `Vehicle Model` (single line)
- **Deals**: `Booking ID` (single line), `VIN` (single line), `Allocation Status` (picklist: `In Transit` / `Dispatch Pending` / `Delivered`), `Customer Phone` (single line)
- **Deals → Stage picklist**: add a new value `Closed Won - Booking Done` (same probability as `Closed Won`)

Then seed the three BRD-required mock records (Lead, active Deal, Booking Deal) via:

```sh
./scripts/seed-zoho-mock-data.sh
```

It reads Zoho credentials from `.env.local`, mints an access token, and creates the records through the same REST API the application itself will use. Full field-by-field reference of what gets created: [`docs/PRD.md` §14](./docs/PRD.md#14-live-zoho-schema--mock-data-as-seeded).

## Running locally

_To be filled in once the Next.js app is scaffolded._
