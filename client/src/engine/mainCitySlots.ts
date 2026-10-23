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

export const MAIN_CITY_SLOTS: MainCitySlotDef[] = [
  {
    slot_key: "wall",
    label: "城墙",
    display: { x: 480, y: 200, w: 640, h: 120 },
    ground_anchor: { x: 320, y: 120 },
    z: 10,
    hit: { x: 480, y: 200, w: 640, h: 140 },
  },
  {
    slot_key: "iron",
    label: "铁矿",
    display: { x: 1220, y: 380, w: 200, h: 160 },
    ground_anchor: { x: 100, y: 160 },
    z: 20,
    hit: { x: 1210, y: 370, w: 220, h: 180 },
  },
  {
    slot_key: "farm",
    label: "农田",
    display: { x: 180, y: 380, w: 200, h: 160 },
    ground_anchor: { x: 100, y: 160 },
    z: 20,
    hit: { x: 170, y: 370, w: 220, h: 180 },
    asset_id: "mc.building.farm.v1",
  },
  {
    slot_key: "lumber",
    label: "伐木场",
    display: { x: 380, y: 320, w: 200, h: 160 },
    ground_anchor: { x: 100, y: 160 },
    z: 22,
    hit: { x: 370, y: 310, w: 220, h: 180 },
  },
  {
    slot_key: "quarry",
    label: "采石场",
    display: { x: 1020, y: 320, w: 200, h: 160 },
    ground_anchor: { x: 100, y: 160 },
    z: 22,
    hit: { x: 1010, y: 310, w: 220, h: 180 },
  },
  {
    slot_key: "barracks",
    label: "兵营",
    display: { x: 260, y: 520, w: 220, h: 180 },
    ground_anchor: { x: 110, y: 180 },
    z: 25,
    hit: { x: 250, y: 510, w: 240, h: 200 },
  },
  {
    slot_key: "hall",
    label: "官府",
    display: { x: 640, y: 120, w: 320, h: 240 },
    ground_anchor: { x: 160, y: 240 },
    z: 30,
    hit: { x: 630, y: 110, w: 340, h: 260 },
    asset_id: "mc.building.hall.v1",
  },
];

export const LAYOUT_FRAME = { w: 1600, h: 900 };
export const STAGE_TOP_Y = 56;
export const STAGE_HEIGHT = 788;
export const TOOLBAR_TOP_Y = 844;
