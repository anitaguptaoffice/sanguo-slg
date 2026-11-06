# QA-BAG-ICON-BROWSER-001

Issue: https://github.com/anitaguptaoffice/sanguo-slg/issues/2085

## Why a standard runner
Local Chromium failed before navigation at process_singleton_posix.cc:297:
`socket() failed: Operation not permitted (1)`. One approved elevated launch
also failed. No local browser retry or weakened sandbox is used by this card.
The new job uses a standard GitHub-hosted Ubuntu 22.04 runner, not the restricted
local execution environment. It keeps Chromium's sandbox enabled and makes no
host security changes, privileged container, custom seccomp or no-sandbox flags.

Playwright 1.49.1 and playwright-core 1.49.1 are pinned by the target npm lockfile,
with integrity hashes and registry.npmjs.org URLs. Browser installation uses
that official package's `playwright install --with-deps chromium` command.
Official guidance: https://playwright.dev/docs/ci-intro and https://playwright.dev/docs/ci
No secrets or production services are used; job permissions are contents:read.

## Exact test composition
- Component/CSS: PR #1973 head ed32cae751646723ac242849f16a9acb034c8eb4.
- Art fixture: PR #1968 head 91f3080ac50cc1abb961dac9f50e99c9266a2b6e.
- Harness: this QA PR's checked-out merge ref; artifact names identify github.sha.
- A local ContentPanels mock replaces only the main module through a browser route.
- Candidate PNGs are served through local test routes, not a production manifest.
- 1280x720 and 1600x900, each at DPR1/1.5/2, real Chromium and real PNGs.
- Mouse category switches, Enter-key refresh, keyboard selector, immediate skin
  off/on, off-state redraw and restored images, decorative alt semantics,
  unknown-ID text fallback and 20px logical icon bounds are checked.
- Turning skin back on after an off-state redraw intentionally needs a refresh;
  the harness asserts this existing behavior rather than promising immediate remount.
- Four screenshots per viewport/DPR case and JSON capture success or failure.

## Vite diagnosis and limits
The earlier fixture used a shared node_modules symlink and killed Vite immediately
when Chromium failed. A separate local Vite startup/module request succeeded;
the prior dependency scan errors therefore have no proven application regression.
This job uses clean npm ci, isolated dependencies, a readiness assertion and
separate stdout/stderr logs, then awaits server shutdown after browser completion.

Passing this fixture is not backend, deployment, natural gameplay or complete
main-city scene acceptance. It is the exact #1973 optional icon component with
candidate assets. A screenshot review is required in addition to assertions.
No production-art delivery is implied, and #1973 remains held until its applicable
requirements and independent evidence review are satisfied. No historical hold
PR is merged by this job. Results are not claimed before the job actually runs.
