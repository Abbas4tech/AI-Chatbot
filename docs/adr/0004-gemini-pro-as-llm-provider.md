---
status: accepted
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

## Security note

During setup, a freshly generated AI Studio API key was pasted directly into this planning conversation. It was treated as compromised on the spot and rotated immediately, and a new key was generated and kept out of chat from that point on. This is recorded here — not as an incident report, but as the concrete reason the project's operating rule is: **secrets go directly into `.env.local`, never into a chat transcript, a commit, or any document.** See [PRD §6](../PRD.md).

## Related

[ADR-0002](./0002-groq-vercel-ai-sdk-orchestration.md) (superseded, provider only) · [PRD §3, §6, §11](../PRD.md)
