# PRD — Multistage AI Chat Agent (Automotive OEM Assessment)

Source requirements: [`docs/resources/FDE Candidate Assessment BRD.md`](./resources/FDE%20Candidate%20Assessment%20BRD%20.md). Domain vocabulary: [`CONTEXT.md`](../CONTEXT.md). Decision log: [`docs/adr/`](./adr/).

**Contents**: [0. Summary](#0-executive-summary) · [1. Objective](#1-objective) · [2. Scope](#2-scope) · [3. Tech stack](#3-tech-stack) · [4. Stage → CRM mapping](#4-lifecycle-stage--crm-mapping) · [5. Tool inventory](#5-tool-inventory-proposed) · [6. Non-functional requirements](#6-non-functional-requirements) · [7. Deployment](#7-deployment--demo) · [8. Deliverables checklist](#8-deliverables-checklist-brd-5) · [9. Architecture](#9-architecture) · [10. Rubric alignment](#10-rubric-alignment-map) · [11. Assumptions & risks](#11-assumptions--risks) · [12. Open items](#12-open-items--next-steps) · [13. Credentials reference](#13-credentials--environment-reference) · [14. Live Zoho schema](#14-live-zoho-schema--mock-data-as-seeded)

## 0. Executive summary

A take-home assessment for an AI Solutions Engineer role: build a conversational agent for an automotive OEM that recognizes which of four customer-lifecycle stages a user is in — New Lead, Ongoing Pipeline, Booked Vehicle, Post-Purchase/Service — and reads/writes the matching Zoho CRM records live, through natural conversation, with visible streaming output and graceful recovery from bad or missing input. The submission is graded on tool-routing accuracy (30%), CRM integration robustness (25%), automotive domain prompting (20%), latency/UX (15%), and code quality (10%). Every foundational decision in this document was made by optimizing directly against those five weights, not against abstract "best practice" — where the two conflicted, the rubric won.

## 1. Objective

Build a conversational AI agent for an automotive OEM (Mahindra-style) that recognizes which of four customer-lifecycle stages a user is in and reads/writes the matching Zoho CRM records in real time, entirely through natural conversation, without the user ever having to name which "mode" or "menu" they're in.

## 2. Scope

**In scope** (BRD §3, "Multistage AI Chat Agent" track):
- Responsive chat UI (not voice — the BRD offers voice as an alternative track under the same section; we are not building it).
- LLM tool-calling that routes across all 4 lifecycle stages within one session, switching context mid-conversation without the user restarting.
- Zoho CRM read/write via REST API (OAuth 2.0) across Leads, Deals, and Cases.
- Streaming responses, session-scoped conversation state, and visible recovery when the agent is missing information it needs (e.g. asking again for a Booking ID it couldn't validate).

**Out of scope, with reasoning**:
- **Voice interface.** A second, largely independent UI/latency surface (barge-in handling, speech-to-text) that the BRD does not require alongside the chat track — building both would dilute effort against a rubric that doesn't reward doing extra tracks.
- **Zoho webhooks / inbound push sync.** See [ADR-0003](./adr/0003-zoho-rest-sync-in-memory-session.md) — nothing in the rubric asks the agent to react to CRM changes made outside the conversation.
- **Durable/cross-session chat history.** See [ADR-0003](./adr/0003-zoho-rest-sync-in-memory-session.md) — Zoho is the durable system of record; conversation history is disposable working memory.
- **Production deployment, multi-tenant auth, horizontal scaling.** This is a single-evaluator, single-sitting demo (§7); building for scale would spend the 6-hour budget on infrastructure the rubric never checks.
- **Automated end-to-end test suites for the 4 flows.** Vitest is scaffolded (§3) but writing exhaustive test coverage competes directly with implementation time in a 6-hour budget; we prioritize a working, demoable agent.

## 3. Tech stack

| Layer | Choice | Why | Decision record |
| :---- | :---- | :---- | :---- |
| Framework | Next.js (App Router), TypeScript | One deployable app — frontend + API routes — instead of two repos/services to run, configure, and keep in sync | [ADR-0001](./adr/0001-nextjs-fullstack-single-app.md) |
| LLM provider | Groq, `openai/gpt-oss-120b` (the BRD-named `llama-3.3-70b-versatile` 404'd — Groq's lineup moved past the SDK's bundled type list; corrected by querying the live `/models` endpoint) (originally Gemini — three model swaps and two latency mitigations there before a live, timestamped test showed zero tokens in 20s; full trail in ADR-0004) | LPU-accelerated inference; verified live at 0.7s for a plain reply and 1.4s for a full tool-call round trip with correct data, no hallucination | [ADR-0009](./adr/0009-groq-as-llm-provider.md) (supersedes [ADR-0004](./adr/0004-gemini-pro-as-llm-provider.md), which supersedes [ADR-0002](./adr/0002-groq-vercel-ai-sdk-orchestration.md)) |
| Orchestration | Vercel AI SDK (`ai`, `@ai-sdk/google`) | Native streaming + tool calling, a `useChat` hook, and — as proven mid-project — a provider can be swapped without touching this layer | [ADR-0002](./adr/0002-groq-vercel-ai-sdk-orchestration.md) |
| Intent routing | LLM-native tool selection, no separate classifier | The rubric's 30%-weighted criterion *is* tool-routing accuracy; a hand-rolled router in front of it would be graded instead of the thing being graded | [ADR-0006](./adr/0006-llm-native-intent-routing.md) |
| CRM integration | Zoho CRM REST API v2/v8, OAuth 2.0 Self Client, REST-only sync | "Real-time" only needs to mean "live when asked," which a synchronous outbound call satisfies without inbound infrastructure | [ADR-0003](./adr/0003-zoho-rest-sync-in-memory-session.md) |
| Session state | In-memory, per-process, keyed by a session cookie | Zoho is already the durable system of record; conversation history doesn't need its own database | [ADR-0003](./adr/0003-zoho-rest-sync-in-memory-session.md) |
| Booking data model | A Deal at `Stage = "Closed Won – Booking Done"`, not a separate module | Reuses the Deals integration already required for Stage 2; avoids hand-provisioning a custom module schema | [ADR-0005](./adr/0005-booking-as-deal-stage.md) |
| UI | Tailwind CSS + shadcn/ui + [AI Elements](https://ai-sdk.dev/elements) | AI Elements' `Conversation`/`Message`/`PromptInput`/`Tool`/`Suggestion` are purpose-built for `useChat`'s message stream (tool-call display in particular replaces a hand-rolled Badge hack); only the 6 components we actually use were kept out of ~50 the default install pulls in — see §3a | [ADR-0008](./adr/0008-ai-elements-pruned-component-set.md) |
| Package manager | pnpm | Faster installs; user preference | — |
| Testing | Vitest, scaffolded now, real suites added alongside logic | Configuring the runner once, early, is nearly free; writing suites competes with implementation time (§2) | — |
| Lint/format | Biome via the [Ultracite](https://ultracite.dev) preset, replacing the create-next-app default of ESLint | Single fast tool for both lint and format; Ultracite's stricter-than-default ruleset caught real issues during scaffolding (non-null assertions masking missing control-flow narrowing, un-hoisted regex literals, unstable inline JSX handlers) — see `lib/tools/search-deal.ts`/`search-booking.ts` and `app/page.tsx` | [ADR-0007](./adr/0007-biome-ultracite-over-eslint.md) |
| Diagramming | Mermaid, embedded in README and this PRD | Diffable as text, renders natively on GitHub, stays in sync as the design evolves | — |

### 3a. AI Elements component set

`pnpm dlx ai-elements@latest` installs its entire catalog by default (~50 components spanning agent-builder canvases, terminals, voice input, sandboxes — far beyond a text chat assistant) plus every shadcn/ui primitive any of them touch. After installing, the set was pruned to only what this app's chat UI (`app/page.tsx`) actually imports, computed as a transitive dependency closure rather than guessed by eye:

- **Kept (`components/ai-elements/`)**: `conversation`, `message`, `prompt-input`, `tool`, `suggestion`, `code-block` (a dependency of `tool`'s JSON display).
- **Kept (`components/ui/`)**: `badge`, `button`, `button-group`, `collapsible`, `command`, `dialog`, `dropdown-menu`, `input`, `input-group`, `scroll-area`, `select`, `separator`, `spinner`, `textarea`, `tooltip`.
- **Removed**: 41 unused `ai-elements` components (agent/canvas/terminal/sandbox/voice-input/file-tree and similar — none apply here) and 10 unused `ui` primitives (`accordion`, `alert`, `avatar`, `card`, `carousel`, `popover`, `progress`, `switch`, `tabs`, and `hover-card` once its only caller was trimmed — see below), plus 9 now-orphaned npm packages those removed components pulled in (`@xyflow/react`, `@rive-app/react-webgl2`, `media-chrome`, `embla-carousel-react`, `ansi-to-react`, `motion`, `react-jsx-parser`, `tokenlens`, `@radix-ui/react-use-controllable-state`).
- **`components/ai-elements/prompt-input.tsx` was also trimmed internally**, not just kept-or-deleted whole: its unused attachment/screenshot menu items and its `PromptInputHoverCard*` wrapper were removed. This wasn't just cleanup — those specific exports failed `pnpm build`'s type check against the installed `@base-ui/react@1.8.0` (a genuine upstream version-skew bug in the registry code, confirmed by testing the same failure against Base UI's current latest release), and we don't use them. `PromptInputSubmit`, which we *do* use, had a related but narrower typing bug (its internal click handler's event type didn't match what Base UI's `Button` now expects) — fixed in place by deriving the handler's parameter type from the `onClick` prop itself rather than hardcoding `React.MouseEvent`, so it tracks whatever Base UI expects instead of drifting again.
- **`components/ai-elements/` and `components/ui/` are excluded from Biome's lint scope** (`biome.jsonc`), since they're vendored registry code, not hand-authored — see the comment there for the full reasoning.
- To reinstall anything trimmed here later (e.g. attachment support), `pnpm dlx ai-elements@latest add prompt-input --overwrite` re-fetches the current registry version.
- **Two more scaffold bugs surfaced and were fixed in `app/globals.css`** while chasing why the UI still looked unstyled after the import fix above: a broken `@import "shadcn/tailwind.css"` (see ADR-0008's Context), and a self-referential `--font-sans: var(--font-sans);` CSS variable that silently fell back to the browser default font instead of the Geist Sans actually loaded in `layout.tsx` — fixed to `var(--font-geist-sans)`. Neither was a Biome/Ultracite issue; both trace to the initial `shadcn init` scaffold not matching this project's font setup.
- **Visual density pass**: bigger text, rounder/"chunkier" user-message bubbles, a branded header icon, and a taller, bolder prompt-input shell — done mostly via `className` overrides from `app/page.tsx` (including `group-[.is-user]:`-prefixed overrides, which `cn()`'s tailwind-merge resolves correctly against a component's own same-prefixed defaults), except where a styled element isn't exposed as a prop at all (`PromptInput`'s inner `InputGroup` shell), which required editing `prompt-input.tsx` directly — a Tailwind arbitrary `[&_[data-slot=...]]:` selector was tried first to avoid that edit and silently failed to compile. Full account, including how the silent failure was diagnosed: [ADR-0008](./adr/0008-ai-elements-pruned-component-set.md)'s third Update section.
- Full context, considered alternatives, and consequences: [ADR-0008](./adr/0008-ai-elements-pruned-component-set.md).

## 4. Lifecycle stage → CRM mapping

| Stage | Trigger | Agent behavior | Zoho module / operation |
| :---- | :---- | :---- | :---- |
| 1. New Lead | Unidentified visitor asks about models/pricing/features | Answer spec/pricing query, pitch test drive, collect Name/Phone/Email/City | **Create** in `Leads`, vehicle model in a custom field |
| 2. Ongoing Pipeline | Existing prospect gives phone/deal ID | Fetch deal status, report scheduled time/quote, update follow-up prefs | **Search + update** in `Deals` |
| 3. Booked Vehicle | Customer with a paid booking asks delivery/VIN/payment link | Validate Booking ID or phone, report allocation stage | **Search** `Deals` where `Stage = "Closed Won – Booking Done"` ([ADR-0005](./adr/0005-booking-as-deal-stage.md)); custom fields for Booking ID / VIN / allocation status |
| 4. Post-Purchase/Service | Existing owner logs complaint or books service | Gather registration number, odometer, issue/service type, preferred center | **Create** in `Cases`, linked to existing `Contact` |

## 5. Tool inventory (proposed)

This is the concrete tool set [ADR-0006](./adr/0006-llm-native-intent-routing.md) refers to — a flat list exposed to the model every turn, no gating. Finalized during scaffolding, but shaped now so implementation has a clear starting contract.

| Tool | Backing | Stage(s) | Purpose | Key parameters |
| :---- | :---- | :---- | :---- | :---- |
| `lookupVehicleModel` | Local reference dataset (JSON), **not** Zoho | 1 | Authoritative specs/pricing for XUV700, Thar, Scorpio-N variants, so the agent never hallucinates a price or spec (rubric: "accurate vehicle jargon") | `model`, `variant?` |
| `createLead` | Zoho `Leads` | 1 | Register a new prospect after a vehicle-interest conversation | `fullName`, `phone`, `email`, `preferredCity`, `vehicleModel` |
| `searchDeal` | Zoho `Deals`, filters on custom `Customer_Phone` or record ID | 2 | Find an in-pipeline deal by phone or Deal ID | `phone?`, `dealId?` |
| `updateDealFollowUp` | Zoho `Deals` | 2 | Persist an updated follow-up preference on a matched deal | `dealId`, `followUpPreference` |
| `searchBooking` | Zoho `Deals`, filtered to `Stage = "Closed Won – Booking Done"` and custom `Booking_ID`/`Customer_Phone` | 3 | Find a booking by Booking ID or phone; report allocation stage / VIN / payment status | `bookingId?`, `phone?` |
| `searchContactByPhone` | Zoho `Contacts` | 3, 4 | Resolve an existing customer's Contact record by phone, to confirm identity without necessarily filing a Case | `phone` |
| `createServiceCase` | Zoho `Cases` + `Contacts` | 4 | File a service/complaint Case. Resolves the owner's Contact by phone internally — **creates one if it doesn't exist** — rather than requiring the model to chain `searchContactByPhone` first | `fullName`, `phone`, `registrationNumber`, `odometerReading`, `issueDescription`, `serviceType`, `preferredCenter` |

The Contact gap flagged during planning (§11 originally) is resolved as **Option B** from that note: `createServiceCase` is self-contained rather than depending on a separately-seeded Contact or a prior tool call succeeding — more resilient to the model skipping a step, which is exactly what the rubric's "edge-case recovery" criterion rewards.

Every Zoho-backed tool shares one authenticated client (§13) that handles access-token refresh transparently — tools themselves never see raw OAuth mechanics. Implementation lives in `lib/tools/*.ts`; the underlying client in `lib/zoho/client.ts`.

## 6. Non-functional requirements

- **Latency**: prioritize time-to-first-token over total completion time — the Vercel AI SDK streams both the model's own tokens and, where practical, intermediate "working on it" state while a tool call is in flight, so the UI never sits silently during a Zoho round-trip. No hard SLA is graded, but the rubric explicitly rewards low *perceived* latency (15% weight). `streamText` is called with `maxRetries: 0` and `timeout: 20_000` — added while still on Gemini (`maxRetries: 0` to stop retry amplification after a plain "Hi" took 109s; `timeout` after `maxRetries: 0` alone still allowed a 3.8-minute hang, since it bounds retry count, not per-attempt duration). Kept as defensive insurance now that the provider is Groq ([ADR-0009](./adr/0009-groq-as-llm-provider.md)), even though Groq hasn't shown this failure mode — full diagnostic trail in [ADR-0004](./adr/0004-gemini-pro-as-llm-provider.md).
- **Error handling / edge-case recovery** (rubric: 30%-weighted, explicitly named): every Zoho tool call that fails (record not found, ambiguous match, expired token, rate limit) returns a structured, LLM-legible error rather than throwing — the model is expected to relay this conversationally (e.g. "I couldn't find a booking under that ID — could you double-check it?") rather than the UI showing a raw stack trace or generic error banner.
- **OAuth token management** (rubric: 25%-weighted, explicitly named "Robust OAuth 2.0 token management"): access tokens are cached in-memory with their expiry, refreshed proactively (not reactively on a 401) using the stored `refresh_token`, and refresh failures surface as a distinct, loggable error class from CRM-data errors so the two failure modes are never conflated during debugging.
- **Security**: all secrets (`GOOGLE_GENERATIVE_AI_API_KEY`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`) live only in `.env.local` (gitignored) with placeholders in `.env.example`; none are ever logged, committed, or pasted into planning conversations. This is not a hypothetical policy — during this planning session a freshly generated Gemini API key was pasted into chat and was immediately rotated as a result; that incident is the reason this line exists.
- **Observability**: for the scope of a local demo, structured `console` logging of each tool call (name, params, result/error, latency) is sufficient — no external logging service is justified for a single-sitting Loom recording.
- **Domain tone** (rubric: 20%-weighted "Automotive Domain Prompting"): the system prompt encodes an OEM brand voice (professional, concise, correct vehicle jargon) and structured slot-filling for service intake, rather than a generic customer-support persona.

## 7. Deployment & demo

Local-only (`pnpm dev`), screen-recorded for the required 5–7 minute Loom walkthrough covering all 4 stage scenarios plus the corresponding live updates in the Zoho CRM dashboard. No public URL is needed, since sync is REST-only ([ADR-0003](./adr/0003-zoho-rest-sync-in-memory-session.md)).

## 8. Deliverables checklist (BRD §5)

| Deliverable | Status | Notes |
| :---- | :---- | :---- |
| Private GitHub repo — modular code | ✅ Done | Next.js app scaffolded and refactored with SOLID modular components (`components/chat/*`); pushed to GitHub |
| `README.md` with execution steps | ✅ Done | Complete environment setup, seed commands, local execution, and project structure documented |
| `.env.example` | ✅ Done | Repo root |
| Setup script(s) | ✅ Done | [`scripts/seed-zoho-mock-data.sh`](../scripts/seed-zoho-mock-data.sh) (also `pnpm seed:zoho`) |
| Architecture diagram | ✅ Done | §9 below (Mermaid) |
| Demo Loom (5–7 min) | ⬜ Ready | App is functionally ready; provider latency issue resolved; full test scenarios and code traces documented in `docs/journals/` |
| ADRs for hard-to-reverse decisions | ✅ Done | [`docs/adr/`](./adr/) — 11 ADRs (0001 through 0011) |
| Domain glossary | ✅ Done | [`CONTEXT.md`](../CONTEXT.md) |


## 9. Architecture

```mermaid
flowchart TD
    User[Browser: Chat UI, useChat holds\nmessage history client-side] -->|POST full message history each turn| API[Next.js API Route]
    API -->|streamText + tools, stopWhen: stepCountIs(5)| LLM[Groq: openai/gpt-oss-120b via @ai-sdk/groq]
    LLM -->|tool call| Tools[Tool layer: lookupVehicleModel, createLead,\nsearchDeal, updateDealFollowUp, searchBooking,\nsearchContactByPhone, createServiceCase]
    Tools -->|OAuth REST| Zoho[Zoho CRM REST API]
    Zoho --> Leads[(Leads)]
    Zoho --> Deals[(Deals / Potentials)]
    Zoho --> Cases[(Cases)]
    Zoho --> Contacts[(Contacts)]
```

Single request lifecycle: browser sends the *full* message history (held client-side by `useChat` — see the note below) → Vercel AI SDK streams a response from Groq, invoking one or more tools as the model decides they're needed → tools call Zoho's REST API using a cached/proactively-refreshed access token → tool results feed back into the same streamed turn, and `stopWhen: stepCountIs(5)` lets the model continue past a tool call to actually phrase a reply, instead of stopping right after the call → UI renders incrementally as tokens and tool results arrive.

**Implementation note — refining ADR-0003's "session store" during scaffolding**: ADR-0003 specifies "in-memory, per-process, keyed by a session cookie." In practice, `useChat`'s default transport already resends the complete message history from client-side React state on every request — building a redundant server-side `Map` to hold the same history would duplicate what the client already holds, for no benefit. The substantive part of ADR-0003 (no database, ephemeral, resets on reload) is satisfied by this client-held state; the "server-side Map" detail was a reasonable *guess* at implementation before any code existed and turned out to be unnecessary, not a decision this refinement reverses. The one genuinely server-side in-memory state is the Zoho OAuth access-token cache in `lib/zoho/client.ts` — but that's a single module-level value shared by the whole app instance, not scoped per chat session.

## 10. Rubric alignment map

Explicit cross-reference from the grading rubric (BRD §6) to where each criterion is addressed, so nothing gets built without a clear line back to what's actually graded.

| Rubric line | Weight | Addressed in |
| :---- | :---- | :---- |
| Agent Design & Function Calling | 30% | §5 (tool inventory), [ADR-0006](./adr/0006-llm-native-intent-routing.md) |
| Zoho CRM Integration | 25% | §6 (OAuth/error handling), [ADR-0003](./adr/0003-zoho-rest-sync-in-memory-session.md), [ADR-0005](./adr/0005-booking-as-deal-stage.md) |
| Automotive Domain Prompting | 20% | §6 (domain tone), §5 (`lookupVehicleModel`) |
| Latency & UI/UX | 15% | §6 (latency), [ADR-0009](./adr/0009-groq-as-llm-provider.md) (provider switch — the actual fix, not just mitigations)/[ADR-0004](./adr/0004-gemini-pro-as-llm-provider.md) (what was tried first), [ADR-0008](./adr/0008-ai-elements-pruned-component-set.md) (`Tool`'s state-aware collapsible display, markdown-rendered responses) |
| Code Quality & Documentation | 10% | [ADR-0001](./adr/0001-nextjs-fullstack-single-app.md), [ADR-0007](./adr/0007-biome-ultracite-over-eslint.md) (lint/format standard), [ADR-0008](./adr/0008-ai-elements-pruned-component-set.md) (dependency hygiene), this PRD, `CONTEXT.md`, `docs/adr/` |

## 11. Assumptions & risks

- ~~**Assumption**: Gemini's free-tier rate limits are sufficient...~~ — **confirmed false, and resolved**: a hard 20-requests/day quota cap (exhausted from testing alone), a 109-second response from SDK retries honoring Gemini's own suggested delays, and — after two mitigations (`maxRetries: 0`, then `timeout: 20_000`) — a live, timestamped test proving Gemini could produce zero tokens in 20 seconds for a one-sentence reply. **Switched providers**: Groq, `openai/gpt-oss-120b` — see [ADR-0009](./adr/0009-groq-as-llm-provider.md) (full history of what was tried first, and why each step wasn't enough, in [ADR-0004](./adr/0004-gemini-pro-as-llm-provider.md)). **Verified live**: 0.7s for a plain reply, 1.4s for a full tool-call round trip. This is no longer an open risk.
- **Assumption**: Zoho's free developer tier's API call quota (~1000/day) is not a constraint for a single demo session. **Risk if wrong**: low — the demo is a handful of calls, not sustained load.
- **Assumption**: The evaluator will run the app locally by following `README.md`, not expect a hosted link. **Risk if wrong**: revisit §7 (Vercel deploy was deliberately deferred, not ruled out).
- **Risk**: Modeling Booking as a Deal stage ([ADR-0005](./adr/0005-booking-as-deal-stage.md)) means Deals and Bookings share one object type distinguished only by `Stage` — if the evaluator's rubric implementation specifically expects a separate custom module, this reads as a deliberate, documented trade-off rather than an oversight, which is the best mitigation available for an ambiguity the BRD itself introduced.
- ~~**Gap**: no mock Contact record~~ — resolved during scaffolding: `createServiceCase` finds-or-creates its own Contact by phone (§5, "Option B" from the original note). No standalone Contact seeding needed.
- ~~**Known issue**: Gemini's free tier returned transient 503s repeatedly~~ — moot now that the provider is Groq ([ADR-0009](./adr/0009-groq-as-llm-provider.md)). Kept historical: if a similar pattern ever appears on Groq, the diagnostic approach that found this (timestamp raw SSE events with `curl`/Python rather than trusting total request time) is the one to reuse — see ADR-0004.

## 12. Open items / next steps

1. ~~Zoho CRM Self Client setup~~ — done (§13).
2. ~~Populate Zoho mock data~~ — done (§14).
3. ~~Repo housekeeping~~ — `.gitignore` added, covering `.env.local` (was previously unprotected — a real risk given real credentials now exist on disk), `.agents/`, `skills-lock.json`. `AGENTS.md`/`docs/agents/*` left as-is for now, pending whether the GitHub-issue-tracker workflow they describe actually gets used for this project.
4. ~~Scaffold the Next.js app, wire up the tool layer, implement the 4 flows~~ — done. Next.js (App Router, TS, Tailwind, shadcn/ui) scaffolded; Vercel AI SDK + `gemini-flash-latest` wired up (ADR-0004 update); all 7 tools from §5 implemented against the live Zoho schema (§14, now including 4 more fields discovered mid-implementation — `Follow_Up_Preference` on Deals, `Registration_Number`/`Odometer_Reading`/`Preferred_Service_Center` on Cases); chat UI with streaming, tool-call display, and error/retry handling; Vitest smoke tests pass; `pnpm build`/`pnpm lint` clean.
5. ~~Fix broken styling, adopt AI Elements, replace ESLint with Biome/Ultracite~~ — done. Root cause of the unstyled UI was a broken `@import "shadcn/tailwind.css"` in `app/globals.css` (fixed — [ADR-0008](./adr/0008-ai-elements-pruned-component-set.md)'s Context section has the full diagnosis). ESLint replaced with Biome via Ultracite ([ADR-0007](./adr/0007-biome-ultracite-over-eslint.md)), which caught several real bugs in code written earlier in this project. `app/page.tsx` rewritten on AI Elements, installed then pruned from ~50 components down to 6 + 15 `ui` primitives, including an in-place fix for a genuine upstream `@base-ui/react` version-skew bug ([ADR-0008](./adr/0008-ai-elements-pruned-component-set.md)).
6. ~~Fix the remaining font/styling bug, do a visual density pass~~ — done. A second `app/globals.css` bug (self-referential `--font-sans`) found and fixed alongside item 5's; UI restyled for a denser, "chunkier" feel (bigger text, rounder message bubbles, bolder prompt input) — see [ADR-0008](./adr/0008-ai-elements-pruned-component-set.md)'s Update sections and §3a.
7. ~~Push to a private GitHub repo~~ — done outside this planning thread (confirmed via `git fetch`: `origin` → `github.com/Abbas4tech/AI-Chatbot`, local commits match `origin/main`). **Not independently verified from here that the GitHub repo's visibility is actually set to Private** — worth a manual check in GitHub's settings.
8. ~~Resolve the Gemini quota/latency decision~~ — superseded by a stronger fix than originally planned. `maxRetries: 0` and `timeout: 20_000` bounded the damage, but a live timestamped test then proved Gemini's free tier could produce zero tokens in 20s for a one-sentence reply — a "sustained pattern," the exact threshold ADR-0004 set for switching providers. **Switched to Groq** (`openai/gpt-oss-120b` — the BRD-named `llama-3.3-70b-versatile` had been deprecated off Groq's live lineup since `@ai-sdk/groq`'s types were published; corrected by querying the real model list) — see [ADR-0009](./adr/0009-groq-as-llm-provider.md). This is now fully resolved, not just bounded.
9. ~~Verify `lookupVehicleModel` (Stage 1, non-Zoho) live~~ — done on the current provider: 0.7s for a plain reply, 1.4s for a full tool-call round trip, correct arguments extracted, correct catalog data returned (no hallucination), reply followed the system prompt's Stage 1 script unprompted. **Still open**: the other 6 tools — all Zoho-touching (`createLead`, `searchDeal`, `updateDealFollowUp`, `searchBooking`, `searchContactByPhone`, `createServiceCase`) — are implemented and type/lint-clean but have only been validated via direct API calls (the seed script), never via the LLM actually choosing and calling them in conversation. This is the biggest remaining risk against the rubric's 30%-weighted "Agent Design & Function Calling" criterion, and should happen before the Loom recording, not during it.
10. Embed the architecture diagram (§9) into `README.md` — it currently only lives in this PRD; the BRD lists it as its own deliverable line item, separate from the README.
11. Record the 5–7 minute Loom demo — blocked on items 9 and 10.

## 13. Credentials & environment reference

All secrets live in `.env.local` (gitignored), documented with placeholders in `.env.example`. **Never pasted into chat or committed.**

| Variable | Purpose | Status |
| :---- | :---- | :---- |
| `GROQ_API_KEY` | Groq API access (console.groq.com, free tier) | ✅ Obtained ([ADR-0009](./adr/0009-groq-as-llm-provider.md)). `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini) was used earlier in the project — see ADR-0004 — and is no longer read by the app; the key that was briefly pasted into chat and rotated (see below) was the Gemini one, not this one |
| `ZOHO_CLIENT_ID` | Self Client OAuth credential | ✅ Obtained |
| `ZOHO_CLIENT_SECRET` | Self Client OAuth credential | ✅ Obtained |
| `ZOHO_REFRESH_TOKEN` | Long-lived token to mint access tokens | ✅ Obtained via one-time grant-code exchange (below) |
| `ZOHO_DC` | Data center domain (`com`, `in`, `eu`, ...) — determines API/accounts host | ✅ `in` (confirmed from `api-console.zoho.in`) |

### How the Zoho refresh token was obtained

1. Created a **Self Client** at `api-console.zoho.in`, scope `ZohoCRM.modules.ALL,ZohoCRM.settings.ALL`.
2. Copied `client_id`/`client_secret` (Client Secret tab, non-expiring) into `.env.local`.
3. Generated a one-time grant code (Generate Code tab, 3-minute expiry), pasted it into `.env.local` as a throwaway `ZOHO_GRANT_CODE` value — never into chat.
4. Exchanged it for a `refresh_token` via a single POST to `https://accounts.zoho.in/oauth/v2/token`, run as a local shell command that sourced `.env.local` for its inputs and wrote the result straight back into `.env.local`. The spent grant code was deleted from the file immediately after.
5. `CLIENT_ID`/`CLIENT_SECRET` were then renamed to `ZOHO_CLIENT_ID`/`ZOHO_CLIENT_SECRET` to match this table.

At no point did a real secret value appear in the planning conversation — only variable *names*, status, and (once) a redacted Zoho error code. This is the pattern to reuse for any future credential work on this project.

## 14. Live Zoho schema & mock data (as seeded)

Custom fields added beyond Zoho's stock Leads/Deals schema, confirmed via a read-only Settings API call rather than assumed from labels:

| Module | Field label | API name | Type |
| :---- | :---- | :---- | :---- |
| Leads | Vehicle Model | `Vehicle_Model` | text |
| Deals | VIN | `VIN` | text |
| Deals | Booking ID | `Booking_ID` | text |
| Deals | Allocation Status | `Allocation_Status` | picklist (`In Transit`, `Dispatch Pending`, `Delivered`) |
| Deals | Customer Phone | `Customer_Phone` | text — standard Deals has no phone field, and both `searchDeal` and `searchBooking` (§5) need to filter by phone per the BRD's own trigger language |
| Deals | Follow Up Preference | `Follow_Up_Preference` | text — added while implementing `updateDealFollowUp` (§5) |
| Cases | Registration Number | `Registration_Number` | text — added while implementing `createServiceCase` (§5) |
| Cases | Odometer Reading | `Odometer_Reading` | integer — added while implementing `createServiceCase` (§5) |
| Cases | Preferred Service Center | `Preferred_Service_Center` | text — added while implementing `createServiceCase` (§5) |

Deals' `Stage` picklist also got one new value: `Closed Won - Booking Done` (§ADR-0005), same probability as the stock `Closed Won`. Every field above was added via a read-verified Settings API call, never guessed from a label — see [§6](#6-non-functional-requirements)'s credential-handling pattern, reused here.

Mock data seeded via [`scripts/seed-zoho-mock-data.sh`](../scripts/seed-zoho-mock-data.sh) (idempotent to re-run only if you intend duplicates):

| Record | Module | Key fields |
| :---- | :---- | :---- |
| Rajesh Sharma | Leads | `Vehicle_Model = Thar`, Pune, mock phone/email |
| Priya Patel – XUV700 | Deals | `Stage = Proposal/Price Quote`, `Customer_Phone` set, ₹19,00,000 mock quote |
| Booking #MAH-9921 – Scorpio-N Z8L (Vikram Nair) | Deals | `Stage = Closed Won - Booking Done`, `Booking_ID = MAH-9921`, `Allocation_Status = Dispatch Pending`, `VIN` deliberately unset (realistic "not yet allocated" state for the Stage-3 VIN query) |

All three were created through the live Zoho REST API using the credentials in §13 — the same code path the application's tool layer will use — rather than through the Zoho UI, which incidentally already exercises and validates the OAuth setup end-to-end.
