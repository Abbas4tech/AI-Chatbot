# Multistage AI Chat Agent

Automotive OEM conversational agent — recognizes which of four customer-lifecycle stages a user is in and reads/writes the matching Zoho CRM records live. Built for the AI Solutions Engineer take-home assessment; see [`docs/resources/FDE Candidate Assessment BRD.md`](./docs/resources/FDE%20Candidate%20Assessment%20BRD%20.md) for the source requirements.

Full design reasoning lives in [`docs/PRD.md`](./docs/PRD.md), decisions in [`docs/adr/`](./docs/adr/), domain vocabulary in [`CONTEXT.md`](./CONTEXT.md). This README covers only how to run the project.

## Status

App is scaffolded and functionally complete: Next.js (App Router, TypeScript, Tailwind, shadcn/ui + [AI Elements](https://ai-sdk.dev/elements)), Vercel AI SDK + Gemini wired up, all 7 tools implemented against the live Zoho schema, `pnpm build`/`pnpm lint`/`pnpm test` all clean. Remaining before submission: push to a private GitHub repo and record the Loom demo — **but read [`docs/PRD.md` §11](./docs/PRD.md#11-assumptions--risks) first**: Gemini's free tier has a confirmed hard cap of 20 requests/day, already exhausted once during development. Decide on Groq vs. a fresh-quota day before recording.

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
- **Deals**: `Booking ID` (single line), `VIN` (single line), `Allocation Status` (picklist: `In Transit` / `Dispatch Pending` / `Delivered`), `Customer Phone` (single line), `Follow Up Preference` (single line)
- **Deals → Stage picklist**: add a new value `Closed Won - Booking Done` (same probability as `Closed Won`)
- **Cases**: `Registration Number` (single line), `Odometer Reading` (number), `Preferred Service Center` (single line)

All of the above were created via the Zoho Settings API rather than the UI in this project's own setup — see [`docs/PRD.md` §14](./docs/PRD.md#14-live-zoho-schema--mock-data-as-seeded) — but adding them by hand in the UI works identically.

Then seed the three BRD-required mock records (Lead, active Deal, Booking Deal) via:

```sh
./scripts/seed-zoho-mock-data.sh
```

It reads Zoho credentials from `.env.local`, mints an access token, and creates the records through the same REST API the application itself will use. Full field-by-field reference of what gets created: [`docs/PRD.md` §14](./docs/PRD.md#14-live-zoho-schema--mock-data-as-seeded).

## Running locally

```sh
pnpm install
cp .env.example .env.local   # fill in real values — see Environment setup above
pnpm dev                     # http://localhost:3000
```

Other useful commands:

```sh
pnpm build      # production build + typecheck
pnpm lint       # Biome, via the Ultracite preset (ultracite check)
pnpm lint:fix   # auto-fix what Biome can (ultracite fix)
pnpm test       # Vitest
```

## Project structure

```
app/
  page.tsx            Chat UI (useChat + AI Elements components)
  api/chat/route.ts    The only backend route: streamText + tool calling
components/
  ai-elements/          Conversation, Message, PromptInput, Tool, Suggestion,
                         code-block — the subset of the AI Elements registry
                         this app actually uses; see docs/PRD.md §3a
  ui/                    shadcn/ui primitives those depend on
lib/
  system-prompt.ts     OEM domain system prompt (4-stage instructions)
  vehicle-catalog.ts   Local reference data backing lookupVehicleModel
  zoho/client.ts        OAuth token management + Zoho REST wrapper
  tools/*.ts            The 7 tools from docs/PRD.md §5
scripts/
  seed-zoho-mock-data.sh   Seeds the BRD-required mock CRM records
```
