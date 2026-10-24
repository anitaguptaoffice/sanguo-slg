import type { AssetLoader } from "@/engine/AssetLoader";
import { formatUiFilterBadgeCount } from "@/engine/artUiFilterBadgeCount";
import { ART_UI_FILTER_BADGE_COUNT } from "@/engine/artUiFilterAssets";

const COUNT_TEXT_COLOR = "#fff7e3";

function applyCountBadgeVisual(shell: HTMLElement, assets: AssetLoader, label: string): void {
  const pack = assets.getImageForAsset(ART_UI_FILTER_BADGE_COUNT);
  const meta = assets.getArtMeta(ART_UI_FILTER_BADGE_COUNT);
  if (!pack) return;
  const w = meta?.display_size.w ?? 20;
  const h = meta?.display_size.h ?? 16;
  shell.style.display = label ? "inline-flex" : "none";
  shell.style.alignItems = "center";
  shell.style.justifyContent = "center";
  shell.style.width = `${w}px`;
  shell.style.height = `${h}px`;
  shell.style.minWidth = `${w}px`;
  shell.style.maxWidth = `${w}px`;
  shell.style.minHeight = `${h}px`;
  shell.style.maxHeight = `${h}px`;
  shell.style.flexShrink = "0";
  shell.style.backgroundImage = `url(${pack.img.src})`;
  shell.style.backgroundSize = `${w}px ${h}px`;
  shell.style.backgroundRepeat = "no-repeat";
  shell.style.backgroundPosition = "center";
  shell.style.color = COUNT_TEXT_COLOR;
  shell.style.fontSize = "10px";
  shell.style.fontWeight = "700";
  shell.style.lineHeight = "1";
  shell.style.marginLeft = "4px";
  shell.style.verticalAlign = "middle";
  shell.style.boxSizing = "border-box";
  shell.style.padding = "0";
  shell.classList.toggle("hidden", !label);
}

/** Mount ui.badge.count.v1 with code-drawn 1–9 / 9+ label (fixed 20×16, no stretch). */
export function syncArtUiCountBadge(
  host: HTMLElement,
  count: number,
  assets: AssetLoader,
): void {
  if (host.dataset.artSkin === "off") return;
  const label = formatUiFilterBadgeCount(count);
  host.setAttribute("data-ui-badge-count", String(Math.max(0, Math.floor(count))));
  let textEl = host.querySelector<HTMLElement>('[data-role="art-count-badge-text"]');
  if (!textEl) {
    host.classList.add("art-ui-count-badge");
    host.textContent = "";
    textEl = document.createElement("span");
    textEl.setAttribute("data-role", "art-count-badge-text");
    host.appendChild(textEl);
  }
  textEl.textContent = label;
  applyCountBadgeVisual(host, assets, label);
}

export function skinArtUiCountBadges(root: ParentNode, assets: AssetLoader): void {
  const hosts = Array.from(root.querySelectorAll<HTMLElement>("[data-ui-badge-count]"));
  for (const host of hosts) {
    const raw = host.getAttribute("data-ui-badge-count");
    const n = raw ? Number(raw) : 0;
    syncArtUiCountBadge(host, Number.isFinite(n) ? n : 0, assets);
  }
}
