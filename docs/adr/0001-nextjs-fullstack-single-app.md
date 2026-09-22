---
status: accepted
---

# Next.js full-stack single app, no separate backend

## Context

The BRD (§3) requires "a responsive frontend interface using React, or Next.js" but leaves backend architecture entirely to the candidate. The assessment is time-boxed to 6 hours and submitted as one private GitHub repository, graded in part on "unambiguous setup instructions" (Code Quality & Documentation, 10%). A split architecture — a React SPA (e.g. Vite) talking to a separate Node/Express service — would introduce CORS configuration, two `.env` files, two dev-server commands, and two ports for the evaluator to get right before they can even see the app run.

## Decision

Build the entire agent as one Next.js (App Router) application. Next.js API routes serve as the backend: they hold the LLM orchestration, the Zoho OAuth/REST client, and the tool implementations. The React frontend and its backend are the same deployable artifact.

## Considered options

1. **Next.js full-stack (chosen).** One `pnpm install && pnpm dev`, one `.env.local`, API routes co-located with the pages that call them.
2. **React SPA (Vite) + separate Express/Node backend.** Clearer textbook separation between UI and integration layer, but doubles the setup surface (two servers, two configs, CORS) for a 6-hour project with no requirement that demands the separation.
3. **React SPA + standalone serverless functions.** Avoids Express boilerplate but still needs two deploy/dev targets locally.

## Consequences

- Single install/run command for the evaluator; shared TypeScript types between API route handlers and frontend components with no package boundary to cross.
- The four lifecycle flows are traceable end-to-end (UI → API route → tool → Zoho) without jumping between two codebases.
- Next.js API routes run on a request/response lifecycle; a future need for a long-lived background worker (e.g. queued webhook processing) would require bolting on something else. Acceptable here since [ADR-0003](./0003-zoho-rest-sync-in-memory-session.md) rules out webhooks entirely.
- Less architectural separation between UI and integration layer than a dedicated backend service — mitigated by keeping `lib/` (Zoho client, tool implementations, LLM orchestration) cleanly separated from `app/` (routes, components) inside the single deployable, so the boundary still exists in the code even though not at the process/repo level.

## Related

[ADR-0003](./0003-zoho-rest-sync-in-memory-session.md) (REST-only sync is what makes a lightweight API-route backend sufficient, with no inbound endpoint to host separately) · [PRD §3, §5](../PRD.md)
