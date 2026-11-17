import type { AssetLoader } from "@/engine/AssetLoader";
import { resolveDailyQuestItemReward } from "@/net/dailyQuestProgressFormat";
import type { DailyQuestRow } from "@/net/dailyQuestState";

/** Independent daily reward decoration; no bag renderer or claim behavior. */
export function mountDailyRewardIcon(
  row: HTMLElement, quest: DailyQuestRow, panel: HTMLElement, assets?: AssetLoader,
): void {
  row.querySelectorAll(".daily-reward-item-icon").forEach((img) => img.remove());
  const target = row.querySelector(".daily-quest-row-reward");
  const reward = resolveDailyQuestItemReward(quest);
  row.classList.toggle("daily-reward-icon-host", Boolean(target && reward));
  if (!target || !reward) return;
  if (!panel.querySelector("style[data-daily-reward-icons]")) {
    const style = document.createElement("style");
    style.dataset.dailyRewardIcons = "";
    style.textContent = ".daily-reward-item-icon{width:20px;height:20px;object-fit:contain;vertical-align:middle;margin-inline-end:4px;pointer-events:none}" +
      '[data-art-skin="off"] .daily-reward-item-icon{display:none}' +
      '[data-center-panel="daily"] .daily-quest-list li.daily-reward-icon-host .art-filter-row-skin-bar{height:auto;max-height:none;min-height:40px;flex-wrap:wrap;align-items:flex-start;row-gap:4px;padding-top:4px;padding-bottom:4px}';
    panel.appendChild(style);
  }
  if (!Number.isSafeInteger(reward.reward_item_id) || reward.reward_item_id <= 0) return;
  const id = `item.icon.${reward.reward_item_id}.v1`;
  const entry = assets?.getImageForAsset(id);
  if (!entry || entry.meta.id !== id || entry.meta.kind !== "icon" || !entry.img.getAttribute("src")) return;
  const img = document.createElement("img");
  img.className = "daily-reward-item-icon";
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.width = img.height = 20;
  img.addEventListener("error", () => img.remove(), { once: true });
  img.src = entry.img.src;
  target.prepend(img);
}
