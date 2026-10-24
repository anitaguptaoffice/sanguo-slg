import type { AssetLoader } from "@/engine/AssetLoader";
import {
  ART_FILTER_LIST_ROW_H,
  ART_UI_FILTER_BADGE_DOT,
  ART_UI_FILTER_LIST_ROW,
  ART_UI_FILTER_LIST_ROW_HOVER,
  ART_UI_FILTER_LIST_ROW_SELECTED,
} from "@/engine/artUiFilterAssets";

type RowPaint = "default" | "hover" | "selected";

function rowAssetId(paint: RowPaint): string {
  if (paint === "selected") return ART_UI_FILTER_LIST_ROW_SELECTED;
  if (paint === "hover") return ART_UI_FILTER_LIST_ROW_HOVER;
  return ART_UI_FILTER_LIST_ROW;
}

function applyListRowNineSlice(li: HTMLElement, assets: AssetLoader, paint: RowPaint): void {
  const assetId = rowAssetId(paint);
  const pack = assets.getImageForAsset(assetId);
  const meta = assets.getArtMeta(assetId);
  if (!pack || !meta?.nine_slice) return;
  const slice = meta.nine_slice;
  const scale = pack.scale;
  const url = pack.img.src;
  li.style.borderStyle = "solid";
  li.style.borderWidth = `${slice.top}px ${slice.right}px ${slice.bottom}px ${slice.left}px`;
  li.style.borderImageSource = `url(${url})`;
  li.style.borderImageSlice = `${slice.top * scale} ${slice.right * scale} ${slice.bottom * scale} ${slice.left * scale} fill`;
  li.style.borderImageWidth = `${slice.top}px ${slice.right}px ${slice.bottom}px ${slice.left}px`;
  li.style.borderImageRepeat = "stretch";
  li.style.background = "transparent";
  li.style.boxSizing = "border-box";
  li.style.height = `${ART_FILTER_LIST_ROW_H}px`;
  li.style.minHeight = `${ART_FILTER_LIST_ROW_H}px`;
  li.style.maxHeight = `${ART_FILTER_LIST_ROW_H}px`;
  li.style.width = "100%";
  li.style.borderRadius = "0";
}

function resolveRowPaint(li: HTMLElement, transient: RowPaint): RowPaint {
  if (li.classList.contains("selected")) return "selected";
  return transient;
}

function syncUnreadDot(li: HTMLElement, assets: AssetLoader): void {
  const title = li.querySelector(".mail-row-title, .daily-quest-row-main");
  if (!title) return;
  const show = li.classList.contains("unread");
  let dot = title.querySelector<HTMLElement>('[data-role="art-unread-dot"]');
  if (!show) {
    dot?.remove();
    return;
  }
  if (!dot) {
    dot = document.createElement("span");
    dot.className = "art-unread-dot";
    dot.setAttribute("data-role", "art-unread-dot");
    dot.setAttribute("aria-hidden", "true");
    title.insertBefore(dot, title.firstChild);
  }
  const pack = assets.getImageForAsset(ART_UI_FILTER_BADGE_DOT);
  if (!pack) return;
  const meta = assets.getArtMeta(ART_UI_FILTER_BADGE_DOT);
  const w = meta?.display_size.w ?? 16;
  const h = meta?.display_size.h ?? 16;
  dot.style.display = "inline-block";
  dot.style.width = `${w}px`;
  dot.style.height = `${h}px`;
  dot.style.marginRight = "4px";
  dot.style.verticalAlign = "middle";
  dot.style.backgroundImage = `url(${pack.img.src})`;
  dot.style.backgroundSize = `${w}px ${h}px`;
  dot.style.backgroundRepeat = "no-repeat";
  dot.style.flexShrink = "0";
}

function skinOneListRow(li: HTMLElement, assets: AssetLoader): void {
  if (li.dataset.artSkin === "off") return;
  if (li.classList.contains("mail-empty") || li.classList.contains("daily-quest-list-empty")) return;
  if (li.dataset.artSkinned === "list-row") {
    syncUnreadDot(li, assets);
    applyListRowNineSlice(li, assets, resolveRowPaint(li, "default"));
    return;
  }
  li.dataset.artSkinned = "list-row";
  li.classList.add("art-list-row");
  const setTransient = (t: RowPaint) => applyListRowNineSlice(li, assets, resolveRowPaint(li, t));
  setTransient("default");
  syncUnreadDot(li, assets);
  li.addEventListener("mouseenter", () => setTransient("hover"));
  li.addEventListener("mouseleave", () => setTransient("default"));
  const obs = new MutationObserver(() => {
    syncUnreadDot(li, assets);
    setTransient(li.matches(":hover") ? "hover" : "default");
  });
  obs.observe(li, { attributes: true, attributeFilter: ["class"] });
}

export function skinArtListRows(
  root: ParentNode,
  assets: AssetLoader,
  selector = ".mail-list li, .daily-quest-list li",
): void {
  const rows = Array.from(root.querySelectorAll<HTMLElement>(selector));
  for (const li of rows) skinOneListRow(li, assets);
}

/** Re-apply row skins after list DOM refresh (mail / daily). */
export function observeArtListRowLists(root: HTMLElement, assets: AssetLoader): void {
  if (root.dataset.artListObserver === "1") return;
  root.dataset.artListObserver = "1";
  const lists = Array.from(root.querySelectorAll<HTMLElement>(".mail-list, .daily-quest-list"));
  for (const ul of lists) {
    skinArtListRows(ul, assets);
    const obs = new MutationObserver(() => skinArtListRows(ul, assets));
    obs.observe(ul, { childList: true, subtree: true });
  }
}
