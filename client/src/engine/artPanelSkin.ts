import type { AssetLoader } from "@/engine/AssetLoader";

export const PANEL_ASSET_DEFAULT = "ui.panel.default.v1";
export const PANEL_ASSET_MILITARY = "ui.panel.military.v1";
export const PANEL_ASSET_HERO = "ui.panel.hero.v1";
export const PANEL_ASSET_BAG = "ui.panel.bag.v1";
export const PANEL_ASSET_QUEUE = "ui.panel.queue.v1";
export const PANEL_ASSET_WORLD = "ui.panel.world.v1";
export const PANEL_ASSET_RANK = "ui.panel.rank.v1";
export const PANEL_ASSET_MARCH = "ui.panel.march.v1";
export const PANEL_ASSET_BATTLE_REPORT = "ui.panel.battle-report.v1";
export const PANEL_ASSET_SHOP = "ui.panel.shop.v1";
export const PANEL_ASSET_GUILD = "ui.panel.guild.v1";
export const PANEL_ASSET_CHAT = "ui.panel.chat.v1";
export const PANEL_ASSET_DAILY = "ui.panel.daily.v1";

/** CLIENT-062 center panels wired like CLIENT-032 military manifest ids. */
export const CLIENT_062_CENTER_PANEL_ASSET_IDS = [
  PANEL_ASSET_HERO,
  PANEL_ASSET_BAG,
  PANEL_ASSET_QUEUE,
] as const;

/** CLIENT-070 narrow manifest roots: military + mail on default panel skin. */
export const CLIENT_070_PANEL_ASSET_BY_CENTER_ID: Record<"military" | "mail", string> = {
  military: PANEL_ASSET_MILITARY,
  mail: PANEL_ASSET_DEFAULT,
};

/** CLIENT-078 narrow manifest roots: hero / world / rank scan panels. */
export const CLIENT_078_PANEL_ASSET_BY_CENTER_ID: Record<"hero" | "world" | "rank", string> = {
  hero: PANEL_ASSET_HERO,
  world: PANEL_ASSET_WORLD,
  rank: PANEL_ASSET_RANK,
};

/** CLIENT-086 narrow manifest roots: 军情行军列表 / 战报列表+详情。 */
export const CLIENT_086_PANEL_ASSET_BY_CENTER_ID: Record<"march" | "battle-report", string> = {
  march: PANEL_ASSET_MARCH,
  "battle-report": PANEL_ASSET_BATTLE_REPORT,
};

/** CLIENT-095 narrow manifest roots: 背包 / 商城 / 军团 / 聊天。 */
export const CLIENT_095_PANEL_ASSET_BY_CENTER_ID: Record<"bag" | "shop" | "guild" | "chat", string> =
  {
    bag: PANEL_ASSET_BAG,
    shop: PANEL_ASSET_SHOP,
    guild: PANEL_ASSET_GUILD,
    chat: PANEL_ASSET_CHAT,
  };

/** CLIENT-103 narrow manifest roots: 双榜 / 将领 / 日常（工程接线与 CLIENT-095 同级）。 */
export const CLIENT_103_PANEL_ASSET_BY_CENTER_ID: Record<"rank" | "hero" | "daily", string> = {
  rank: PANEL_ASSET_RANK,
  hero: PANEL_ASSET_HERO,
  daily: PANEL_ASSET_DAILY,
};

/** CLIENT-111 narrow manifest roots: 主城建造侧栏 / 邮件 / 队列（与 CLIENT-086/103 同级工程接线）。 */
export const CLIENT_111_PANEL_ASSET_BY_CENTER_ID: Record<"building" | "mail" | "queue", string> = {
  building: PANEL_ASSET_DEFAULT,
  mail: PANEL_ASSET_DEFAULT,
  queue: PANEL_ASSET_QUEUE,
};

/** CLIENT-119 narrow manifest roots: 背包 / 商城 / 将领招募 / 军事出征（与 CLIENT-095/086 同级工程接线）。 */
export const CLIENT_119_PANEL_ASSET_BY_CENTER_ID: Record<
  "bag" | "shop" | "hero" | "military",
  string
> = {
  bag: PANEL_ASSET_BAG,
  shop: PANEL_ASSET_SHOP,
  hero: PANEL_ASSET_HERO,
  military: PANEL_ASSET_MILITARY,
};

/** Stretch a nine_slice panel asset as CSS border-image (24px logical slice by default). */
export function skinNineSlicePanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 480,
  logicalH = 300,
  panelAssetId = PANEL_ASSET_DEFAULT,
): void {
  if (el.dataset.artSkin === "off") return;
  const pack = assets.getImageForAsset(panelAssetId);
  const meta = assets.getArtMeta(panelAssetId);
  if (!pack || !meta?.nine_slice) return;
  const slice = meta.nine_slice;
  const scale = pack.scale;
  const url = pack.img.src;
  el.style.borderStyle = "solid";
  el.style.borderWidth = `${slice.top}px ${slice.right}px ${slice.bottom}px ${slice.left}px`;
  el.style.borderImageSource = `url(${url})`;
  el.style.borderImageSlice = `${slice.top * scale} ${slice.right * scale} ${slice.bottom * scale} ${slice.left * scale} fill`;
  el.style.borderImageWidth = `${slice.top}px ${slice.right}px ${slice.bottom}px ${slice.left}px`;
  el.style.borderImageRepeat = "stretch";
  el.style.background = "transparent";
  el.style.boxSizing = "border-box";
  el.style.minWidth = `${logicalW}px`;
  el.style.minHeight = `${logicalH}px`;
}

/** March list / queue recruit block roots (CLIENT-036); military form uses same asset in MainCityScene. */
export function skinMilitaryPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 420,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_MILITARY);
}

export function skinHeroPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_HERO);
}

export function skinBagPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_BAG);
}

export function skinQueuePanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_QUEUE);
}

/** Left building sidebar and other roots on `ui.panel.default.v1` (ART-CHROME-006 freeze). */
export function skinDefaultPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 480,
  logicalH = 300,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_DEFAULT);
}

export function skinMailPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_DEFAULT);
}

export function skinDailyPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_DAILY);
}

export function skinWorldPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_WORLD);
}

export function skinRankPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_RANK);
}

export function skinMarchIntelPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_MARCH);
}

export function skinBattleReportPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 360,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_BATTLE_REPORT);
}

export function skinShopPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_SHOP);
}

export function skinGuildPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_GUILD);
}

export function skinChatPanel(
  el: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): void {
  skinNineSlicePanel(el, assets, logicalW, logicalH, PANEL_ASSET_CHAT);
}
