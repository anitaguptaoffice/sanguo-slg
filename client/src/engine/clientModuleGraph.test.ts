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
});
