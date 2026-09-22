---
status: accepted
---

# Split `zoho/client.ts` by responsibility; de-duplicate tool boilerplate

## Context

`lib/zoho/client.ts` had grown to 216 lines holding five unrelated concerns in
one file: env-var access, two error classes, OAuth token caching/refresh, the
`ky` instance + request wrapper, and the public `zoho`/`criteria` API.

Separately, the six Zoho-backed tools (`create-lead`, `create-service-case`,
`search-booking`, `search-deal`, `search-contact-by-phone`,
`update-deal-follow-up`) each hand-rolled the same
`catch (error) { if (error instanceof ZohoApiError) return {error, success:
false}; throw error; }` block. Two of them additionally duplicated a
`WHITESPACE_RE`/full-name-splitting block. Zoho module names (`"Leads"`,
`"Deals"`, `"Contacts"`, `"Cases"`) and the booking stage string were scattered
as inline literals with no single source of truth.

`lib/session/`, `lib/tools/index.ts`, `lib/system-prompt.ts`,
`lib/vehicle-catalog.ts`, and `lib/utils.ts` were already single-responsibility
and well-named, so they were left untouched. `lib/utils.ts` in particular is
pinned by `components.json`'s `"utils": "@/lib/utils"` alias (the shadcn CLI
writes generated component imports against that exact path) and is a hard
constraint, not a choice.

## Decision

### 1 — Split `lib/zoho/client.ts` into responsibility-scoped files, using a generic naming vocabulary

| File | Responsibility |
|---|---|
| `types.ts` | `ZohoRecord`, `ZohoErrorEnvelope`, `TokenCache` |
| `constants.ts` | `ZOHO_MODULES`, `DEAL_STAGES`, `TOKEN_REFRESH_MARGIN_MS` |
| `errors.ts` | `ZohoAuthError`, `ZohoApiError` |
| `helpers.ts` | `requiredEnv()`, `getAccessToken()` (token cache + OAuth refresh) |
| `http.ts` | `createZohoKyInstance()` + `zohoRequest()` |
| `client.ts` | thin public facade — `zoho` object, `criteria` |

`errors.ts`/`types.ts`/`constants.ts`/`helpers.ts` follow a generic,
conventional vocabulary (as opposed to the initially-considered `env.ts`,
`modules.ts`, `token.ts`) so the pattern reads the same way any reader
already expects from other codebases, rather than inventing a new noun per
concern.

`client.ts` does **not** re-export `ZohoApiError`, `ZohoAuthError`, or
`ZohoRecord`. Biome's `noExportedImports` rule requires re-exports to use
`export { X } from "./module"`, but Biome's `noBarrelFile` rule then flags
that exact syntax as a barrel-file pattern — the two rules are mutually
exclusive for a file that both re-exports and adds its own exports. Since a
grep confirmed `ZohoAuthError` and `ZohoRecord` have zero consumers outside
`lib/zoho/`, and `ZohoApiError` is the only symbol tool files need, the
facade was kept clean by having callers that need `ZohoApiError` import it
directly from `@/lib/zoho/errors`.

### 2 — Add `lib/tools/shared/` with two extracted helpers

- `handle-zoho-error.ts` — `withZohoErrorHandling(fn)`, wrapping the
  try/catch-`ZohoApiError` pattern duplicated across all six tools
- `split-full-name.ts` — `splitFullName(fullName)`, wrapping the
  `WHITESPACE_RE` split logic duplicated in `create-lead.ts` and
  `create-service-case.ts`

### 3 — Update the six Zoho-backed tool files

Each now imports `withZohoErrorHandling` from `lib/tools/shared/`,
`ZOHO_MODULES`/`DEAL_STAGES` from `lib/zoho/constants.ts` in place of string
literals, and (where applicable) `splitFullName` from `lib/tools/shared/`.

## Considered options

| Concern | Chosen | Why not the alternative |
|---|---|---|
| File naming inside `lib/zoho/` | Generic vocabulary (`types.ts`, `constants.ts`, `helpers.ts`, `errors.ts`) | Domain-specific one-off names (`env.ts`, `modules.ts`, `token.ts`) are harder to predict without opening the file |
| `client.ts` re-exporting error classes | No re-export; tools import `ZohoApiError` from `@/lib/zoho/errors` directly | Biome's `noExportedImports` and `noBarrelFile` rules conflict on any `export { X } from` in a file with its own additional exports — there is no re-export form that satisfies both |
| Error-boilerplate dedup | Shared `withZohoErrorHandling` wrapper | A base-class/decorator pattern is more machinery than 6 call sites justify |
| `system-prompt.ts` / `vehicle-catalog.ts` folder placement | Left flat at `lib/` root | Each is already single-responsibility with no internal duplication — nesting them would be reorganization without a problem to fix |

## Consequences

- `client.ts` shrank from 216 lines to 55; each split-out file is under 60
  lines with one job.
- `zoho` and `criteria` import paths (`@/lib/zoho/client`) are unchanged for
  all consumers. `ZohoApiError`'s import path changed from
  `@/lib/zoho/client` to `@/lib/zoho/errors` in the six tool files and in
  `lib/tools/shared/handle-zoho-error.ts` — the only import churn from this
  refactor.
- Each of the six tool files lost 5–7 lines of duplicated catch boilerplate;
  `create-lead.ts`/`create-service-case.ts` additionally lost the duplicated
  name-split block.
- `ZOHO_MODULES`/`DEAL_STAGES` are now the single source of truth for Zoho
  module and stage string literals — a typo'd module name now fails at the
  constant's declaration site instead of silently reaching the API with a
  bad value scattered in some tool file.
- No behavior change: tool `execute` return shapes, the system prompt, and
  `app/api/chat/route.ts` are untouched. Verified via `pnpm dlx ultracite
  check lib/` (clean), `tsc --noEmit` (clean), `pnpm test` (14/14 passing),
  and `pnpm run build` (succeeds, `/api/chat` still resolves as a dynamic
  route).

## Related

[ADR-0010](./0010-session-store-slot-state-ky-http-client.md) — introduced
`ky` and the original single-file `zoho/client.ts` this ADR splits ·
[ADR-0005](./0005-booking-as-deal-stage.md) — booking-as-Deal-stage modeling
that `DEAL_STAGES.BOOKING` now formalizes as a constant
