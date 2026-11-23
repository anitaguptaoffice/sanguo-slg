// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { ArtManifestV1 } from "./artManifest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../public/assets/art/v1");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as ArtManifestV1;

const TILES = ["plain", "desert", "forest", "grass", "mountain", "lake", "swamp", "city_ground"];
const CITIES = ["village", "town", "capital"];
const RESOURCES = ["farm", "lumber", "quarry", "iron"];
const FLAGS = ["self", "ally", "neutral", "enemy"];
const MARCHES = ["troop", "returning"];
const SPECIAL = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const WORLD_IDS = [
  ...TILES.map((code) => `world.tile.${code}.v1`),
  ...CITIES.map((code) => `world.obj.city.${code}.v1`),
  "world.obj.huangjin.v1",
  ...RESOURCES.map((code) => `world.obj.resource.${code}.v1`),
  ...FLAGS.map((code) => `world.flag.${code}.v1`),
  ...MARCHES.map((code) => `world.march.${code}.v1`),
  ...SPECIAL.map((id) => `world.obj.special.${id}.v1`),
];

function pngSize(file: string): { w: number; h: number; colorType: number } {
  const buffer = readFileSync(file);
  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return { w: buffer.readUInt32BE(16), h: buffer.readUInt32BE(20), colorType: buffer[25] };
}

describe("R1-S6 world art pack", () => {
  it("registers exactly the 31 world assets once", () => {
    expect(new Set(WORLD_IDS).size).toBe(31);
    const registered = manifest.assets.filter((a) => a.id.startsWith("world."));
    expect(registered.map((a) => a.id).sort()).toEqual([...WORLD_IDS].sort());
    expect(manifest.assets.filter((a) => a.id === "world.tile.plain.v1")).toHaveLength(1);
  });

  it("ships both scales as RGBA PNGs with manifest dimensions", () => {
    for (const id of WORLD_IDS) {
      const asset = manifest.assets.find((a) => a.id === id);
      expect(asset, id).toBeTruthy();
      expect(asset?.kind).toBe("sprite");
      expect(asset?.variants?.map((v) => v.scale)).toEqual([1, 2]);
      for (const variant of asset!.variants!) {
        const file = join(root, variant.path);
        expect(existsSync(file), variant.path).toBe(true);
        const { w, h, colorType } = pngSize(file);
        expect(w).toBe(asset!.display_size.w * variant.scale);
        expect(h).toBe(asset!.display_size.h * variant.scale);
        expect(colorType).toBe(6);
      }
    }
  });

  it("keeps tiles at the isometric 2:1 diamond and objects anchored at the base", () => {
    for (const code of TILES) {
      const asset = manifest.assets.find((a) => a.id === `world.tile.${code}.v1`);
      expect(asset?.display_size).toEqual({ w: 128, h: 64 });
      expect(asset?.anchor).toEqual({ x: 64, y: 32 });
    }
    for (const id of ["world.obj.city.village.v1", "world.obj.city.town.v1", "world.obj.city.capital.v1"]) {
      expect(manifest.assets.find((a) => a.id === id)?.anchor.y).toBe(152);
    }
    expect(manifest.assets.find((a) => a.id === "world.obj.huangjin.v1")?.anchor).toEqual({ x: 80, y: 136 });
  });
});
