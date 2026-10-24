import type { AssetLoader } from "@/engine/AssetLoader";
import { skinArtUiCountBadges } from "@/engine/artBadgeCountSkin";
import { skinFilterChips } from "@/engine/artFilterChipSkin";
import { observeArtListRowLists, skinArtListRows } from "@/engine/artListRowSkin";
import { maybeMountArtUiFilterQaStrip } from "@/engine/artUiFilterQa";

/** Wire ART-UI-FILTER-008 chips, list rows, and count badges under a center panel root. */
export function skinUiFilterSurfaces(root: HTMLElement, assets: AssetLoader): void {
  if (root.dataset.artUiFilterSkinned === "1") {
    skinFilterChips(root, assets);
    skinArtListRows(root, assets);
    skinArtUiCountBadges(root, assets);
    return;
  }
  root.dataset.artUiFilterSkinned = "1";
  skinFilterChips(root, assets);
  skinArtListRows(root, assets);
  skinArtUiCountBadges(root, assets);
  observeArtListRowLists(root, assets);
  const obs = new MutationObserver(() => {
    skinFilterChips(root, assets);
    skinArtUiCountBadges(root, assets);
  });
  obs.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-ui-badge-count", "class"] });
  maybeMountArtUiFilterQaStrip(root, assets);
}
