import type { AssetLoader } from "@/engine/AssetLoader";
import type { ResourceWallet } from "@/net/bootstrapSession";
import {
  formatResourceAmount,
  formatResourceSweepLine,
  WALLET_RESOURCE_KEYS,
} from "@/net/hudFormat";

/** Manifest PNG ids wired on CLIENT-032 (#218 main-tree); gold has no icon asset. */
export const HUD_RESOURCE_ICON_ASSET_IDS: Partial<Record<keyof ResourceWallet, string>> = {
  food: "res.icon.food.v1",
  wood: "res.icon.wood.v1",
  iron: "res.icon.iron.v1",
  stone: "res.icon.stone.v1",
};

export const CLIENT_032_WIRED_ASSET_IDS = [
  "res.icon.food.v1",
  "res.icon.wood.v1",
  "res.icon.stone.v1",
  "res.icon.iron.v1",
  "ui.panel.default.v1",
] as const;

/** Single source of truth for top-bar resource icons/amounts (DOM `#hud`; not duplicated on canvas). */
export function appendHudResourceStrip(
  hud: HTMLElement,
  wallet: ResourceWallet | undefined,
  assets: AssetLoader,
  productionRates?: ResourceWallet,
): void {
  const group = document.createElement("span");
  group.className = "hud-group hud-resource-strip";
  group.dataset.role = "hud-resources";

  for (const { key, label } of WALLET_RESOURCE_KEYS) {
    const item = document.createElement("span");
    item.className = "hud-resource-item";
    item.dataset.resource = key;
    const amount = formatResourceAmount(wallet?.[key]);
    const assetId = HUD_RESOURCE_ICON_ASSET_IDS[key];
    const pack = assetId ? assets.getImageForAsset(assetId) : undefined;
    if (assetId && pack) {
      const img = document.createElement("img");
      img.className = "hud-resource-icon";
      img.alt = label;
      img.width = 18;
      img.height = 18;
      img.src = pack.img.src;
      item.appendChild(img);
      const amt = document.createElement("span");
      amt.className = "hud-resource-amount";
      amt.textContent = amount;
      item.appendChild(amt);
    } else {
      item.textContent = `${label} ${amount}`;
    }
    group.appendChild(item);
  }

  hud.appendChild(group);
  wireHudResourceSweep(group, productionRates, wallet);
}

/** 资源区 hover/focus/展开扫读条：余量 + 产出（CLIENT-081）；不常驻占顶栏第二行。 */
export function wireHudResourceSweep(
  strip: HTMLElement,
  productionRates: ResourceWallet | undefined,
  wallet: ResourceWallet | undefined,
): void {
  const line = formatResourceSweepLine(productionRates, wallet);
  strip.tabIndex = 0;
  strip.setAttribute("role", "button");
  strip.setAttribute("aria-expanded", strip.classList.contains("hud-resource-expanded") ? "true" : "false");
  strip.setAttribute("title", line);
  strip.setAttribute("aria-label", `主城资源，${line}`);

  let sweep = strip.querySelector('[data-role="hud-resource-sweep"]');
  if (!sweep) {
    sweep = document.createElement("span");
    sweep.className = "hud-resource-sweep";
    sweep.dataset.role = "hud-resource-sweep";
    strip.appendChild(sweep);
  }
  sweep.textContent = line;

  if (strip.dataset.sweepWired === "1") return;
  strip.dataset.sweepWired = "1";

  strip.addEventListener("click", () => {
    strip.classList.toggle("hud-resource-expanded");
    strip.setAttribute(
      "aria-expanded",
      strip.classList.contains("hud-resource-expanded") ? "true" : "false",
    );
  });

  strip.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    strip.classList.toggle("hud-resource-expanded");
    strip.setAttribute(
      "aria-expanded",
      strip.classList.contains("hud-resource-expanded") ? "true" : "false",
    );
  });
}

/** `renderHud` 重建资源条后恢复点击展开态（CLIENT-148）。 */
export function restoreHudResourceStripExpanded(hud: ParentNode, expanded: boolean): void {
  if (!expanded) return;
  const strip = hud.querySelector('[data-role="hud-resources"]');
  if (!(strip instanceof HTMLElement)) return;
  strip.classList.add("hud-resource-expanded");
  strip.setAttribute("aria-expanded", "true");
}

/** 读取顶栏资源条是否处于点击展开（hover/focus 不占持久态）。 */
export function readHudResourceStripExpanded(hud: ParentNode): boolean {
  const strip = hud.querySelector('[data-role="hud-resources"]');
  return strip instanceof HTMLElement && strip.classList.contains("hud-resource-expanded");
}
