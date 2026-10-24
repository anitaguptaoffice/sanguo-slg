import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ArtManifestV1 } from "@/engine/artManifest";
import {
  ART_WORLD_MINIMAP_010_ASSET_IDS,
  MINIMAP_DEST_ANCHOR_X,
  MINIMAP_DEST_ANCHOR_Y,
  MINIMAP_DEST_ASSET_ID,
  MINIMAP_DEST_DISPLAY_SIZE,
  MINIMAP_LEGEND_ASSET_ID,
  MINIMAP_LEGEND_DISPLAY_H,
  MINIMAP_LEGEND_DISPLAY_W,
  resolveMinimapDestAssetId,
  resolveMinimapLegendAssetId,
} from "@/engine/artWorldMinimapSkin";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestPath = join(repoRoot, "client/public/assets/art/v1/manifest.json");

function loadManifest(): ArtManifestV1 {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ArtManifestV1;
}

describe("ART-WORLD-MINIMAP-010 manifest mount", () => {
  it("lists two sprite asset ids (51 total manifest entries)", () => {
    const manifest = loadManifest();
    expect(ART_WORLD_MINIMAP_010_ASSET_IDS).toHaveLength(2);
    expect(manifest.assets).toHaveLength(51);
    for (const id of ART_WORLD_MINIMAP_010_ASSET_IDS) {
      const meta = manifest.assets.find((a) => a.id === id);
      expect(meta).toBeTruthy();
      expect(meta?.kind).toBe("sprite");
      expect(meta?.variants).toHaveLength(2);
    }
  });

  it("freezes dest marker and legend chrome contracts", () => {
    const manifest = loadManifest();
    const dest = manifest.assets.find((a) => a.id === MINIMAP_DEST_ASSET_ID);
    const legend = manifest.assets.find((a) => a.id === MINIMAP_LEGEND_ASSET_ID);
    expect(dest?.display_size).toEqual({ w: MINIMAP_DEST_DISPLAY_SIZE, h: MINIMAP_DEST_DISPLAY_SIZE });
    expect(dest?.anchor).toEqual({ x: MINIMAP_DEST_ANCHOR_X, y: MINIMAP_DEST_ANCHOR_Y });
    expect(legend?.display_size).toEqual({ w: MINIMAP_LEGEND_DISPLAY_W, h: MINIMAP_LEGEND_DISPLAY_H });
    expect(resolveMinimapDestAssetId()).toBe("ui.minimap.dest.v1");
    expect(resolveMinimapLegendAssetId()).toBe("ui.minimap.legend.v1");
  });
});
