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
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

  function manualImages(assets: unknown[]) {
    setup(assets);
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const images: ManualImage[] = [];
    class ManualImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      removeAttribute = vi.fn();
      constructor() { images.push(this); }
    }
    vi.stubGlobal("Image", ManualImage);
    return images;
  }

  it("expires an optional image at 15 seconds and discards late callbacks after retry", async () => {
    const images = manualImages([item()]);
    const loader = new AssetLoader();
    const completed = vi.fn();
    const first = loader.loadAll(1).then(completed);
    await vi.advanceTimersByTimeAsync(14_999);
    const old = images[0];
    const late = old.onload;
    expect(completed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(completed).toHaveBeenCalledOnce();
    await first;
    expect(old.removeAttribute).toHaveBeenCalledWith("src");
    expect(old.onload).toBeNull();
    expect(old.onerror).toBeNull();
    expect(loader.getImageForAsset("item.icon.2001.v1")).toBeUndefined();

    const retry = loader.loadAll(1);
    await vi.advanceTimersByTimeAsync(0);
    images[1].onload?.();
    await retry;
    late?.();
    expect(loader.getImageForAsset("item.icon.2001.v1")?.img).toBe(images[1]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["item first", "required first", "button state"])("keeps a shared %s path waiting past the optional deadline", async (mode) => {
    const shared = required("same.png");
    const icon = item("same.png");
    const assets = mode === "button state"
      ? [icon, { ...required(), button_states: { normal: [{ scale: 1, path: "same.png" }] } }]
      : mode === "item first" ? [icon, shared] : [shared, icon];
    const images = manualImages(assets);
    const completed = vi.fn();
    const result = new AssetLoader().loadAll(1).then(completed);
    const rejected = expect(result).rejects.toThrow("failed to load art");
    await vi.advanceTimersByTimeAsync(30_000);
    expect(completed).not.toHaveBeenCalled();
    expect(images[0].removeAttribute).not.toHaveBeenCalled();
    images[0].onerror?.();
    await rejected;
  });

  it.each([true, false])("clears the timer after a synchronous src failure (optional %s)", async (optional) => {
    manualImages([optional ? item() : required()]);
    vi.stubGlobal("Image", class {
      set src(_value: string) { throw new Error("src unavailable"); }
    });
    const result = new AssetLoader().loadAll(1);
    if (optional) await expect(result).resolves.toBeUndefined();
    else await expect(result).rejects.toThrow("src unavailable");
    expect(vi.getTimerCount()).toBe(0);
  });
});
