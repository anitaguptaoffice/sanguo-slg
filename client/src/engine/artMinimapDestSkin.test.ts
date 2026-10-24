import { describe, expect, it } from "vitest";
import {
  MINIMAP_DEST_MARKER_ASSET_ID,
  resolveMinimapDestMarkerDrawMode,
} from "@/engine/artMinimapDestSkin";

describe("artMinimapDestSkin", () => {
  it("uses canvas when data-art-skin=off on ancestor", () => {
    const root = document.createElement("div");
    root.dataset.artSkin = "off";
    const assets = { getImageForAsset: () => ({ img: new Image() }) };
    expect(resolveMinimapDestMarkerDrawMode(root, assets as never)).toBe("canvas");
  });

  it("uses canvas when dest asset missing", () => {
    const root = document.createElement("div");
    const assets = { getImageForAsset: () => null };
    expect(resolveMinimapDestMarkerDrawMode(root, assets as never)).toBe("canvas");
  });

  it("uses sprite when asset registered and skin on", () => {
    const root = document.createElement("div");
    const assets = {
      getImageForAsset: (id: string) =>
        id === MINIMAP_DEST_MARKER_ASSET_ID ? { img: new Image() } : null,
    };
    expect(resolveMinimapDestMarkerDrawMode(root, assets as never)).toBe("sprite");
  });
});
