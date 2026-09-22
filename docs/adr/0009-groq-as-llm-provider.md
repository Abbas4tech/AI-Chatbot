---
status: accepted
---

# Groq as LLM provider, superseding Gemini (ADR-0004)

## Context

[ADR-0004](./0004-gemini-pro-as-llm-provider.md) chose Gemini over Groq because the user already held free-tier access with zero new signup required. Its own Consequences section, from the start, named the exact condition under which that choice should be revisited: "if free-tier rate limits prove too tight once all 4 flows are being exercised for real, the documented fallback is Groq." Over the course of implementation that ADR tracked three escalating mitigations — a model swap (Pro → Flash → Flash-lite) chasing a less-congested quota bucket, then `maxRetries: 0` after a plain "Hi" took 109 seconds, then `timeout: 20_000` after `maxRetries: 0` alone still allowed a 3.8-minute hang — each one addressing a *symptom* of Gemini's free-tier congestion without addressing the congestion itself.

The threshold was finally met with direct, reproducible evidence rather than an accumulation of anecdotes: a timestamped trace of the raw SSE stream for a one-sentence request ("Say hello in one short sentence") showed the request's own `{"type":"start"}` event firing at 0.016s (confirming our server and the AI SDK's plumbing were never the bottleneck), followed by **zero further events for the full 20 seconds** until `timeout` aborted it. Gemini's server did not produce a single token — not a slow stream, no stream at all. This was distinct from every earlier symptom: not a retry compounding a delay, not a hung connection with no ceiling — one clean, unretried, time-bounded attempt that simply failed to start generating in time.

## Decision

Switch the LLM provider from Gemini (`@ai-sdk/google`) to Groq (`@ai-sdk/groq`). The orchestration layer (Vercel AI SDK's `streamText`, the tool set, `stopWhen`, `maxRetries`, `timeout`) is unchanged, confirming the bet made back in [ADR-0002](./0002-groq-vercel-ai-sdk-orchestration.md) and reaffirmed in ADR-0004: swapping LLM providers in this codebase costs one package and one env var, not a rewrite. Model id: see the Update below — the model originally chosen here didn't survive contact with a live request.

## Considered options

1. **Groq (chosen).** LPU-accelerated inference; no comparable slowness observed anywhere in this session's Groq-adjacent research (unlike Gemini, which was tested repeatedly and directly, under real conditions, across multiple models and multiple failure modes).
2. **Stay on Gemini, accept the variance.** Explicitly offered to and rejected by the user once shown the live evidence — replies would keep ranging from a few seconds to a 20-second timeout unpredictably, which is disqualifying for the 15%-weighted latency/UX criterion regardless of how well `maxRetries`/`timeout` bound the worst case.
3. **Investigate further before switching** (different Gemini model, different time of day). Also offered and declined — the evidence already available (three independent failure modes across multiple models, over multiple points in this session) was judged sufficient; further investigation would only have delayed reaching the same place ADR-0004 had already scoped as the fallback trigger.

## Consequences

- Requires a new credential: `GROQ_API_KEY` from console.groq.com (free, no card). `.env.example` and `README.md` updated; `GOOGLE_GENERATIVE_AI_API_KEY` is no longer read by the app (left documented in ADR-0004 as history, not deleted from the record).
- `maxRetries: 0` and `timeout: 20_000` (from ADR-0004's final update) are kept as-is on the Groq call. Groq hasn't exhibited the failure mode that motivated them in this session's testing, but there's no cost to leaving a defensive timeout in place, and removing it would be optimizing for a problem we no longer have evidence of rather than one we have evidence of avoiding.
- The rubric's "Automotive Domain Prompting" (20%) and "Agent Design & Function Calling" (30%) criteria now depend on Llama 3.3's tool-calling and instruction-following rather than Gemini's — `lib/system-prompt.ts` and the 7 tools in `lib/tools/` were written model-agnostically (no Gemini-specific prompting tricks), so no changes were needed there, but this is worth re-verifying once live testing resumes (see the open item in `docs/PRD.md` §12 about the 6 Zoho-touching tools never having been exercised through real model tool-calling).
- This closes the "decision needed" framing that had been open in `docs/PRD.md` §11 since the 20-requests/day quota was first discovered — the provider question is now settled, not pending.

## Update: model id corrected to `openai/gpt-oss-120b`, verified live

`llama-3.3-70b-versatile` — chosen above because it's the specific model the BRD names by example ("Groq API with Llama-3") and present in `@ai-sdk/groq`'s bundled TypeScript types — returned `404 model_not_found` on the first real request. The SDK's type strings list models the package's authors knew about when it was published; they don't track what Groq is actually serving live, and Groq's lineup had moved on. Lesson worth keeping: for a fast-moving inference provider, check the live model list (`GET /openai/v1/models` against the account's own key) before trusting a type string, the same discipline already applied to Zoho field names earlier in this project (verify via a real API call, don't assume from a label).

Queried Groq's active models directly and found the general-purpose, non-audio, non-moderation options had narrowed to the `openai/gpt-oss-*` family. Picked `openai/gpt-oss-120b` — largest available, for the same tool-argument-extraction-accuracy reasoning as before.

**Verified live, twice, with the same timestamped-trace method used to diagnose Gemini**:
- Plain "Say hello in one short sentence": first real content at 0.694s, fully complete at **0.704s** total.
- Tool-calling request ("What is the price of the Thar AX (O) 4x4?"): `lookupVehicleModel` called within 0.65s with exactly the right extracted arguments (`{"model":"Thar","variant":"AX (O) 4x4"}`), correct catalog data returned (₹16,50,000, matching seeded data exactly — no hallucination), full natural-language reply complete at **1.405s**, and the reply followed the Stage 1 system-prompt script unprompted (pitched a test drive, asked for the customer's name next).

One model detail worth knowing for UI work: `gpt-oss-120b` is a reasoning model and streams its own chain-of-thought as `reasoning-delta` events before the final answer. `app/page.tsx`'s message renderer only handles `text` and `tool-*` part types, so these are silently dropped from the UI — confirmed this is the *correct* behavior for this product (an OEM dealership assistant shouldn't expose raw internal reasoning to customers), not a gap to fix.

This resolves the "re-verify tool-calling on the new provider" open item from this ADR's original Consequences for `lookupVehicleModel` specifically. The 6 Zoho-touching tools are still unverified through live model tool-calling — see `docs/PRD.md` §12.

## Related

[ADR-0004](./0004-gemini-pro-as-llm-provider.md) (superseded — full history of what was tried before this) · [ADR-0002](./0002-groq-vercel-ai-sdk-orchestration.md) (original Groq-first reasoning, before any credentials existed) · `docs/PRD.md` §3, §6, §11, §12
