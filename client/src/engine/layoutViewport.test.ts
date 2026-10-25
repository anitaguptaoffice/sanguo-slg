import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyLayoutFrameStyles,
  applyLayoutTransform,
  canvasToLayout,
  computeLayoutViewport,
  isNarrowLayoutViewport,
  layoutFrameCssSize,
  layoutToCanvas,
  layoutViewportRootClass,
  minUiScaleForHitSize,
  NARROW_LAYOUT_ROOT_CLASS,
  syncLayoutViewportRootClass,
  CLIENT_111_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_119_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_127_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_135_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_145_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_155_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_163_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_171_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_179_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_187_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_195_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_203_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_211_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_219_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_227_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_235_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_243_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_251_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_275_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_291_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_299_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_315_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_331_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_347_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_371_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_379_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_363_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_355_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_339_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_307_NARROW_MANIFEST_CENTER_PANEL_IDS,
  MAIN_CITY_WAVE30_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE31_MARCH_MAIL_SOCIAL_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE32_MAIN_CITY_BUILD_HERO_SHOP_DAILY_WORLD_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE33_INTEL_BATTLE_MAIL_BAG_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE34_MAIN_CITY_HERO_RANK_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE35_WORLD_INTEL_BATTLE_REPORT_MAIL_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE36_MAIN_CITY_QUEUE_HERO_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE37_WORLD_INTEL_BATTLE_REPORT_MAIL_BAG_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE38_MAIN_CITY_HERO_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE39_WORLD_INTEL_BATTLE_REPORT_MAIL_MARCH_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE40_MAIN_CITY_HERO_BAG_DAILY_GUILD_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE41_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_RECRUIT_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE42_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE43_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE44_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE45_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE46_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE47_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE48_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE50_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE52_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE54_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE57_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE58_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE56_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE55_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE53_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE49_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WAVE51_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
  WORLD_MINIMAP_NARROW_EXPANDED_LAYOUT_RECT,
} from "@/engine/layoutViewport";
import { LAYOUT_FRAME, MIN_CONTENT_VIEWPORT } from "@/engine/mainCitySlots";

const clientRoot = join(import.meta.dirname, "../..");
import {
  NARROW_SCROLL_CENTER_PANEL_IDS,
  NARROW_SCROLL_SIDEBAR_PANEL_IDS,
} from "@/ui/contentPanelScroll";

describe("computeLayoutViewport", () => {
  it("fits 1600×900 design at 1:1 on a 1600×900 viewport", () => {
    const vp = computeLayoutViewport(1600, 900);
    expect(vp.uiScale).toBe(1);
    expect(vp.offsetX).toBe(0);
    expect(vp.offsetY).toBe(0);
  });

  it("uses uiScale = min(vw/1600, vh/900) at minimum content 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(vp.uiScale).toBeCloseTo(0.8, 5);
    expect(layoutFrameCssSize(vp).width).toBeCloseTo(1280, 5);
    expect(layoutFrameCssSize(vp).height).toBeCloseTo(720, 5);
  });

  it("letterboxes a tall narrow viewport", () => {
    const vp = computeLayoutViewport(400, 900);
    expect(vp.uiScale).toBeCloseTo(400 / LAYOUT_FRAME.w, 5);
    expect(vp.offsetY).toBeGreaterThan(0);
    expect(vp.offsetX).toBe(0);
  });

  it("letterboxes an ultra-wide viewport", () => {
    const vp = computeLayoutViewport(2000, 900);
    expect(vp.uiScale).toBe(1);
    expect(vp.offsetX).toBe(200);
    expect(vp.offsetY).toBe(0);
  });

  it("round-trips layout ↔ canvas coordinates", () => {
    const vp = computeLayoutViewport(1280, 720);
    const p = layoutToCanvas(640, 450, vp);
    const back = canvasToLayout(p.x, p.y, vp);
    expect(back.x).toBeCloseTo(640, 5);
    expect(back.y).toBeCloseTo(450, 5);
  });
});

describe("applyLayoutTransform", () => {
  it("multiplies an existing DPR scale instead of replacing it", () => {
    const dpr = 2;
    let a = dpr;
    let d = dpr;
    const ctx = {
      transform(sx: number, _0: number, _1: number, sy: number) {
        a *= sx;
        d *= sy;
      },
    } as CanvasRenderingContext2D;
    const vp = computeLayoutViewport(1600, 900);
    applyLayoutTransform(ctx, vp);
    expect(a).toBeCloseTo(dpr * vp.uiScale, 5);
    expect(d).toBeCloseTo(dpr * vp.uiScale, 5);
  });
});

describe("minUiScaleForHitSize", () => {
  it("requires scale ≥ 44/220 for a 220px-wide hit rect", () => {
    expect(minUiScaleForHitSize(220)).toBeCloseTo(0.2, 5);
  });
});

describe("narrow layout root class", () => {
  it("enables layout-narrow at 1280×720 minimum content viewport", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(layoutViewportRootClass(vp)).toBe(NARROW_LAYOUT_ROOT_CLASS);
  });

  it("keeps 1600×900 baseline without narrow class", () => {
    const vp = computeLayoutViewport(1600, 900);
    expect(isNarrowLayoutViewport(vp)).toBe(false);
    expect(layoutViewportRootClass(vp)).toBe("");
  });

  it("applyLayoutFrameStyles sets --ui-scale on layout frame", () => {
    const root = document.createElement("div");
    const vp = computeLayoutViewport(1280, 720);
    applyLayoutFrameStyles(root, vp);
    expect(root.style.getPropertyValue("--ui-scale")).toBe(String(vp.uiScale));
  });

  it("syncLayoutViewportRootClass toggles on #layout-frame", () => {
    const root = document.createElement("div");
    syncLayoutViewportRootClass(root, computeLayoutViewport(1280, 720));
    expect(root.classList.contains(NARROW_LAYOUT_ROOT_CLASS)).toBe(true);
    syncLayoutViewportRootClass(root, computeLayoutViewport(1600, 900));
    expect(root.classList.contains(NARROW_LAYOUT_ROOT_CLASS)).toBe(false);
  });

  it("CLIENT-095 economy/social panels participate in narrow scroll registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    for (const id of ["bag", "shop", "guild", "chat"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("CLIENT-103 rank hero daily panels participate in narrow scroll registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    for (const id of ["rank", "hero", "daily"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("CLIENT-111 building mail queue manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    for (const id of CLIENT_111_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(["building", "mail", "queue"]).toContain(id);
    }
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["mail", "queue"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("CLIENT-119 bag shop hero military manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_119_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "bag",
      "shop",
      "hero",
      "military",
    ]);
    for (const id of CLIENT_119_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("CLIENT-127 mail daily march battle-report filter-list manifest at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_127_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "mail",
      "daily",
      "march",
      "battle-report",
    ]);
    for (const id of CLIENT_127_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("CLIENT-135 building queue hero HUD narrow manifest at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_135_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual(["building", "queue", "hero"]);
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("CLIENT-145 intel/social manifest + narrow minimap at 1280×720", () => {
    expect(isNarrowLayoutViewport(computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h))).toBe(
      true,
    );
    for (const id of CLIENT_145_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WORLD_MINIMAP_NARROW_EXPANDED_LAYOUT_RECT.w).toBeGreaterThan(270);
  });

  it("CLIENT-155 wave:30 econ/daily/hero/rank manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_155_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "queue",
      "daily",
      "hero",
      "rank",
      "bag",
      "shop",
    ]);
    for (const id of CLIENT_155_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(MAIN_CITY_WAVE30_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(56);
  });

  it("ART-TOOLBAR-ICONS-009 narrow toolbar scroll has no vertical padding (44px hit fits bottom band)", () => {
    const html = readFileSync(join(clientRoot, "index.html"), "utf8");
    expect(html).toContain("#layout-frame.layout-narrow .main-city-toolbar .toolbar-scroll");
    expect(html).toContain("padding-top: 0");
    expect(html).toContain("padding-bottom: 0");
  });

  it("CLIENT-163 wave:31 march/mail/social manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_163_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "military",
      "march",
      "battle-report",
      "mail",
      "guild",
      "chat",
    ]);
    for (const id of CLIENT_163_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE31_MARCH_MAIL_SOCIAL_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-171 wave:32 build/hero/shop/daily/world manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_171_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "shop",
      "daily",
      "rank",
      "world",
    ]);
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "shop", "daily", "rank", "world"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE32_MAIN_CITY_BUILD_HERO_SHOP_DAILY_WORLD_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(
      56,
    );
  });

  it("CLIENT-179 wave:33 intel/battle/mail/bag/daily/military manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_179_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "march",
      "battle-report",
      "mail",
      "bag",
      "daily",
      "military",
    ]);
    for (const id of CLIENT_179_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE33_INTEL_BATTLE_MAIL_BAG_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-187 wave:34 main-city hero rank social HUD manifest registry at 1280×720", () => {
    expect(isNarrowLayoutViewport(computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h))).toBe(
      true,
    );
    expect(CLIENT_187_NARROW_MANIFEST_CENTER_PANEL_IDS).toContain("guild");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("rank");
    expect(WAVE34_MAIN_CITY_HERO_RANK_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-195 wave:35 world intel battle mail daily bag shop manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_195_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "daily",
      "bag",
      "shop",
    ]);
    for (const id of CLIENT_195_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE35_WORLD_INTEL_BATTLE_REPORT_MAIL_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-203 wave:36 main-city queue hero social HUD manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_203_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "guild",
      "chat",
    ]);
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "guild", "chat"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE36_MAIN_CITY_QUEUE_HERO_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-211 wave:37 world intel battle report mail bag manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_211_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
    ]);
    for (const id of CLIENT_211_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE37_WORLD_INTEL_BATTLE_REPORT_MAIL_BAG_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-219 wave:38 main-city hero social queue manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_219_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
      "shop",
    ]);
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of [
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
      "shop",
    ] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE38_MAIN_CITY_HERO_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-227 wave:39 world intel battle report mail march hud manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_227_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
    ]);
    for (const id of CLIENT_227_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE39_WORLD_INTEL_BATTLE_REPORT_MAIL_MARCH_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(
      56,
    );
  });

  it("CLIENT-235 wave:40 main-city hero bag daily guild manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_235_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "bag",
      "daily",
      "guild",
    ]);
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "bag", "daily", "guild"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE40_MAIN_CITY_HERO_BAG_DAILY_GUILD_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-243 wave:41 world intel battle report mail shop rank recruit manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_243_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
      "rank",
      "hero",
    ]);
    for (const id of CLIENT_243_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(
      WAVE41_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_RECRUIT_BOTTOM_TOOLBAR_CLEARANCE_PX,
    ).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-251 wave:42 main-city hero daily social queue manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_251_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
    expect(CLIENT_251_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("world");
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "rank", "guild", "chat", "daily"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE42_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(
      56,
    );
  });

  it("CLIENT-299 wave:48 main-city hero daily social queue manifest consolidate deepest at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_299_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
    expect(CLIENT_299_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("world");
    expect(CLIENT_299_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("march");
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "rank", "guild", "chat", "daily"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE48_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(
      56,
    );
  });

  it("CLIENT-323 wave:51 world intel battle report mail shop rank manifest consolidate deepest-deeper at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
      "rank",
      "hero",
    ]);
    expect(CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("building");
    expect(CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("queue");
    expect(CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("daily");
    for (const id of CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(
      WAVE51_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
    ).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-379 wave:58 main-city hero daily social queue manifest consolidate deepest-deepest-deepest-deeper at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_379_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
    expect(CLIENT_379_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("world");
    expect(CLIENT_379_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("march");
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "rank", "guild", "chat", "daily"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE58_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(
      56,
    );
  });

  it("CLIENT-371 wave:57 world intel battle report mail shop rank manifest consolidate deepest-deepest-deepest-deeper at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_371_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
      "rank",
      "hero",
    ]);
    expect(CLIENT_371_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("building");
    expect(CLIENT_371_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("queue");
    expect(CLIENT_371_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("daily");
    for (const id of CLIENT_371_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(
      WAVE57_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
    ).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-355 wave:55 world intel battle report mail shop rank manifest consolidate deepest-deepest-deepest at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_355_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
      "rank",
      "hero",
    ]);
    expect(CLIENT_355_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("building");
    expect(CLIENT_355_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("queue");
    expect(CLIENT_355_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("daily");
    for (const id of CLIENT_355_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(
      WAVE55_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
    ).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-339 wave:53 world intel battle report mail shop rank manifest consolidate deepest-deepest-deeper at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_339_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
      "rank",
      "hero",
    ]);
    expect(CLIENT_339_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("building");
    expect(CLIENT_339_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("queue");
    expect(CLIENT_339_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("daily");
    for (const id of CLIENT_339_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(
      WAVE53_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
    ).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-363 wave:56 main-city hero daily social queue manifest consolidate deepest-deepest-deepest-deepest at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_363_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
    expect(CLIENT_363_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("world");
    expect(CLIENT_363_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("march");
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "rank", "guild", "chat", "daily"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE56_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(
      56,
    );
  });

  it("CLIENT-347 wave:54 main-city hero daily social queue manifest consolidate deepest-deepest-deepest at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_347_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
    expect(CLIENT_347_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("world");
    expect(CLIENT_347_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("march");
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "rank", "guild", "chat", "daily"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE54_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(
      56,
    );
  });

  it("CLIENT-331 wave:52 main-city hero daily social queue manifest consolidate deepest-deepest-deeper at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_331_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
    expect(CLIENT_331_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("world");
    expect(CLIENT_331_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("march");
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "rank", "guild", "chat", "daily"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE52_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(
      56,
    );
  });

  it("CLIENT-315 wave:50 main-city hero daily social queue manifest consolidate deepest-deeper at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_315_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
    expect(CLIENT_315_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("world");
    expect(CLIENT_315_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("march");
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "rank", "guild", "chat", "daily"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE50_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(
      56,
    );
  });

  it("CLIENT-307 wave:49 world intel battle report mail shop rank manifest consolidate deepest at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_307_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
      "rank",
      "hero",
    ]);
    expect(CLIENT_307_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("building");
    expect(CLIENT_307_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("queue");
    expect(CLIENT_307_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("daily");
    for (const id of CLIENT_307_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(
      WAVE49_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
    ).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-291 wave:47 world intel battle report mail shop rank manifest consolidate deeper at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_291_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
      "rank",
      "hero",
    ]);
    expect(CLIENT_291_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("building");
    expect(CLIENT_291_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("queue");
    expect(CLIENT_291_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("daily");
    for (const id of CLIENT_291_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(
      WAVE47_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
    ).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-283 wave:46 main-city hero daily social queue manifest consolidate deeper at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
    expect(CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("world");
    expect(CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("march");
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "rank", "guild", "chat", "daily"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE46_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(
      56,
    );
  });

  it("CLIENT-275 wave:45 world intel battle report mail shop rank manifest consolidate at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_275_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
      "rank",
      "hero",
    ]);
    expect(CLIENT_275_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("building");
    expect(CLIENT_275_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("queue");
    expect(CLIENT_275_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("daily");
    for (const id of CLIENT_275_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(
      WAVE45_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
    ).toBeGreaterThanOrEqual(56);
  });

  it("CLIENT-267 wave:44 main-city hero daily social queue manifest consolidate at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "building",
      "queue",
      "hero",
      "rank",
      "guild",
      "chat",
      "daily",
    ]);
    expect(CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("world");
    expect(CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("march");
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero", "rank", "guild", "chat", "daily"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(WAVE44_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX).toBeGreaterThanOrEqual(
      56,
    );
  });

  it("CLIENT-259 wave:43 world intel battle report mail shop rank manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "world",
      "march",
      "military",
      "battle-report",
      "mail",
      "bag",
      "shop",
      "rank",
      "hero",
    ]);
    expect(CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("building");
    expect(CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS).not.toContain("queue");
    for (const id of CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
    expect(
      WAVE43_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
    ).toBeGreaterThanOrEqual(56);
  });
});
