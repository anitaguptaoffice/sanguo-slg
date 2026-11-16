# CI PR path scope

Every `pull_request` does not need the full main-push matrix. Path filters cut
feedback time; `push` to `main` still runs the complete gate set.

## Rules

1. `push` on `main`: no path filter (full release gate).
2. `pull_request`: each workflow lists paths for its domain plus shared wiring:
   `go.mod`, `go.sum`, `cmd/server/**`, `internal/platform/gateway/**`.
3. `CI` workflow (`ci.yml`) uses in-workflow `dorny/paths-filter` to skip client
   or domestic PostgreSQL jobs when the diff cannot affect them.
4. Native registration browser workflows no longer use blanket `internal/**`;
   they run on account/gateway/client onboarding paths only.
5. **API return PostgreSQL** (`api-return-source-pg.yml`) does **not** run on
   ordinary PRs. It runs on `push` to `main`, `workflow_dispatch`, and PRs
   labeled **`ci:full`**. Large `internal/api` or integration work: add
   `ci:full` before expecting that workflow, or rely on post-merge main CI.

`workflow_dispatch` on `CI` forces the full client + Go matrix on the selected ref.

## Local gates (while developing)

Match remote scope to local cost; do not wait on GitHub for the full matrix
during tight iteration.

| Makefile target | When |
|---|---|
| `make test-fast` | Default while editing (no DB). |
| `make test-gate` | Before merge when you touched api/domestic/world or client build paths. |
| `make test-full` | Optional before merge when you changed `internal/api` heavily; mirrors API return PG locally. |

Keep feature PRs free of workflow-only diffs; land CI changes in a dedicated PR.

## Acceptance checks (CI PR)

After merging this policy, verify once on GitHub:

1. **Military-only** draft PR: `CI` go job + `March return PostgreSQL` only; no
   client job, no API return PG, no explicit-registration native.
2. **Client-only** draft PR: `client-build-test`; no domain PG workflows.
3. **`ci:full` label** on a PR that changes `internal/api/**`: API return PG
   workflow runs on `synchronize`.
4. **Merge to main**: push run lists the full workflow set (query by `head_sha`,
   event `push`, not PR-only views).

Create label `ci:full` in the repo if it does not exist (Settings → Labels).