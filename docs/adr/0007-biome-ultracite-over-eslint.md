---
status: accepted
---

# Biome (via the Ultracite preset) replacing ESLint

## Context

`create-next-app` scaffolded the project with ESLint (`eslint-config-next`) by default as part of the Next.js setup decided in [ADR-0001](./0001-nextjs-fullstack-single-app.md) — that ADR never evaluated linters specifically, ESLint just came bundled with the scaffold command. Partway through implementation, the user asked to replace it with [Ultracite](https://ultracite.dev), a zero-config preset built on [Biome](https://biomejs.dev), citing it directly rather than leaving the choice open. Biome is a single Rust-based tool that does both linting and formatting (no separate Prettier config to keep in sync), and Ultracite layers a stricter-than-default rule set on top of it, with framework-specific presets (`core`, `react`, `next`, `vitest`) matching this project's stack.

The project also has a `.claude/CLAUDE.md` (checked into the repo, loaded automatically as a project instruction) that documents Ultracite's conventions — `pnpm dlx ultracite fix`/`check`, and a detailed code-standards reference — meaning this tooling choice is now binding project policy, not just a preference.

## Decision

Removed `eslint`, `eslint-config-next`, and `eslint.config.mjs`. Installed `@biomejs/biome` and `ultracite` via `ultracite init --linter biome`, which also added Husky (a `pre-commit` git hook running `ultracite fix` on staged files) and a Claude Code `PostToolUse` hook (`.claude/settings.json`, running `pnpm run fix` after every `Write`/`Edit` tool call). `package.json` exposes both the Ultracite-native names (`check`/`fix`, matching `CLAUDE.md`'s quick reference) and `lint`/`lint:fix` aliases (matching this project's own earlier convention and `README.md`), pointing at the same underlying commands.

## Considered options

1. **Biome via Ultracite (chosen).** Single tool, single config file, actively-maintained opinionated preset, explicitly requested by the user.
2. **Keep ESLint + `eslint-config-next`.** Zero migration cost, but two tools (ESLint + a separate formatter) instead of one, and no stricter preset — this project had already accumulated real bugs (see Consequences) that the default `eslint-config-next` ruleset wouldn't have caught.
3. **Oxlint** (Ultracite's own `--linter oxlint` option, its *recommended* default). Faster than Biome, but not what was requested; Biome was named explicitly.

## Consequences

- **Caught real bugs, not just style issues**, in code written earlier in this project, before Ultracite existed in the repo:
  - `lib/tools/search-deal.ts` / `search-booking.ts` used non-null assertions (`phone!`) to route around TypeScript not narrowing a union across two independent optional parameters — restructured into `if`/`else if` so the narrowing is real, not asserted away.
  - Un-hoisted regex literals (`/\s+/` created fresh inside a function on every call) in `create-lead.ts` / `create-service-case.ts` — hoisted to module-level constants.
  - Inline arrow functions passed directly as JSX props in `app/page.tsx` (a new function identity every render) — extracted to named handlers.
  - Array-index React keys and `&&`-based conditional rendering (a leaked-falsy-value risk) in `app/page.tsx` — see [ADR-0008](./0008-ai-elements-pruned-component-set.md) for how the final UI rewrite handles this.
- **A `PostToolUse` hook now runs `pnpm run fix` after every file edit made by an AI coding agent in this repo.** This is a standing behavior of the *project*, not of any one session — it surprised this session the first time it silently rewrote an in-progress edit (see the `app/page.tsx` history in this session's transcript for a concrete example: a suppression comment and a `key` expression were altered mid-edit by the hook before the edit's author could verify them). Future work in this repo should expect files to be reformatted/autofixed immediately after every write, and should re-read a file before editing it again rather than trusting the last-known content.
- **Vendored/generated code needed an explicit carve-out.** Third-party or registry-installed code (`.agents/`, and later `components/ai-elements/` + `components/ui/` — see [ADR-0008](./0008-ai-elements-pruned-component-set.md)) is excluded from Biome's scope entirely (`biome.jsonc`'s `files.includes`), rather than linted and fixed like first-party code. Ultracite's stricter rules are calibrated for code this project's authors write, not for actively-maintained upstream library internals we don't want to diverge from.
- Formatting conventions changed project-wide in one pass (e.g. object keys alphabetized, import statements sorted, line-wrapping rules) — a large one-time diff, but a one-time cost, not an ongoing one.

## Related

[ADR-0001](./0001-nextjs-fullstack-single-app.md) (this replaces the ESLint default that scaffold decision came bundled with — 0001 itself never evaluated linters) · [ADR-0008](./0008-ai-elements-pruned-component-set.md) (the vendored-code lint exclusion this ADR establishes is what let that cleanup proceed cleanly) · `.claude/CLAUDE.md` (the binding code-standards reference) · `biome.jsonc`
