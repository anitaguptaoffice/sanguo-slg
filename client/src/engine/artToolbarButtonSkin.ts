import type { AssetLoader } from "@/engine/AssetLoader";

const TOOLBAR_BTN_ASSET = "ui.button.toolbar.v1";
const TOOLBAR_LABEL_COLOR = "#F5ECD7";

type BtnState = "normal" | "hover" | "pressed" | "disabled";

function applyToolbarButtonSkin(btn: HTMLButtonElement, assets: AssetLoader, state: BtnState): void {
  const pack = assets.getButtonImage(TOOLBAR_BTN_ASSET, state);
  if (!pack) return;
  const meta = assets.getArtMeta(TOOLBAR_BTN_ASSET);
  const w = meta?.display_size.w ?? 96;
  const artH = meta?.display_size.h ?? 44;
  const h = artH;
  btn.style.backgroundImage = `url(${pack.img.src})`;
  btn.style.backgroundSize = `${w}px ${h}px`;
  btn.style.backgroundRepeat = "no-repeat";
  btn.style.backgroundPosition = "center";
  btn.style.backgroundColor = "transparent";
  btn.style.border = "none";
  btn.style.width = `${w}px`;
  btn.style.height = `${h}px`;
  btn.style.minWidth = `${w}px`;
  btn.style.maxWidth = `${w}px`;
  btn.style.minHeight = `${h}px`;
  btn.style.maxHeight = `${h}px`;
  btn.style.padding = "0";
  btn.style.boxSizing = "border-box";
  btn.style.color = TOOLBAR_LABEL_COLOR;
  btn.style.display = "inline-flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.flexShrink = "0";
  btn.style.cursor = "pointer";
  btn.style.fontSize = "clamp(10px, 1.2vw, 13px)";
  btn.style.lineHeight = "1.15";
  btn.style.textAlign = "center";
  btn.classList.add("toolbar-chrome-btn");
}

/** Bottom toolbar DOM buttons — ui.button.toolbar.v1 four states; labels remain code-drawn. */
export function skinToolbarButtons(
  root: ParentNode,
  assets: AssetLoader,
  selector = ".toolbar-scroll-inner button",
): void {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(selector));
  for (const btn of buttons) {
    if (btn.dataset.artSkin === "off") continue;
    if (btn.dataset.artSkinned === "toolbar") continue;
    btn.dataset.artSkinned = "toolbar";
    const set = (state: BtnState) => applyToolbarButtonSkin(btn, assets, state);
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
