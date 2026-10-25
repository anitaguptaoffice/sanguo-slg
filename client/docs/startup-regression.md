# CLIENT-REPAIR-002 startup regression

Baseline: `e767d1b12efed49d826badd32d93cf20b0243f98`.

The production entry could not load: wave49 imported wave45-era constants from
wave43, which does not export them. Importing through wave47 retains the existing
constant values and resolves the complete inherited set. Wave55 also re-exported
an identifier without importing its wave53 binding.

`src/engine/clientModuleGraph.test.ts` bundles the real entry without emitting
files and evaluates the latest manifest chain. This catches missing named exports
and unbound re-exports that isolated module tests may miss.

Run `npx vitest run src/engine/clientModuleGraph.test.ts` and `npm run build`.
A successful module-graph test is not full TypeScript, browser, or RPC acceptance.

## Browser and tool configuration

The browser TypeScript project includes DOM.Iterable and excludes Node-only Vite
configuration. The separate tsconfig.node.json still checks both Vite and Vitest
configuration; npm run build runs both checks before bundling. This prevents Node
setTimeout overloads from leaking into window timer consumers without weakening
strict checking. Existing decoder result types, HTML host queries, optional-value
guards, and stale property/import names are aligned with the actual code paths.
The report-filter fixture uses local calendar timestamps, matching the production
"today" filter in every timezone.
