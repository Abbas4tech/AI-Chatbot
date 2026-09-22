---
status: accepted
---

# LLM-native tool-calling for intent routing, no separate classifier

## Context

This is the single decision the grading rubric weights most heavily: "Agent Design & Function Calling" is 30% of the total grade, with explicit sub-criteria of "accuracy in tool routing, state persistence across turns, edge-case recovery." The BRD also explicitly requires the agent to "seamlessly switch context between vehicle discovery and ticket creation" mid-conversation — i.e. lifecycle-stage transitions are not assumed to happen in a fixed order, and a returning customer can plausibly re-enter an earlier stage (e.g. an existing owner in Stage 4 asking a fresh pricing question that belongs to Stage 1) without restarting.

## Decision

The agent routes between all four lifecycle stages purely through the LLM's own tool-calling. One system prompt describes all four stages; a single flat set of CRM tools (§5 of the PRD, ~7 tools) is exposed to the model on every turn, and the model chooses which (if any) to invoke based on conversation content. There is no separate pre-classification step — no cheap/fast model call, no rules/regex pass — that pins a session to one stage before the main agent runs.

## Considered options

1. **Single flat tool set, LLM chooses per turn (chosen).** No gating; every tool is visible every turn.
2. **Explicit pre-classifier.** A fast/cheap call or rules pass decides the active stage first, then exposes only that stage's tools. This shrinks the per-turn tool-choice surface, but: (a) adds a second network round-trip *before* any user-visible response, working directly against the 15%-weighted latency criterion; (b) introduces a second component whose failure mode is *silent* — the user never sees why they were routed to the wrong stage, unlike a tool-selection mistake, which is visible and correctable within the same conversation; (c) actively complicates the BRD's explicit mid-conversation context-switching requirement, since a pinned classifier stage would need its own re-classification trigger to unpin.
3. **Deterministic state-machine router**, where code (not the model) decides which stage transitions are legal. The most predictable option, but real customer conversations don't move through these stages in a fixed order — the state-machine's transition graph would need to special-case exactly the flexibility the BRD is testing for, effectively reimplementing option 1's job in code instead of prompt/tool design.

## Consequences

- Directly demonstrates the rubric's actual grading target — model-driven tool-routing accuracy — rather than substituting a hand-rolled router's accuracy for it.
- Naturally supports mid-conversation stage-switching (an explicit BRD requirement) since there is no pinned state to unwind or re-classify.
- Fewer moving parts to debug when the agent has to work correctly, live, for the Loom recording.
- All ~7 tool schemas are sent to the model on every turn — a larger per-request prompt than a filtered subset would produce. Acceptable at this tool count; would need revisiting (e.g. a two-tier routing scheme) if the tool inventory grew substantially, such as in a real production OEM deployment covering dozens of intents.
- **Edge-case recovery is now entirely the system prompt's and tool-error-design's responsibility** — what the model does when it picks the wrong tool, or a required identifier (phone, Booking ID, registration number) is missing or doesn't match, is not handled by any routing layer above it. This pushes real design weight onto prompt engineering and onto how tool errors are shaped (see [PRD §6](../PRD.md), "error handling / edge-case recovery") — to be resolved during implementation, not merely at the architecture level.

## Related

[PRD §5](../PRD.md) (tool inventory) · [PRD §6](../PRD.md) (error handling requirements this decision pushes onto the prompt layer) · [`CONTEXT.md`](../../CONTEXT.md) (Tool, Lifecycle Stage terms)
