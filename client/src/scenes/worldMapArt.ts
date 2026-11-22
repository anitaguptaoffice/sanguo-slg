/** Stable world art ids registered in assets/art/v1/manifest.json (R1-S6). */
const TERRAIN_ASSET: Record<number, string> = {
  0: "world.tile.city_ground.v1",
  1: "world.tile.plain.v1",
  2: "world.tile.desert.v1",
  3: "world.tile.forest.v1",
  4: "world.tile.grass.v1",
  5: "world.tile.mountain.v1",
  6: "world.tile.lake.v1",
  7: "world.tile.swamp.v1",
};

const RESOURCE_ASSET: Record<number, string> = {
  2: "world.obj.resource.quarry.v1",
  3: "world.obj.resource.lumber.v1",
  5: "world.obj.resource.iron.v1",
  7: "world.obj.resource.lumber.v1",
};

export const WORLD_MARCH_TROOP_ASSET_ID = "world.march.troop.v1";
export const WORLD_MARCH_RETURNING_ASSET_ID = "world.march.returning.v1";

/** Terrain tile texture; unknown terrain falls back to plain. */
export function worldTileAssetId(terrain: number): string {
  return TERRAIN_ASSET[terrain] ?? TERRAIN_ASSET[1];
}

/** City sprite by level: 1-3 village, 4-7 town, 8-10 capital. */
export function worldCityAssetId(level: number): string {
  if (level >= 8) return "world.obj.city.capital.v1";
  if (level >= 4) return "world.obj.city.town.v1";
  return "world.obj.city.village.v1";
}

/** Landmark sprite for a special city type: county/commandery/state/capital. */
export function worldSpecialCityAssetId(cityType: number): string {
  if (cityType >= 4) return worldCityAssetId(8);
  if (cityType >= 2) return worldCityAssetId(6);
  return worldCityAssetId(1);
}

/** Resource landmark for wild tiles; undefined keeps only the tile texture. */
export function worldResourceAssetId(terrain: number): string | undefined {
  if (terrain === 1 || terrain === 4 || terrain === 6) return "world.obj.resource.farm.v1";
  return RESOURCE_ASSET[terrain];
}

/** Ownership flag; ally flags need guild data that R1 does not expose yet. */
export function worldFlagAssetId(ownerPlayerId: number, viewerPlayerId: number): string {
  if (ownerPlayerId <= 0) return "world.flag.neutral.v1";
  if (viewerPlayerId > 0 && ownerPlayerId === viewerPlayerId) return "world.flag.self.v1";
  return "world.flag.enemy.v1";
}

export function worldMarchAssetId(phase: number): string {
  return phase === 4 ? WORLD_MARCH_RETURNING_ASSET_ID : WORLD_MARCH_TROOP_ASSET_ID;
}
