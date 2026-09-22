---
status: accepted
---

# Modular Chat Component Architecture & SOLID Refactoring

## Context

The chat UI in `app/page.tsx` was originally implemented as a single 225-line monolithic `"use client"` file. It bundled multiple distinct UI concerns into one component:

1. Chat shell layout and state bindings (`useChat`)
2. Custom tool-call execution rendering (`ToolCard`, collapsible details, status badges)
3. Multi-part message rendering (`MessagePart`, text streaming vs. tool-call dispatch)
4. Empty state landing hero and quick prompts (`ChatEmptyState`)
5. Navigation header (`ChatHeader`)
6. Scrollable message list container (`ChatMessageList`)

Additionally, several unused exports, dead icon imports, and unused UI component files were lingering after earlier UI pruning iterations.

## Decision

### 1 — Decomposition into Single-Responsibility Components (`components/chat/`)

We split `app/page.tsx` into dedicated, focused components under `components/chat/`, following SOLID principles:

- **`app/page.tsx`**: Entry point that binds `useChat` hook state and passes handlers down to `ChatContainer`.
- **`components/chat/chat-container.tsx`**: Manages the top-level chat container, main layout wrapper, and prompt input integration (`PromptInput`, submit handlers).
- **`components/chat/chat-header.tsx`**: Presentational header displaying branding, model badge, and session indicator.
- **`components/chat/chat-empty-state.tsx`**: Presentational empty state hero banner with suggestion prompts for the four lifecycle stages.
- **`components/chat/chat-message-list.tsx`**: Iterates through messages and manages conversation scrolling and message role alignment.
- **`components/chat/message-part.tsx`**: Determines how individual message parts (text vs tool-invocation) are rendered.
- **`components/chat/tool-card.tsx`**: Displays tool execution progress, collapsible arguments/results, status icons, and formatted JSON output.

### 2 — Elimination of Dead Code & Unused Exports

- Removed unused helper functions and dead exports (`ConversationDownload`, `messagesToMarkdown`, unused `DownloadIcon`) from `components/ai-elements/conversation.tsx`.
- Audited and cleaned up unreferenced imports in `components/ai-elements/` and `app/`.

### 3 — Strict Compliance with Ultracite / Biome Rules

- Fixed line breaks and type definitions to satisfy strict linting without unneeded biome-ignore annotations.
- Retained only justified suppressions (e.g. `noArrayIndexKey` for streaming message parts without unique IDs, `useErrorCause` in custom error classes).

## Consequences

- **Maintainability**: Each UI component now has a single clear responsibility and can be edited or tested independently.
- **Readability**: `app/page.tsx` is reduced from 225 lines to ~35 clean lines.
- **Type Safety**: Prop interfaces are explicitly typed and exported for each sub-component.
- **Zero Runtime Behavior Changes**: All streaming, message submission, tool rendering, and AI Elements integration behave identically.

## Related

- [ADR-0008](./0008-ai-elements-pruned-component-set.md) — AI Elements component selection
- [ADR-0010](./0010-session-store-slot-state-ky-http-client.md) — Session store & slot interceptor architecture
