---
status: superseded by ADR-0009
---

# Gemini Pro as LLM provider, superseding Groq (ADR-0002)

## Context

[ADR-0002](./0002-groq-vercel-ai-sdk-orchestration.md) picked Groq before any LLM credentials existed for the project, purely by reasoning about which free tier would be fastest. Mid-planning, the user revealed they already hold a "Gemini Pro" subscription. The initial assumption — that this subscription would grant API access — was incorrect and worth recording explicitly: **Gemini Advanced / Google One AI Premium is a consumer subscription** (the Gemini chat app plus some Workspace integrations) and is a **separate product** from the Generative Language API; it carries no API quota. What actually unlocks programmatic access is a **Google AI Studio API key** (aistudio.google.com), which the user separately already held on the Free tier, predating this session and unrelated to the Pro subscription.

## Decision

Use Google Gemini Pro as the LLM provider, accessed via a free-tier Google AI Studio API key and the Vercel AI SDK's `@ai-sdk/google` provider. The orchestration choice from [ADR-0002](./0002-groq-vercel-ai-sdk-orchestration.md) (Vercel AI SDK) is unchanged — only the provider package and credential differ.

## Considered options

1. **Gemini Pro via free-tier AI Studio key (chosen).** Already available, zero new signup, zero cost, strong tool-calling.
2. **Fall back to Groq as originally planned.** Still viable and explicitly kept as a documented fallback (see Consequences) — faster raw inference, but requires a fresh signup the user doesn't need if Gemini works.
3. **Enable billing on a Google Cloud project for higher Gemini quota.** Rejected — costs money, and the BRD specifically asks for free-tier usage.

## Consequences

- Free, already available, no incremental setup cost. Keeps the orchestration layer completely unchanged — swapping providers cost one package (`@ai-sdk/google` vs `@ai-sdk/groq`) and one env var, not a rewrite, which validates the orchestration bet made in ADR-0002.
- Google AI Studio's free-tier rate limits are tighter, and its typical latency higher, than Groq's LPU-accelerated inference — the original reason Groq was picked for the 15%-weighted latency criterion. Mitigated by leaning on the Vercel AI SDK's streaming (`streamText`/`useChat`) so *perceived* latency (time-to-first-token) stays low even where total completion time is higher. If free-tier rate limits prove too tight once all 4 flows are being exercised for real, the documented fallback is Groq, not a redesign.
- Free-tier quota is account-wide rather than project-scoped in some Google AI Studio configurations; a dedicated API key/project for this assessment (rather than reusing a key tied to unrelated experimentation) reduces the chance of an unrelated workload exhausting quota mid-demo.

## Update: model id changed from `gemini-pro-latest` to `gemini-flash-latest` during scaffolding

`gemini-pro-latest` (this ADR's original choice) returned `RESOURCE_EXHAUSTED` on its free-tier quota on the very first live request made against it — the Pro tier's free daily/per-minute allowance is apparently near-zero, not just "tighter than Groq" as anticipated above. `gemini-flash-latest`, same API key, same account, was verified working end-to-end in the same session, including a full tool-call round trip (`lookupVehicleModel` invoked with correct arguments, executed, result returned) before Google's API itself started returning transient `503 UNAVAILABLE` ("high demand") errors unrelated to our account or code — confirmed by hitting the same model directly with `curl`, outside the app entirely.

This is a smaller change than falling back to Groq (same provider family, zero new credentials, code already written generically against `@ai-sdk/google`), so it was made directly rather than re-opening the whole provider decision: see `app/api/chat/route.ts`, which documents this inline. Flash vs. Pro is a reasonable trade for this project anyway — lower latency (helps the 15%-weighted UX criterion) in exchange for slightly less capable reasoning, which a bounded 4-intent tool-routing task doesn't heavily lean on. If Google's `503`s prove to be a sustained pattern rather than transient congestion, Groq (already scoped as the fallback above) is the next step — not a code redesign, just another provider swap.

## Update: `maxRetries: 0` — fail fast instead of silently retrying into a 100+ second hang

The model id moved again, from `gemini-flash-latest` to the current `gemini-3.5-flash-lite` (same reasoning as the update above — same API key, no new credential, chasing a less-congested free-tier bucket). `app/api/chat/route.ts` deliberately doesn't restate the full model-swap history in its own comment each time this happens; this ADR is the source of truth for it.

More importantly, a live request surfaced a concrete cost of the "just retry" mitigation this ADR originally leaned on: a plain "Hi" took **109 seconds** to respond. Root cause, traced through the Vercel AI SDK's source rather than guessed: `streamText` retries failed requests (default `maxRetries: 2`) with exponential backoff, but it specifically **honors a provider-supplied `Retry-After`-style delay** instead of its own short backoff schedule when one is present. Gemini's free-tier error responses (both the `RESOURCE_EXHAUSTED` quota error from the first Update above, and transient `503` "high demand" errors) have been observed suggesting ~50–58 second delays. Two retries at that scale stack to almost exactly the 109 seconds observed — the request *did* eventually succeed, it just paid for two provider-side rate-limit waits invisible to the user except as a long silence.

**Decision**: set `maxRetries: 0` on the `streamText` call. A rate-limited request now fails immediately into the UI's existing error banner (`app/page.tsx`, wired to `useChat`'s `error`/`regenerate`) instead of the SDK silently sitting on it for up to two minutes. This is a deliberate **latency-over-resilience** trade-off, made explicitly because the user chose to stay on Gemini rather than switch to Groq at this point.

**This turned out to be an incomplete fix, caught by a second live test**: even with `maxRetries: 0`, one request still took **3.8 minutes**. `maxRetries` only stops the SDK from *retrying* a failed call — it doesn't bound how long a single attempt is allowed to hang, and Gemini's server itself sat on that one connection under "high demand" before eventually responding with a 503; nothing was retrying, the single attempt was just that slow. (Checked and ruled out `streamRetries`, the AI SDK's separate stream-reconnect retry knob, as the cause — it defaults to `0` already, confirmed by reading the SDK source, not assumed.) The actual fix: `timeout: 20_000` (20 seconds) on the same call, which the AI SDK aborts the attempt at regardless of retries. Both settings are needed together — `maxRetries: 0` so a failure doesn't compound into more waiting, `timeout` so a single slow attempt can't hang indefinitely either.

**Still true**: neither setting fixes the underlying free-tier congestion, they only bound how badly it can hurt the 15%-weighted latency/UX criterion when it happens. If Gemini's congestion turns out to be a sustained pattern (not just this session's testing having burned through quota) rather than occasional transient load, Groq remains the documented fallback from this ADR's original Decision — not a code redesign, just another provider swap, same as the Flash migration above.

## Superseded by ADR-0009

The "sustained pattern" threshold above was met: a timestamped, reproducible test showed Gemini failing to produce a single token within the 20-second `timeout` for a one-sentence reply. This ADR's core decision — Gemini as provider — is superseded by [ADR-0009](./0009-groq-as-llm-provider.md), which switches to Groq. This ADR is kept in full rather than deleted: it's the accurate record of what was tried, in what order, and exactly why each step (Pro → Flash → Flash-lite, then `maxRetries: 0`, then `timeout`) wasn't sufficient on its own — that trail is what justifies the final switch, not just the last data point.

## Security note

During setup, a freshly generated AI Studio API key was pasted directly into this planning conversation. It was treated as compromised on the spot and rotated immediately, and a new key was generated and kept out of chat from that point on. This is recorded here — not as an incident report, but as the concrete reason the project's operating rule is: **secrets go directly into `.env.local`, never into a chat transcript, a commit, or any document.** See [PRD §6](../PRD.md).

## Related

[ADR-0002](./0002-groq-vercel-ai-sdk-orchestration.md) (superseded, provider only) · [PRD §3, §6, §11](../PRD.md)
