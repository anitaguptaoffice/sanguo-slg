import type { AssetLoader } from "@/engine/AssetLoader";

/** ART-TOOLBAR-ICONS-007/009: mount sprites inside toolbar chrome; hit target stays the button. */
export const TOOLBAR_ICON_BY_ACTION: Record<string, { assetId: string; label: string; title: string }> = {
  "toggle-military": {
    assetId: "ui.icon.toolbar.military.v1",
    label: "军事",
    title: "军事",
  },
  "toggle-reports": {
    assetId: "ui.icon.toolbar.report.v1",
    label: "战报",
    title: "战报",
  },
  "toggle-marches": {
    assetId: "ui.icon.toolbar.march.v1",
    label: "行军",
    title: "行军",
  },
  "toggle-chat": {
    assetId: "ui.icon.toolbar.chat.v1",
    label: "聊天",
    title: "聊天",
  },
  "toggle-guild": {
    assetId: "ui.icon.toolbar.legion.v1",
    label: "军团",
    title: "军团",
  },
  "toggle-rank": {
    assetId: "ui.icon.toolbar.rank.v1",
    label: "排行",
    title: "排行",
  },
  "toggle-quest": {
    assetId: "ui.icon.toolbar.task.v1",
    label: "任务",
    title: "任务",
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

export type ToolbarIconBtnState = "normal" | "hover" | "pressed" | "disabled";

/** Resolve manifest sprite for toolbar icon state (button_states when present, else variants). */
export function resolveToolbarIconPack(
  assets: AssetLoader,
  assetId: string,
  state: ToolbarIconBtnState,
): { img: HTMLImageElement; scale: 1 | 2 } | undefined {
  const fromStates = assets.getButtonImage(assetId, state);
  if (fromStates) return fromStates;
  if (state === "disabled") {
    return assets.getButtonImage(assetId, "normal") ?? assets.getImageForAsset(assetId);
  }
  return assets.getImageForAsset(assetId);
}

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

function currentToolbarIconState(btn: HTMLButtonElement): ToolbarIconBtnState {
  if (btn.disabled) return "disabled";
  if (btn.matches(":active")) return "pressed";
  if (btn.matches(":hover")) return "hover";
  return "normal";
}

function applyToolbarIcon(
  btn: HTMLButtonElement,
  assets: AssetLoader,
  assetId: string,
  state: ToolbarIconBtnState,
): void {
  const pack = resolveToolbarIconPack(assets, assetId, state);
  if (!pack) return;
  const meta = assets.getArtMeta(assetId);
  const w = meta?.display_size?.w ?? 32;
  const h = meta?.display_size?.h ?? 32;
  const icon = btn.querySelector<HTMLImageElement>(".toolbar-btn-icon");
  if (!icon) return;
  icon.src = pack.img.src;
  icon.width = w;
  icon.height = h;
  icon.style.width = `${w}px`;
  icon.style.height = `${h}px`;
  icon.dataset.toolbarIconState = state;
  btn.classList.toggle("toolbar-chrome-btn--disabled-icon", btn.disabled || state === "disabled");
}

function wireToolbarIconStates(btn: HTMLButtonElement, assets: AssetLoader, assetId: string): void {
  if (btn.dataset.toolbarIconWired === "1") return;
  btn.dataset.toolbarIconWired = "1";
  const set = (state: ToolbarIconBtnState) => applyToolbarIcon(btn, assets, assetId, state);
  set(currentToolbarIconState(btn));
  btn.addEventListener("mouseenter", () => {
    if (!btn.disabled) set("hover");
  });
  btn.addEventListener("mouseleave", () => {
    if (!btn.disabled) set("normal");
  });
  btn.addEventListener("mousedown", () => {
    if (!btn.disabled) set("pressed");
  });
  btn.addEventListener("mouseup", () => {
    if (!btn.disabled) set(btn.matches(":hover") ? "hover" : "normal");
  });
  const obs = new MutationObserver(() => {
    if (btn.disabled) set("disabled");
    else set(currentToolbarIconState(btn));
  });
  obs.observe(btn, { attributes: true, attributeFilter: ["disabled"] });
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
    if (btn.dataset.artSkin === "off") {
      btn.querySelector(".toolbar-btn-icon")?.remove();
      btn.classList.remove("toolbar-chrome-btn--with-icon", "toolbar-chrome-btn--disabled-icon");
      delete btn.dataset.toolbarIconMounted;
      continue;
    }
    if (btn.dataset.toolbarIconMounted === "1") {
      applyToolbarIcon(btn, assets, spec.assetId, currentToolbarIconState(btn));
      continue;
    }
    btn.dataset.toolbarIconMounted = "1";
    btn.classList.add("toolbar-chrome-btn--with-icon");
    const { labelEl } = ensureIconButtonStructure(btn, spec.label);
    labelEl.textContent = spec.label;
    btn.setAttribute("aria-label", spec.title);
    if (!btn.getAttribute("title")) btn.setAttribute("title", spec.title);
    wireToolbarIconStates(btn, assets, spec.assetId);
  }
}
