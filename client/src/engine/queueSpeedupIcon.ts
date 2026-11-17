import type { AssetLoader } from "@/engine/AssetLoader";

const HOST = 'button[data-action="speedup-build"][data-queue-speedup-item="2003"]';
const ICON = "queue-speedup-item-icon";
const ASSET = "item.icon.2003.v1";
const failedSource = new WeakMap<HTMLButtonElement, string>();

/** Queue-only decoration. CSS handles skin toggles even after a redraw while off. */
export function mountQueueSpeedupIcon(btn: HTMLButtonElement, assets?: AssetLoader): void {
  if (!btn.matches(HOST)) return;
  const doc = btn.ownerDocument;
  if (!doc.querySelector("style[data-queue-speedup-icons]")) {
    const style = doc.createElement("style");
    style.dataset.queueSpeedupIcons = "";
    style.textContent = `${HOST}{max-width:100%;white-space:normal;overflow-wrap:anywhere}` +
      `${HOST} > .${ICON}{width:20px;height:20px;object-fit:contain;vertical-align:middle;margin-inline-end:4px;pointer-events:none}` +
      `[data-art-skin="off"] .${ICON}{display:none}`;
    doc.head.appendChild(style);
  }
  const existing = btn.querySelector<HTMLImageElement>(`.${ICON}`);
  const entry = assets?.getImageForAsset(ASSET);
  const source = entry?.img.getAttribute("src")?.trim();
  if (!entry || entry.meta.id !== ASSET || entry.meta.kind !== "icon" || !source ||
      failedSource.get(btn) === entry.img.src) {
    existing?.remove();
    return;
  }
  if (existing?.src === entry.img.src) return;
  existing?.remove();
  const img = doc.createElement("img");
  img.className = ICON;
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.width = img.height = 20;
  img.addEventListener("error", () => {
    if (img.parentElement !== btn) return;
    failedSource.set(btn, img.src);
    img.remove();
  }, { once: true });
  img.src = entry.img.src;
  btn.prepend(img);
}
