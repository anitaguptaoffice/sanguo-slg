import { describe, expect, it } from "vitest";
import {
  WORLD_MARCH_RETURNING_ASSET_ID,
  WORLD_MARCH_TROOP_ASSET_ID,
  worldCityAssetId,
  worldFlagAssetId,
  worldMarchAssetId,
  worldResourceAssetId,
  worldTileAssetId,
} from "./worldMapArt";

describe("world map art mapping", () => {
  it("maps the eight terrains to stable tile ids", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(worldTileAssetId)).toEqual([
      "world.tile.city_ground.v1",
      "world.tile.plain.v1",
      "world.tile.desert.v1",
      "world.tile.forest.v1",
      "world.tile.grass.v1",
      "world.tile.mountain.v1",
      "world.tile.lake.v1",
      "world.tile.swamp.v1",
    ]);
    expect(worldTileAssetId(99)).toBe("world.tile.plain.v1");
  });

  it("picks city tiers by level and flags by ownership", () => {
    expect(worldCityAssetId(1)).toBe("world.obj.city.village.v1");
    expect(worldCityAssetId(3)).toBe("world.obj.city.village.v1");
    expect(worldCityAssetId(4)).toBe("world.obj.city.town.v1");
    expect(worldCityAssetId(7)).toBe("world.obj.city.town.v1");
    expect(worldCityAssetId(8)).toBe("world.obj.city.capital.v1");
    expect(worldFlagAssetId(0, 7)).toBe("world.flag.neutral.v1");
    expect(worldFlagAssetId(7, 7)).toBe("world.flag.self.v1");
    expect(worldFlagAssetId(8, 7)).toBe("world.flag.enemy.v1");
  });

  it("keeps resource landmarks and march markers deterministic", () => {
    expect(worldResourceAssetId(1)).toBe("world.obj.resource.farm.v1");
    expect(worldResourceAssetId(3)).toBe("world.obj.resource.lumber.v1");
    expect(worldResourceAssetId(5)).toBe("world.obj.resource.iron.v1");
    expect(worldResourceAssetId(2)).toBe("world.obj.resource.quarry.v1");
    expect(worldResourceAssetId(0)).toBeUndefined();
    expect(worldMarchAssetId(2)).toBe(WORLD_MARCH_TROOP_ASSET_ID);
    expect(worldMarchAssetId(4)).toBe(WORLD_MARCH_RETURNING_ASSET_ID);
  });
});
