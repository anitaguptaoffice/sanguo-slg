import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pickScaleVariant, type ArtManifestV1 } from "@/engine/artManifest";
import { MAIN_CITY_SLOTS } from "@/engine/mainCitySlots";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestPath = join(repoRoot, "client/public/assets/art/v1/manifest.json");

function loadManifest(): ArtManifestV1 {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as ArtManifestV1;
}

describe("ART-WALL-004 engine slot ↔ manifest", () => {
  const wallSlot = MAIN_CITY_SLOTS.find((s) => s.slot_key === "wall");
  const wallMeta = loadManifest().assets.find((a) => a.id === "mc.building.wall.v1");

  it("wall slot wires mc.building.wall.v1", () => {
    expect(wallSlot?.asset_id).toBe("mc.building.wall.v1");
    expect(wallMeta?.slot_key).toBe("wall");
  });

  it("display size and anchor match layout contract", () => {
    expect(wallSlot?.display).toEqual({ x: 480, y: 200, w: 640, h: 120 });
    expect(wallSlot?.ground_anchor).toEqual({ x: 320, y: 120 });
    expect(wallMeta?.display_size).toEqual({ w: 640, h: 120 });
    expect(wallMeta?.anchor).toEqual({ x: 320, y: 120 });
  });

  it("DPR picks 1x/2x wall.png paths", () => {
    const variants = wallMeta?.variants ?? [];
    expect(pickScaleVariant(variants, 1)?.path).toBe("textures/1x/maincity/wall.png");
    expect(pickScaleVariant(variants, 2)?.path).toBe("textures/2x/maincity/wall.png");
  });

  it("z-order: wall behind hall and farm", () => {
    const hall = MAIN_CITY_SLOTS.find((s) => s.slot_key === "hall");
    const farm = MAIN_CITY_SLOTS.find((s) => s.slot_key === "farm");
    expect(wallSlot?.z).toBe(10);
    expect(hall?.z).toBeGreaterThan(wallSlot!.z);
    expect(farm?.z).toBeGreaterThan(wallSlot!.z);
  });

  it("hit box is 640×140 at slot origin", () => {
    expect(wallSlot?.hit).toEqual({ x: 480, y: 200, w: 640, h: 140 });
  });
});
