import { describe, expect, it } from "vitest";
import {
  clampCamera,
  fetchRadius,
  projectTile,
  terrainFill,
  terrainLabel,
  tileAtScreen,
  visibleTileBounds,
  zoomAround,
  type Camera,
} from "./worldMapMath";

const size = { width: 1280, height: 720 };
const camera: Camera = { centerX: 60, centerY: 60, zoom: 1 };

describe("world map projection", () => {
  it("projects the camera centre to the screen centre", () => {
    expect(projectTile(60, 60, camera, size)).toEqual({ x: 640, y: 360 });
  });

  it("inverts any screen point back to its tile", () => {
    for (const [x, y] of [[60, 60], [61, 60], [60, 61], [45, 77], [0, 0], [499, 499]]) {
      const point = projectTile(x, y, camera, size);
      expect(tileAtScreen(point, camera, size)).toEqual({ x, y });
    }
  });

  it("keeps the tile under the cursor while zooming", () => {
    const point = { x: 900, y: 300 };
    const before = tileAtScreen(point, camera, size);
    const zoomed = zoomAround(camera, point, size, 2);
    // Rounding at the diamond boundary may pick a neighbour; the projected
    // point must stay inside the same tile centre within half a tile.
    const after = projectTile(before.x, before.y, zoomed, size);
    expect(Math.abs(after.x - point.x)).toBeLessThan(32);
    expect(Math.abs(after.y - point.y)).toBeLessThan(16);
  });

  it("clamps the camera to the map and zoom range", () => {
    const clamped = clampCamera({ centerX: -20, centerY: 900, zoom: 9 }, 500);
    expect(clamped).toEqual({ centerX: 0, centerY: 499, zoom: 2 });
    expect(clampCamera({ centerX: 10, centerY: 10, zoom: 0.1 }, 500).zoom).toBe(1);
  });

  it("bounds the visible rectangle and fetch radius", () => {
    const bounds = visibleTileBounds(camera, size, 0);
    expect(bounds.minX).toBeLessThan(camera.centerX);
    expect(bounds.maxX).toBeGreaterThan(camera.centerX);
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(10);
    const radius = fetchRadius(camera, size);
    expect(radius.x).toBeGreaterThan(0);
    expect(radius.y).toBeGreaterThan(0);
  });

  it("labels every terrain id", () => {
    expect(terrainLabel(1)).toBe("平地");
    expect(terrainLabel(7)).toBe("沼泽");
    expect(terrainLabel(99)).toBe("未知");
    expect(terrainFill(3)).toMatch(/^#/);
    expect(terrainFill(99)).toBe("#7a7a7a");
  });
});
