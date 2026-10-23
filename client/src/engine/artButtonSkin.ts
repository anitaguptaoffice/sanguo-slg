import type { AssetLoader } from "@/engine/AssetLoader";

const BTN_ASSET = "ui.button.primary.v1";

type BtnState = "normal" | "hover" | "pressed" | "disabled";

function applyButtonSkin(btn: HTMLButtonElement, assets: AssetLoader, state: BtnState): void {
  const pack = assets.getButtonImage(BTN_ASSET, state);
  if (!pack) return;
  const meta = assets.getArtMeta(BTN_ASSET);
  const w = meta?.display_size.w ?? 160;
  const h = meta?.display_size.h ?? 48;
  btn.style.backgroundImage = `url(${pack.img.src})`;
  btn.style.backgroundSize = `${w}px ${h}px`;
  btn.style.backgroundRepeat = "no-repeat";
  btn.style.backgroundPosition = "center";
  btn.style.backgroundColor = "transparent";
  btn.style.border = "none";
  btn.style.minHeight = `${h}px`;
  btn.style.boxSizing = "border-box";
  btn.style.color = "#f5e6c8";
  if (btn.classList.contains("art-btn-primary-full")) {
    btn.style.minWidth = `${w}px`;
    btn.style.width = `${w}px`;
    btn.style.padding = "0";
    btn.style.lineHeight = `${h}px`;
  }
}

/** Skin primary manifest buttons (default: `.art-btn-primary`) with ui.button.primary.v1 four states. */
export function skinPrimaryButtons(
  root: ParentNode,
  assets: AssetLoader,
  selector = "button.art-btn-primary",
): void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(selector));
  for (const btn of buttons) {
    if (btn.dataset.artSkin === "off") continue;
    if (btn.dataset.artSkinned === "1") continue;
    btn.dataset.artSkinned = "1";
    const set = (state: BtnState) => applyButtonSkin(btn, assets, state);
    set("normal");
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
      else set(btn.matches(":hover") ? "hover" : "normal");
    });
    obs.observe(btn, { attributes: true, attributeFilter: ["disabled"] });
  }
}
