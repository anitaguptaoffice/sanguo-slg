import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ArtManifestV1 } from "@/engine/artManifest";
import {
  ART_UI_PANEL_STATE_009_ASSET_IDS,
  PANEL_STATE_ASSET_BY_KIND,
  PANEL_STATE_DISPLAY_H,
  PANEL_STATE_DISPLAY_W,
  resolvePanelStateAssetId,
} from "@/engine/artPanelStateSkin";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestPath = join(repoRoot, "client/public/assets/art/v1/manifest.json");

function loadManifest(): ArtManifestV1 {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ArtManifestV1;
}

describe("ART-UI-PANEL-STATE-009 manifest mount", () => {
  it("lists three nine_slice asset ids (51 total manifest entries)", () => {
    const manifest = loadManifest();
    expect(ART_UI_PANEL_STATE_009_ASSET_IDS).toHaveLength(3);
    expect(manifest.assets).toHaveLength(51);
    for (const id of ART_UI_PANEL_STATE_009_ASSET_IDS) {
      const meta = manifest.assets.find((a) => a.id === id);
      expect(meta).toBeTruthy();
      expect(meta?.kind).toBe("nine_slice");
      expect(meta?.display_size).toEqual({ w: PANEL_STATE_DISPLAY_W, h: PANEL_STATE_DISPLAY_H });
      expect(meta?.nine_slice).toEqual({ left: 16, top: 16, right: 16, bottom: 16 });
      expect(meta?.variants).toHaveLength(2);
    }
  });

  it("maps panel state kinds to frozen asset ids", () => {
    expect(PANEL_STATE_ASSET_BY_KIND.loading).toBe("ui.panel.loading.v1");
    expect(PANEL_STATE_ASSET_BY_KIND.empty).toBe("ui.panel.empty.v1");
    expect(PANEL_STATE_ASSET_BY_KIND.error).toBe("ui.panel.error.v1");
    expect(resolvePanelStateAssetId("empty")).toBe("ui.panel.empty.v1");
  });
});
