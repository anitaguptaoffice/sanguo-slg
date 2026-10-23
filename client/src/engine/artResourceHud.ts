import type { AssetLoader } from "@/engine/AssetLoader";
import type { ResourceWallet } from "@/net/bootstrapSession";
import { formatResourceAmount, WALLET_RESOURCE_KEYS } from "@/net/hudFormat";

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

export function appendHudResourceStrip(
  hud: HTMLElement,
  wallet: ResourceWallet | undefined,
  assets: AssetLoader,
): void {
  const group = document.createElement("span");
  group.className = "hud-group hud-resource-strip";
  group.dataset.role = "hud-resources";

  for (const { key, label } of WALLET_RESOURCE_KEYS) {
    const item = document.createElement("span");
    item.className = "hud-resource-item";
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
}
