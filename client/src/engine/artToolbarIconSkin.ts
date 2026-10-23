import type { AssetLoader } from "@/engine/AssetLoader";

/** ART-TOOLBAR-ICONS-007: mount sprites inside toolbar chrome; hit target stays the button. */
export const TOOLBAR_ICON_BY_ACTION: Record<string, { assetId: string; label: string; title: string }> = {
  "toggle-military": {
    assetId: "ui.icon.toolbar.military.v1",
    label: "军事",
    title: "军事",
  },
  "toggle-mail": {
    assetId: "ui.icon.toolbar.mail.v1",
    label: "邮件",
    title: "邮件",
  },
  "toggle-queue": {
    assetId: "ui.icon.toolbar.queue.v1",
    label: "队列",
    title: "队列",
  },
  "toggle-bag": {
    assetId: "ui.icon.toolbar.bag.v1",
    label: "背包",
    title: "背包",
  },
  "toggle-daily": {
    assetId: "ui.icon.toolbar.daily.v1",
    label: "日常",
    title: "日常",
  },
  "toggle-world": {
    assetId: "ui.icon.toolbar.world.v1",
    label: "世界",
    title: "世界",
  },
  "toggle-hero": {
    assetId: "ui.icon.toolbar.hero.v1",
    label: "将领",
    title: "将领",
  },
  "toggle-shop": {
    assetId: "ui.icon.toolbar.shop.v1",
    label: "商城",
    title: "商城",
  },
};

function ensureIconButtonStructure(btn: HTMLButtonElement, label: string): {
  icon: HTMLImageElement;
  labelEl: HTMLSpanElement;
} {
  let icon = btn.querySelector<HTMLImageElement>(".toolbar-btn-icon");
  if (!icon) {
    icon = document.createElement("img");
    icon.className = "toolbar-btn-icon";
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    icon.draggable = false;
    btn.prepend(icon);
  }
  let labelEl = btn.querySelector<HTMLSpanElement>(".toolbar-btn-label");
  if (!labelEl) {
    const text = (btn.textContent ?? "").trim();
    for (const node of Array.from(btn.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) node.remove();
    }
    labelEl = document.createElement("span");
    labelEl.className = "toolbar-btn-label";
    labelEl.textContent = text || label;
    btn.appendChild(labelEl);
  } else if (!labelEl.textContent?.trim()) {
    labelEl.textContent = label;
  }
  return { icon, labelEl };
}

function applyToolbarIcon(btn: HTMLButtonElement, assets: AssetLoader, assetId: string): void {
  const pack = assets.getImageForAsset(assetId);
  if (!pack) return;
  const meta = pack.meta;
  const w = meta.display_size?.w ?? 32;
  const h = meta.display_size?.h ?? 32;
  const icon = btn.querySelector<HTMLImageElement>(".toolbar-btn-icon");
  if (!icon) return;
  icon.src = pack.img.src;
  icon.width = w;
  icon.height = h;
  icon.style.width = `${w}px`;
  icon.style.height = `${h}px`;
}

/** Place manifest toolbar icons + two-character labels; button chrome remains the hit target. */
export function mountToolbarIcons(
  root: ParentNode,
  assets: AssetLoader,
  selector = ".toolbar-scroll-inner button[data-action]",
): void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(selector));
  for (const btn of buttons) {
    const action = btn.dataset.action;
    if (!action) continue;
    const spec = TOOLBAR_ICON_BY_ACTION[action];
    if (!spec) continue;
    if (btn.dataset.toolbarIconMounted === "1") {
      applyToolbarIcon(btn, assets, spec.assetId);
      continue;
    }
    btn.dataset.toolbarIconMounted = "1";
    btn.classList.add("toolbar-chrome-btn--with-icon");
    const { labelEl } = ensureIconButtonStructure(btn, spec.label);
    labelEl.textContent = spec.label;
    btn.setAttribute("aria-label", spec.title);
    if (!btn.getAttribute("title")) btn.setAttribute("title", spec.title);
    applyToolbarIcon(btn, assets, spec.assetId);
    const obs = new MutationObserver(() => {
      btn.classList.toggle("toolbar-chrome-btn--disabled-icon", btn.disabled);
    });
    obs.observe(btn, { attributes: true, attributeFilter: ["disabled"] });
    btn.classList.toggle("toolbar-chrome-btn--disabled-icon", btn.disabled);
  }
}
