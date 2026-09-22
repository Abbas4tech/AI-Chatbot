---
status: superseded by ADR-0004 (provider only — orchestration choice below still stands)
---

# Groq + Vercel AI SDK for LLM orchestration, not LangChain/LlamaIndex

## Context

This decision was made before any LLM credentials existed for the project. The BRD (§3) names three acceptable free-tier avenues: Groq (Llama-3/DeepSeek), Google Gemini free tier, or local HuggingFace models via Ollama — leaving both the provider and the orchestration approach (LangChain, LlamaIndex, or direct SDK/tool-calling) to the candidate. With no credentials yet in hand, the choice was driven purely by optimizing against the rubric: latency/UX is 15% of the grade, and Agent Design & Function Calling is 30%.

## Decision

Use Groq (Llama 3.x) as the LLM provider, and the Vercel AI SDK (`ai` package) for tool-calling and streaming, instead of LangChain.js or LlamaIndex.TS.

## Considered options — provider

1. **Groq (chosen at the time).** LPU-accelerated inference — the lowest latency of the three options — free tier, OpenAI-compatible tool-calling.
2. **Google Gemini free tier.** Capable multimodal model with solid function calling, but carried open signup uncertainty at the time this decision was made (no credentials existed yet for either option).
3. **Local Ollama.** Zero marginal cost, but weaker tool-calling reliability than hosted frontier models, and ties latency to whichever machine runs it — unpredictable and out of our control for a criterion that's explicitly graded.

## Considered options — orchestration

1. **Vercel AI SDK (chosen).** Lightweight, native streaming + tool calling, a `useChat` React hook, and a provider-agnostic interface — which, as it turned out, is exactly what let the LLM provider be swapped in [ADR-0004](./0004-gemini-pro-as-llm-provider.md) without touching this layer at all.
2. **LangChain.js.** Richer agent-executor and memory abstractions, better suited to open-ended multi-tool planning than a fixed, well-enumerated 4-stage routing problem.
3. **LlamaIndex.TS.** RAG-first framework; there is no document corpus to retrieve over in this problem.
4. **Raw provider SDK.** Minimal lock-in, but streaming and tool-call parsing would have to be hand-rolled.

## Consequences

- At the time: fastest available inference at zero cost, at the price of being locked to Groq's model lineup and its periodic model deprecations.
- The orchestration choice (Vercel AI SDK) proved provider-agnostic in practice — swapping to Gemini later cost one package and one env var, not a rewrite. This is the main reason the *orchestration* half of this ADR remains accepted even though the *provider* half was superseded.

## Superseded by

[ADR-0004](./0004-gemini-pro-as-llm-provider.md) — once the user confirmed pre-existing free-tier Gemini access via Google AI Studio, the calculus changed from "which free tier is fastest" to "which free tier is already available with zero setup friction." Only the provider changed; the Vercel AI SDK orchestration layer described here was retained as-is.
