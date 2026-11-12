import { afterEach, expect, it, vi } from "vitest";
import { mountQueueSpeedupIcon } from "./queueSpeedupIcon";
import { skinPrimaryButtons } from "./artButtonSkin";
import type { AssetLoader } from "./AssetLoader";

afterEach(() => { document.body.innerHTML = ""; });
function setup() {
  const root = document.createElement("div");
  root.innerHTML = '<button class="art-btn-primary" data-action="speedup-build" data-queue-speedup-item="2003">使用短促工符</button><button class="art-btn-primary">其他</button>';
  document.body.append(root);
  const btn = root.firstElementChild as HTMLButtonElement;
  const img = document.createElement("img"); img.src = "/cached-item.png";
  const entry = { img, meta: { id: "item.icon.2003.v1", kind: "icon" }, scale: 2 };
  const assets = {
    getImageForAsset: vi.fn(() => entry),
    getButtonImage: vi.fn(() => undefined),
    getArtMeta: vi.fn(() => undefined),
  } as unknown as AssetLoader;
  return { root, btn, entry, assets };
}

it("shares primary skin without changing other buttons, focus, text or listeners", () => {
  const s = setup(), click = vi.fn();
  s.btn.addEventListener("click", click); s.btn.focus();
  for (let i = 0; i < 5; i++) skinPrimaryButtons(s.root, s.assets);
  expect(s.btn.querySelectorAll("img")).toHaveLength(1);
  expect(s.root.lastElementChild!.querySelector("img")).toBeNull();
  expect(document.activeElement).toBe(s.btn);
  expect(s.btn.textContent).toBe("使用短促工符");
  expect(click).not.toHaveBeenCalled();
  const img = s.btn.querySelector("img")!;
  expect(img.alt).toBe(""); expect(img.getAttribute("aria-hidden")).toBe("true");
  expect(img.hasAttribute("tabindex")).toBe(false);
  expect(getComputedStyle(img).pointerEvents).toBe("none");
  expect(getComputedStyle(img).width).toBe("20px");
  expect(getComputedStyle(img).height).toBe("20px");
  expect(getComputedStyle(img).objectFit).toBe("contain");
  expect(s.assets.getImageForAsset).toHaveBeenCalledWith("item.icon.2003.v1");
});

it.each(["missing", "wrong-id", "wrong-kind", "empty", "whitespace", "unknown-marker", "wrong-action"])(
  "keeps text-only fallback for %s", (mode) => {
    const s = setup();
    if (mode === "wrong-id") s.entry.meta.id = "item.icon.2001.v1";
    if (mode === "wrong-kind") s.entry.meta.kind = "panel";
    if (mode === "empty") s.entry.img.removeAttribute("src");
    if (mode === "whitespace") s.entry.img.setAttribute("src", " ");
    if (mode === "unknown-marker") s.btn.dataset.queueSpeedupItem = "2001";
    if (mode === "wrong-action") s.btn.dataset.action = "other";
    if (mode === "missing") vi.mocked(s.assets.getImageForAsset).mockReturnValue(undefined);
    mountQueueSpeedupIcon(s.btn, s.assets);
    expect(s.btn.querySelector("img")).toBeNull();
    expect(s.btn.textContent).toBe("使用短促工符");
  },
);

it("removes stale or failed decoration and does not retry the same broken source on reskin", () => {
  const s = setup();
  mountQueueSpeedupIcon(s.btn, s.assets);
  s.btn.querySelector("img")!.dispatchEvent(new Event("error"));
  mountQueueSpeedupIcon(s.btn, s.assets);
  expect(s.btn.querySelector("img")).toBeNull();
  s.entry.img.src = "/recovered.png";
  mountQueueSpeedupIcon(s.btn, s.assets);
  expect(s.btn.querySelector("img")!.src).toContain("/recovered.png");
  mountQueueSpeedupIcon(s.btn);
  expect(s.btn.querySelector("img")).toBeNull();
  expect(s.btn.textContent).toBe("使用短促工符");
});

it("hides immediately on ancestor or own skin-off and restores without reskin", () => {
  const s = setup();
  s.root.dataset.artSkin = "off";
  skinPrimaryButtons(s.root, s.assets);
  const img = s.btn.querySelector("img")!;
  expect(getComputedStyle(img).display).toBe("none");
  s.root.dataset.artSkin = "on";
  expect(getComputedStyle(img).display).not.toBe("none");
  s.btn.dataset.artSkin = "off";
  expect(getComputedStyle(img).display).toBe("none");
  skinPrimaryButtons(s.root, s.assets);
  s.btn.dataset.artSkin = "on";
  expect(s.btn.querySelector("img")).toBe(img);
  expect(getComputedStyle(img).display).not.toBe("none");
});

it.each([false, true])("ignores stale detached errors (current source failed: %s)", (failed) => {
  const s = setup(), mount = () => mountQueueSpeedupIcon(s.btn, s.assets);
  mount();
  const old = s.btn.querySelector("img")!;
  s.entry.img.src = "/new.png"; mount();
  if (failed) s.btn.querySelector("img")!.dispatchEvent(new Event("error"));
  else { s.entry.img.src = "/cached-item.png"; mount(); }
  const current = s.btn.querySelector("img");
  old.dispatchEvent(new Event("error")); mount();
  expect(s.btn.querySelector("img")).toBe(current);
});
