import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ArtManifestV1 } from "@/engine/artManifest";
import { worldSpecialCityLandmarkAssetId } from "./worldMapArt";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const manifest = JSON.parse(
  readFileSync(join(repoRoot, "client/public/assets/art/v1/manifest.json"), "utf8"),
) as ArtManifestV1;

describe("special city landmark assets", () => {
  it("ships nine unique, existing 1x/2x landmarks", () => {
    const ids = Array.from({ length: 9 }, (_, i) => worldSpecialCityLandmarkAssetId(i + 1, 1));
    expect(new Set(ids).size).toBe(9);
    const paths = new Set<string>();
    for (const id of ids) {
      const asset = manifest.assets.find((a) => a.id === id);
      expect(asset?.kind).toBe("sprite");
      expect(asset?.variants).toHaveLength(2);
      for (const variant of asset?.variants ?? []) {
        expect(paths.has(variant.path)).toBe(false);
        paths.add(variant.path);
        expect(existsSync(join(repoRoot, "client/public/assets/art/v1", variant.path))).toBe(true);
      }
    }
  });
});
