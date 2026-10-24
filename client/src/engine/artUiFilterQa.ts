import type { AssetLoader } from "@/engine/AssetLoader";
import { syncArtUiCountBadge } from "@/engine/artBadgeCountSkin";
import { forceFilterChipPaintState, skinFilterChips } from "@/engine/artFilterChipSkin";
import { skinArtListRows } from "@/engine/artListRowSkin";

const QA_SESSION_KEY = "art-qa-filter-008";

export function artUiFilterQaEnabled(): boolean {
  try {
    return import.meta.env.DEV && sessionStorage.getItem(QA_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Dev-only strip for runtime evidence (chip states + count 9/9+ + list row samples). */
export function maybeMountArtUiFilterQaStrip(root: HTMLElement, assets: AssetLoader): void {
  if (!artUiFilterQaEnabled()) return;
  if (root.querySelector('[data-role="art-ui-filter-qa-strip"]')) return;
  const strip = document.createElement("div");
  strip.className = "art-ui-filter-qa-strip";
  strip.setAttribute("data-role", "art-ui-filter-qa-strip");
  strip.innerHTML = `
    <p class="art-ui-filter-qa-title">ART-UI-FILTER-008 QA</p>
    <div class="art-ui-filter-qa-chips" data-role="art-qa-chips"></div>
    <div class="art-ui-filter-qa-badges" data-role="art-qa-badges"></div>
    <ul class="mail-list art-ui-filter-qa-rows" data-role="art-qa-rows"></ul>
  `;
  const chips = strip.querySelector('[data-role="art-qa-chips"]')!;
  for (const [label, state] of [
    ["默认", "normal"],
    ["悬停", "hover"],
    ["按下", "pressed"],
    ["选中", "selected"],
  ] as const) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "art-filter-chip mail-filter-btn";
    btn.textContent = label;
    btn.setAttribute("data-art-qa-chip-state", state);
    chips.appendChild(btn);
    forceFilterChipPaintState(btn, assets, state);
  }
  const badges = strip.querySelector('[data-role="art-qa-badges"]')!;
  for (const count of [9, 10]) {
    const host = document.createElement("span");
    host.setAttribute("data-ui-badge-count", String(count));
    badges.appendChild(host);
    syncArtUiCountBadge(host, count, assets);
  }
  const rows = strip.querySelector('[data-role="art-qa-rows"]')!;
  for (const [cls, title] of [
    ["", "列表默认"],
    ["is-qa-hover", "列表悬停"],
    ["selected unread", "列表选中+未读点"],
  ]) {
    const li = document.createElement("li");
    li.className = `art-list-row ${cls}`.trim();
    if (cls.includes("unread")) li.classList.add("unread");
    const main = document.createElement("span");
    main.className = "mail-row-title";
    main.textContent = title;
    li.appendChild(main);
    rows.appendChild(li);
  }
  skinArtListRows(rows, assets);
  const hoverLi = rows.querySelector(".is-qa-hover");
  if (hoverLi instanceof HTMLElement) {
    hoverLi.dispatchEvent(new Event("mouseenter", { bubbles: true }));
  }
  root.prepend(strip);
  skinFilterChips(strip, assets);
}
