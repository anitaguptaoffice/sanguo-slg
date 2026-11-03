import { afterEach, describe, expect, it, vi } from "vitest";
import { joinArtBaseUrl, pickScaleVariant } from "@/engine/artManifest";
import { AssetLoader, resolveArtPackUrl } from "@/engine/AssetLoader";

describe("pickScaleVariant", () => {
  const variants = [
    { scale: 1 as const, path: "textures/1x/a.png" },
    { scale: 2 as const, path: "textures/2x/a.png" },
  ];

  it("picks 2x at DPR >= 1.5", () => {
    expect(pickScaleVariant(variants, 2)?.scale).toBe(2);
    expect(pickScaleVariant(variants, 1.5)?.scale).toBe(2);
  });

  it("picks 1x at DPR 1", () => {
    expect(pickScaleVariant(variants, 1)?.path).toContain("1x");
  });
});

describe("resolveArtPackUrl", () => {
  it("joins base and relative path", () => {
    expect(resolveArtPackUrl("textures/1x/foo.png")).toBe("/assets/art/v1/textures/1x/foo.png");
  });
});

describe("joinArtBaseUrl", () => {
  it("prepends vite base for subpath deploy", () => {
    expect(joinArtBaseUrl("/assets/art/v1/", "/app/", "manifest.json")).toBe("/app/assets/art/v1/manifest.json");
  });
});

describe("optional item icon loading", () => {
  const item = (path = "missing.png") => ({
    id: "item.icon.2001.v1", kind: "icon",
    display_size: { w: 64, h: 64 }, anchor: { x: 32, y: 32 },
    variants: [{ scale: 1, path }, { scale: 2, path: "2x/" + path }],
  });
  const required = (path = "required.png") => ({
    id: "ui.panel.default.v1", kind: "icon",
    display_size: { w: 32, h: 32 }, anchor: { x: 0, y: 0 },
    variants: [{ scale: 1, path }, { scale: 2, path: "2x/" + path }],
  });
  function setup(assets: unknown[], fail: string[] = [], ok = true) {
    const requested: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok, status: ok ? 200 : 503,
      json: async () => ({ schema_version: 1, pack: "shared", base_url: "/assets/art/v1/", assets }),
    }));
    vi.stubGlobal("Image", class {
      onload?: () => void;
      onerror?: () => void;
      set src(url: string) {
        requested.push(url);
        queueMicrotask(() => fail.some((name) => url.endsWith(name)) ? this.onerror?.() : this.onload?.());
      }
    });
    return requested;
  }
  afterEach(() => vi.unstubAllGlobals());

  it.each([1, 2])("loads item icons at DPR %s", async (dpr) => {
    const requested = setup([item("present.png")]);
    const loader = new AssetLoader();
    await loader.loadAll(dpr);
    expect(loader.getImageForAsset("item.icon.2001.v1")?.scale).toBe(dpr);
    expect(requested[0]).toContain(dpr === 2 ? "2x/present.png" : "/present.png");
  });

  it("keeps startup working when an optional item icon fails", async () => {
    setup([item(), required()], ["missing.png"]);
    const loader = new AssetLoader();
    await expect(loader.loadAll(1)).resolves.toBeUndefined();
    expect(loader.getImageForAsset("item.icon.2001.v1")).toBeUndefined();
    expect(loader.getImageForAsset("ui.panel.default.v1")).toBeDefined();
  });

  it("still rejects missing required images", async () => {
    setup([item("present.png"), required()], ["required.png"]);
    await expect(new AssetLoader().loadAll(1)).rejects.toThrow("failed to load art");
  });

  it.each([true, false])("keeps shared paths required regardless of order (%s)", async (itemFirst) => {
    const assets = [item("same.png"), required("same.png")];
    setup(itemFirst ? assets : assets.reverse(), ["same.png"]);
    await expect(new AssetLoader().loadAll(1)).rejects.toThrow("failed to load art");
  });

  it.each([
    { ...item(), id: "hero.icon.2001.v1" },
    { ...item(), kind: "sprite" },
    { ...item(), id: "item.icon.2001.v2" },
  ])("does not make unrelated IDs or kinds optional", async (asset) => {
    setup([asset], ["missing.png"]);
    await expect(new AssetLoader().loadAll(1)).rejects.toThrow("failed to load art");
  });

  it("keeps a path required when it is also used by a button state", async () => {
    const button = { ...required("other.png"), button_states: {
      normal: [{ scale: 1, path: "same.png" }],
    } };
    setup([item("same.png"), button], ["same.png"]);
    await expect(new AssetLoader().loadAll(1)).rejects.toThrow("failed to load art");
  });

  it("still rejects a failed manifest request", async () => {
    setup([], [], false);
    await expect(new AssetLoader().loadAll(1)).rejects.toThrow("art manifest fetch failed: 503");
  });
});
