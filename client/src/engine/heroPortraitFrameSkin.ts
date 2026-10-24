import type { AssetLoader } from "@/engine/AssetLoader";
import { heroTemplateLabel } from "@/net/heroMailState";

export const HERO_LIST_AVATAR_ROLE = "hero-list-avatar";
export const HERO_DETAIL_BUST_ROLE = "hero-detail-bust";

export function heroAvatarAssetId(templateCfgId: number): string {
  return `hero.avatar.${templateCfgId}.v1`;
}

export function heroBustAssetId(templateCfgId: number): string {
  return `hero.bust.${templateCfgId}.v1`;
}

export function isHeroPortraitArtSkinOff(root: Element | null | undefined): boolean {
  if (!(root instanceof HTMLElement)) return false;
  return root.dataset.artSkin === "off" || root.closest("[data-art-skin='off']") != null;
}

function portraitAltName(templateCfgId: number, displayName?: string): string {
  const trimmed = displayName?.trim();
  return trimmed || heroTemplateLabel(templateCfgId) || `将领模板${templateCfgId}`;
}

function resolvePortraitPack(assets: AssetLoader | undefined, assetId: string) {
  if (!assets?.getArtMeta(assetId)) return undefined;
  return assets.getImageForAsset(assetId);
}

export function mountHeroListAvatar(
  li: HTMLElement,
  templateCfgId: number | undefined,
  displayName: string | undefined,
  assets: AssetLoader | undefined,
  panelRoot?: HTMLElement | null,
): void {
  li.querySelector(`[data-role="${HERO_LIST_AVATAR_ROLE}"]`)?.remove();
  if (!templateCfgId || isHeroPortraitArtSkinOff(panelRoot ?? li)) return;
  const assetId = heroAvatarAssetId(templateCfgId);
  const pack = resolvePortraitPack(assets, assetId);
  const meta = assets?.getArtMeta(assetId);
  if (!pack || !meta?.display_size) return;

  const img = document.createElement("img");
  img.dataset.role = HERO_LIST_AVATAR_ROLE;
  img.className = "hero-list-avatar";
  img.alt = portraitAltName(templateCfgId, displayName);
  img.src = pack.img.src;
  img.width = meta.display_size.w;
  img.height = meta.display_size.h;
  img.dataset.artTextureScale = String(pack.scale);

  const body = li.querySelector(".hero-list-row-body");
  if (body) li.insertBefore(img, body);
  else li.prepend(img);
}

export function mountHeroDetailBust(
  detailEl: HTMLElement,
  templateCfgId: number | undefined,
  displayName: string | undefined,
  assets: AssetLoader | undefined,
  panelRoot?: HTMLElement | null,
): void {
  detailEl.querySelector(`[data-role="${HERO_DETAIL_BUST_ROLE}"]`)?.remove();
  if (!templateCfgId || isHeroPortraitArtSkinOff(panelRoot ?? detailEl)) return;
  const assetId = heroBustAssetId(templateCfgId);
  const pack = resolvePortraitPack(assets, assetId);
  const meta = assets?.getArtMeta(assetId);
  if (!pack || !meta?.display_size) return;

  const img = document.createElement("img");
  img.dataset.role = HERO_DETAIL_BUST_ROLE;
  img.className = "hero-detail-bust";
  img.alt = portraitAltName(templateCfgId, displayName);
  img.src = pack.img.src;
  const w = meta.display_size.w;
  const h = meta.display_size.h;
  img.width = w;
  img.height = h;
  img.dataset.artTextureScale = String(pack.scale);
  if (meta.anchor && meta.anchor_unit === "pixels") {
    img.style.setProperty("--hero-bust-anchor-x", `${meta.anchor.x}px`);
    img.style.setProperty("--hero-bust-anchor-y", `${meta.anchor.y}px`);
  }

  const head = detailEl.querySelector(".hero-detail-head");
  if (head) detailEl.insertBefore(img, head);
  else detailEl.prepend(img);
}
