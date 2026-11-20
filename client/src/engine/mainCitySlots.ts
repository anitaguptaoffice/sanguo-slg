/** Layout-frame coordinates (1600×900); y already includes HUD — do not add 56 again. */
export type MainCitySlotDef = {
  slot_key: string;
  label: string;
  display: { x: number; y: number; w: number; h: number };
  ground_anchor: { x: number; y: number };
  z: number;
  hit: { x: number; y: number; w: number; h: number };
  asset_id?: string;
};

export type CitySceneMode = "inner" | "outer";

const slot = (
  slot_key: string,
  label: string,
  x: number,
  y: number,
  z: number,
  asset_id?: string,
): MainCitySlotDef => ({
  slot_key,
  label,
  display: { x, y, w: 200, h: 160 },
  ground_anchor: { x: 100, y: 160 },
  z,
  hit: { x: x - 10, y: y - 10, w: 220, h: 180 },
  ...(asset_id ? { asset_id } : {}),
});

/** R2-S1 内城：16 种建筑。 */
export const INNER_CITY_SLOTS: MainCitySlotDef[] = [
  {
    slot_key: "wall",
    label: "城墙",
    display: { x: 480, y: 200, w: 640, h: 120 },
    ground_anchor: { x: 320, y: 120 },
    z: 10,
    hit: { x: 480, y: 200, w: 640, h: 140 },
    asset_id: "mc.building.wall.v1",
  },
  slot("inn", "客栈", 150, 120, 20),
  slot("academy", "书院", 360, 120, 20),
  {
    slot_key: "hall",
    label: "官府",
    display: { x: 640, y: 110, w: 320, h: 240 },
    ground_anchor: { x: 160, y: 240 },
    z: 30,
    hit: { x: 630, y: 100, w: 340, h: 260 },
    asset_id: "mc.building.hall.v1",
  },
  slot("relay", "驿站", 130, 330, 22),
  slot("workshop", "工匠作坊", 340, 330, 22),
  slot("house", "民房", 550, 330, 22),
  slot("recruit_hall", "招贤馆", 760, 330, 22),
  slot("market", "市场", 1050, 330, 22),
  slot("stable", "马厩", 1240, 330, 22),
  slot("barracks", "军营", 150, 540, 25),
  slot("drill_ground", "校场", 360, 540, 25),
  slot("warehouse", "仓库", 570, 540, 25),
  slot("smithy", "铁匠铺", 780, 540, 25),
  slot("beacon", "烽火台", 1000, 540, 25),
  slot("diplomacy", "鸿胪寺", 1220, 540, 25),
];

/** R2-S1 外城：随官府等级扩展的四块资源田。 */
export const OUTER_CITY_SLOTS: MainCitySlotDef[] = [
  slot("farm", "农田", 220, 300, 20, "mc.building.farm.v1"),
  slot("lumber", "伐木场", 460, 300, 22),
  slot("quarry", "采石场", 940, 300, 22),
  slot("iron", "铁矿", 1180, 300, 20),
];

/** All slots for overlay and legacy consumers; the scene filters by mode. */
export const MAIN_CITY_SLOTS: MainCitySlotDef[] = [...INNER_CITY_SLOTS, ...OUTER_CITY_SLOTS];

export function citySlotsForMode(mode: CitySceneMode): MainCitySlotDef[] {
  return mode === "outer" ? OUTER_CITY_SLOTS : INNER_CITY_SLOTS;
}

export const LAYOUT_FRAME = { w: 1600, h: 900 };
export const HUD_HEIGHT = 56;
export const STAGE_TOP_Y = HUD_HEIGHT;
export const STAGE_HEIGHT = 788;
export const TOOLBAR_HEIGHT = 56;
export const TOOLBAR_TOP_Y = LAYOUT_FRAME.h - TOOLBAR_HEIGHT;
export const MIN_CONTENT_VIEWPORT = { w: 1280, h: 720 };
