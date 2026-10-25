// @vitest-environment node
import { describe, expect, it } from "vitest";
import { build } from "vite";
import path from "node:path";

/** Test the production entry graph, not only individually mocked modules. */
describe("client startup module graph", () => {
  it("bundles the real entry with all named exports resolved", async () => {
    const output = await build({
      root: path.resolve(__dirname, "../.."),
      logLevel: "silent",
      build: { write: false, minify: false },
    });
    expect(output).toHaveProperty("output");
  }, 30_000);

  it("evaluates the latest manifest chain without unbound re-exports", async () => {
    const manifest = await import("./wave59WorldIntelBattleReportMailShopRankNarrowManifest");
    expect(Object.keys(manifest).length).toBeGreaterThan(0);
    const inherited = await import("./wave55WorldIntelBattleReportMailShopRankNarrowManifest");
    expect(inherited.INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS)
      .toBe("intel-march-prefill-residual-deepest-deepest-deeper-line");
  }, 30_000);
});
