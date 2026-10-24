import { describe, expect, it } from "vitest";
import {
  applyMarchTargetAndRemember,
  readMarchTargetFromForm,
  resolveMarchTargetTruth,
  syncMarchTargetSessionFromForm,
} from "@/net/marchTargetMemory";
import {
  DEFAULT_MINIMAP_VIEW,
  MINIMAP_LAYOUT_RECT,
  clampWorldMapCoord,
  computeMinimapWorldBounds,
  minimapLayoutToWorld,
} from "@/ui/worldMinimap";

describe("minimapMarchTargetCoord", () => {
  function mockStorage(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
      removeItem: (k) => map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  }

  it("blank minimap pick writeback clamps world grid into form and session", () => {
    const storage = mockStorage();
    const root = document.createElement("div");
    root.innerHTML = `<input data-field="to-x" value="0" /><input data-field="to-y" value="0" />`;
    const bounds = computeMinimapWorldBounds(60, 60, [], null);
    const layout = { x: MINIMAP_LAYOUT_RECT.x + 80, y: MINIMAP_LAYOUT_RECT.y + 90 };
    const world = minimapLayoutToWorld(
      layout.x,
      layout.y,
      bounds,
      MINIMAP_LAYOUT_RECT,
      DEFAULT_MINIMAP_VIEW,
    );
    expect(world).not.toBeNull();
    const wx = clampWorldMapCoord(world!.wx);
    const wy = clampWorldMapCoord(world!.wy);
    expect(applyMarchTargetAndRemember(root, wx, wy, { source: "minimap", storage })).toBe(true);
    expect(readMarchTargetFromForm(root)).toEqual({ x: wx, y: wy });
    expect(resolveMarchTargetTruth(root, storage)).toEqual({ x: wx, y: wy });
  });

  it("manual form edit syncs session for resolveMarchTargetTruth", () => {
    const storage = mockStorage();
    const root = document.createElement("div");
    root.innerHTML = `<input data-field="to-x" value="1" /><input data-field="to-y" value="2" />`;
    const synced = syncMarchTargetSessionFromForm(root, storage);
    expect(synced).toEqual({ x: 1, y: 2 });
    expect(resolveMarchTargetTruth(root, storage)).toEqual({ x: 1, y: 2 });
  });
});
