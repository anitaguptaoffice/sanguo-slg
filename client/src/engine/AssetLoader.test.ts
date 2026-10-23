import { describe, expect, it } from "vitest";
import { joinArtBaseUrl, pickScaleVariant } from "@/engine/artManifest";
import { resolveArtPackUrl } from "@/engine/AssetLoader";

describe("pickScaleVariant", () => {
  const variants = [
    { scale: 1 as const, path: "textures/1x/a.png" },
    { scale: 2 as const, path: "textures/2x/a.png" },
  ];

  it("picks 2x at DPR >= 1.5", () => {
    expect(pickScaleVariant(variants, 2)?.scale).toBe(2);
    expect(pickScaleVariant(variants, 1.5)?.scale).toBe(2);
  });

  it("picks 1x at DPR 1", () => {
    expect(pickScaleVariant(variants, 1)?.path).toContain("1x");
  });
});

describe("resolveArtPackUrl", () => {
  it("joins base and relative path", () => {
    expect(resolveArtPackUrl("textures/1x/foo.png")).toBe("/assets/art/v1/textures/1x/foo.png");
  });
});

describe("joinArtBaseUrl", () => {
  it("prepends vite base for subpath deploy", () => {
    expect(joinArtBaseUrl("/assets/art/v1/", "/app/", "manifest.json")).toBe("/app/assets/art/v1/manifest.json");
  });
});
