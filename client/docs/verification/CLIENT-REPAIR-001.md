# CLIENT-REPAIR-001 — narrow hero target access

Scope: existing captive / persuade / coming-hero controls only. No asset, schema,
server, gameplay, new-wave, or payment changes. Requires CLIENT-REPAIR-002 startup
and stylesheet repairs; integrated source tested: `e5aff5e` (base `4ae4bff`).

Native keyboard-accessible disclosures retain selected identity while collapsed.
A collapsed section's action opens its preview without sending an RPC. Selection
rows support Enter / Space and expose `aria-pressed`. Late previews from an older
selection cannot overwrite the current target or enable a mismatched confirmation.

Verification (2026-10-25):
- `npm run build`: PASS (TypeScript browser/node configs and Vite).
- `npx vitest run src/ui/HeroMailPanels.test.ts src/ui/heroCaptureAccess.test.ts src/engine/indexStylesheetSyntax.test.ts`: 90/90 PASS.
- `PLAYWRIGHT_BROWSERS_PATH=/tmp/sanguo-playwright node scripts/verify-hero-capture-access.mjs /tmp/hero-capture-access`: PASS at 1280×720 and 1600×900, DPR 1.
- Actual client DOM/CSS: keyboard second-target selection, correct request targets
  56 / 1002 / 66, error recovery, native reopen, bust/right-name and all eight
  existing section buttons in clip, zero page errors. No screenshot-only hiding.
- Two stale-preview regression tests fail on original `HeroMailPanels.ts` and pass
  after repair. Empty/error, repeated clicks and reopen are covered by unit tests.

Boundary: browser uses mock gateway plus explicit GatewayClient method fixtures;
it is client interaction acceptance, **not real PostgreSQL gateway acceptance**.
The evidence script writes source SHA, per-viewport probes, requests and screenshots.
Local reviewed evidence: `/tmp/sanguo-client-repair/integrated-e5aff5e/`.
