import { describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import {
  mountToolbarIcons,
  resolveToolbarIconPack,
  TOOLBAR_ICON_BY_ACTION,
} from "@/engine/artToolbarIconSkin";
import { syncToolbarAriaExpanded } from "@/ui/toolbarAriaExpanded";

function mockImg(src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7") {
  const img = document.createElement("img");
  img.src = src;
  return img;
}

function mockAssets(opts?: { withButtonStates?: boolean }): AssetLoader {
  const withStates = opts?.withButtonStates ?? false;
  const getButtonImage = vi.fn((id: string, state: string) => {
    if (!id.startsWith("ui.icon.toolbar.") && !id.startsWith("ui.icon.action.")) return undefined;
    if (!withStates) return undefined;
    const img = mockImg(`data:image/gif;base64,${state}`);
    return { img, scale: 1 as const };
  });
  const getImageForAsset = vi.fn((id: string) =>
    id.startsWith("ui.icon.toolbar.") || id.startsWith("ui.icon.action.")
      ? {
          img: mockImg(),
          meta: { id, display_size: { w: 32, h: 32 } },
          scale: 1 as const,
        }
      : undefined,
  );
  return {
    getButtonImage,
    getImageForAsset,
    getArtMeta: vi.fn((id: string) =>
      id.startsWith("ui.icon.toolbar.") || id.startsWith("ui.icon.action.")
        ? { id, display_size: { w: 32, h: 32 } }
        : undefined,
    ),
  } as unknown as AssetLoader;
}

describe("resolveToolbarIconPack", () => {
  it("prefers button_states over variants", () => {
    const assets = mockAssets({ withButtonStates: true });
    const hover = resolveToolbarIconPack(assets, "ui.icon.toolbar.mail.v1", "hover");
    expect(hover?.img.src).toContain("hover");
    expect(assets.getButtonImage).toHaveBeenCalledWith("ui.icon.toolbar.mail.v1", "hover");
  });

  it("falls back to variants for normal/hover/pressed", () => {
    const assets = mockAssets();
    const pack = resolveToolbarIconPack(assets, "ui.icon.toolbar.mail.v1", "pressed");
    expect(pack?.img.src).toContain("data:image");
    expect(assets.getImageForAsset).toHaveBeenCalledWith("ui.icon.toolbar.mail.v1");
  });
});

describe("mountToolbarIcons", () => {
  it("maps sixteen toolbar actions to two-character labels and icon nodes", () => {
    expect(Object.keys(TOOLBAR_ICON_BY_ACTION)).toHaveLength(16);
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="toolbar-scroll-inner">
        <button type="button" data-action="toggle-military">军事</button>
        <button type="button" data-action="toggle-mail"><span class="toolbar-btn-label">邮件</span></button>
      </div>`;
    mountToolbarIcons(root, mockAssets());
    const military = root.querySelector('[data-action="toggle-military"]')!;
    expect(military.querySelector(".toolbar-btn-icon")).toBeTruthy();
    expect(military.querySelector(".toolbar-btn-label")?.textContent).toBe("军事");
    expect(military.getAttribute("aria-label")).toBe("军事");
    expect(military.getAttribute("title")).toBe("军事");
    const mail = root.querySelector('[data-action="toggle-mail"]')!;
    expect(mail.querySelector(".toolbar-btn-icon")?.getAttribute("src")).toContain("data:image");
    expect(TOOLBAR_ICON_BY_ACTION["toggle-reports"]).toEqual({
      assetId: "ui.icon.toolbar.report.v1",
      label: "战报",
      title: "战报",
    });
  });

  it("maps upgrade-farm action icon with two-char label and four-char title/aria", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="toolbar-scroll-inner">
        <button type="button" data-action="upgrade-farm" title="升级农田">升级农田</button>
      </div>`;
    mountToolbarIcons(root, mockAssets());
    const upgrade = root.querySelector('[data-action="upgrade-farm"]')!;
    expect(TOOLBAR_ICON_BY_ACTION["upgrade-farm"]).toEqual({
      assetId: "ui.icon.action.upgrade.v1",
      label: "升级",
      title: "升级农田",
    });
    expect(upgrade.querySelector(".toolbar-btn-icon")).toBeTruthy();
    expect(upgrade.querySelector(".toolbar-btn-label")?.textContent).toBe("升级");
    expect(upgrade.getAttribute("aria-label")).toBe("升级农田");
    expect(upgrade.getAttribute("title")).toBe("升级农田");
  });

  it("maps refresh action icon with two-char label and four-char title/aria", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="toolbar-scroll-inner">
        <button type="button" data-action="refresh" title="刷新状态">刷新状态</button>
      </div>`;
    mountToolbarIcons(root, mockAssets());
    const refresh = root.querySelector('[data-action="refresh"]')!;
    expect(TOOLBAR_ICON_BY_ACTION.refresh).toEqual({
      assetId: "ui.icon.action.refresh.v1",
      label: "刷新",
      title: "刷新状态",
    });
    expect(refresh.querySelector(".toolbar-btn-icon")).toBeTruthy();
    expect(refresh.querySelector(".toolbar-btn-label")?.textContent).toBe("刷新");
    expect(refresh.getAttribute("aria-label")).toBe("刷新状态");
    expect(refresh.getAttribute("title")).toBe("刷新状态");
  });

  it("skips icon mount when data-art-skin=off", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="toolbar-scroll-inner">
        <button type="button" data-action="toggle-mail" data-art-skin="off"><span class="toolbar-btn-label">邮件</span></button>
      </div>`;
    mountToolbarIcons(root, mockAssets());
    const mail = root.querySelector('[data-action="toggle-mail"]')!;
    expect(mail.querySelector(".toolbar-btn-icon")).toBeNull();
    expect(mail.classList.contains("toolbar-chrome-btn--with-icon")).toBe(false);
    expect(mail.querySelector(".toolbar-btn-label")?.textContent).toBe("邮件");
  });

  it("updates icon src on hover and disabled via four-state wiring", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="toolbar-scroll-inner">
        <button type="button" data-action="toggle-military">军事</button>
      </div>`;
    const assets = mockAssets({ withButtonStates: true });
    mountToolbarIcons(root, assets);
    const btn = root.querySelector<HTMLButtonElement>('[data-action="toggle-military"]')!;
    const icon = btn.querySelector<HTMLImageElement>(".toolbar-btn-icon")!;
    expect(icon.dataset.toolbarIconState).toBe("normal");

    btn.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    expect(icon.dataset.toolbarIconState).toBe("hover");
    expect(assets.getButtonImage).toHaveBeenCalledWith("ui.icon.toolbar.military.v1", "hover");

    btn.disabled = true;
    await new Promise((r) => queueMicrotask(r));
    expect(icon.dataset.toolbarIconState).toBe("disabled");
    expect(btn.classList.contains("toolbar-chrome-btn--disabled-icon")).toBe(true);
  });

  it("does not clear aria-expanded set by toolbarAriaExpanded", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="toolbar-scroll-inner">
        <button type="button" data-action="toggle-mail"><span class="toolbar-btn-label">邮件</span></button>
      </div>`;
    mountToolbarIcons(root, mockAssets());
    syncToolbarAriaExpanded(root, {
      military: false,
      reports: false,
      marches: false,
      chat: false,
      guild: false,
      rank: false,
      quest: false,
      daily: false,
      bag: false,
      shop: false,
      hero: false,
      mail: true,
      world: false,
      queue: false,
    });
    expect(root.querySelector('[data-action="toggle-mail"]')?.getAttribute("aria-expanded")).toBe("true");
  });
});
