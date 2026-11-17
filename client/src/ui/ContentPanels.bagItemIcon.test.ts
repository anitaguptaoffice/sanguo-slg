import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { ContentPanels } from "./ContentPanels";

beforeEach(() => sessionStorage.clear());

async function setup(scale: 1 | 2 = 1, skinOff = false, withAssets = true) {
  const session: MainCitySession = {
    serverId: 1, cityId: 1, cityName: "城", player: { player_id: 1 },
    wallet: { food: 100 }, buildings: [], cityTroops: [],
    bag: [{ item_cfg_id: 2001, quantity: 2 }, { item_cfg_id: 9999, quantity: 3 }],
  };
  const list = vi.fn(async () => ({ items: session.bag }));
  const gateway = { getBoundServerId: () => 1, listPlayerBag: list } as unknown as GatewayPort;
  const mount = document.createElement("div");
  if (skinOff) mount.dataset.artSkin = "off";
  const cached = document.createElement("img");
  cached.src = `/assets/art/v1/textures/${scale}x/items/2001.png`;
  const getImageForAsset = vi.fn((id: string) => id === "item.icon.2001.v1"
    ? { img: cached, scale } : undefined);
  const assets = { getImageForAsset } as unknown as Pick<AssetLoader, "getImageForAsset">;
  const panels = new ContentPanels(mount, gateway, () => session, () => {}, vi.fn(), undefined, withAssets ? assets : undefined);
  panels.attach();
  panels.toggleBag();
  await vi.waitFor(() => expect(list).toHaveBeenCalled());
  await vi.waitFor(() => expect(mount.querySelector('[data-item-cfg-id="2001"]')).not.toBeNull());
  return { mount, panels, cached, getImageForAsset, list };
}

describe("bag item icon mount", () => {
  it.each([1, 2] as const)("uses the already selected DPR %s source without moving the cached image", async (scale) => {
    const f = await setup(scale);
    const row = f.mount.querySelector('[data-item-cfg-id="2001"]')!;
    const icon = row.querySelector<HTMLImageElement>(".bag-item-icon")!;
    expect(icon).not.toBe(f.cached);
    expect(icon.src).toBe(f.cached.src);
    expect(icon.alt).toBe("");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(row.querySelector(".bag-stack-name")?.textContent).toBe("谷袋·初备");
    expect(row.querySelector(".bag-stack-qty")?.textContent).toContain("2");
    expect(f.mount.querySelector('[data-item-cfg-id="9999"] .bag-item-icon')).toBeNull();
  });

  it("keeps text when an icon errors", async () => {
    const f = await setup();
    const row = f.mount.querySelector('[data-item-cfg-id="2001"]')!;
    row.querySelector<HTMLImageElement>(".bag-item-icon")!.dispatchEvent(new Event("error"));
    expect(row.querySelector(".bag-item-icon")).toBeNull();
    expect(row.querySelector(".bag-stack-name")?.textContent).toBe("谷袋·初备");
    expect(row.querySelector(".bag-stack-qty")?.textContent).toContain("2");
  });

  it("works with no loader or with art disabled", async () => {
    const a = await setup(1, false, false);
    expect(a.mount.querySelector(".bag-item-icon")).toBeNull();
    const b = await setup(1, true);
    expect(b.mount.querySelector(".bag-item-icon")).toBeNull();
    expect(b.getImageForAsset).not.toHaveBeenCalled();
  });

  it("does not accumulate icons across refresh and reopening", async () => {
    const f = await setup();
    f.mount.querySelector<HTMLButtonElement>('[data-action="refresh-bag"]')!.click();
    await vi.waitFor(() => expect(f.list.mock.calls.length).toBeGreaterThanOrEqual(2));
    await vi.waitFor(() => expect(f.mount.querySelectorAll('[data-item-cfg-id="2001"] .bag-item-icon')).toHaveLength(1));
    f.panels.toggleBag();
    f.panels.toggleBag();
    await vi.waitFor(() => expect(f.list.mock.calls.length).toBeGreaterThanOrEqual(3));
    await vi.waitFor(() => expect(f.mount.querySelectorAll('[data-item-cfg-id="2001"] .bag-item-icon')).toHaveLength(1));
  });

  it("preserves one icon across category switches and clears it when disabled before rerender", async () => {
    const f = await setup();
    f.mount.querySelector<HTMLButtonElement>('[data-bag-category="cultivation"]')!.click();
    expect(f.mount.querySelector('[data-item-cfg-id="2001"]')).toBeNull();
    f.mount.querySelector<HTMLButtonElement>('[data-bag-category="consumable"]')!.click();
    expect(f.mount.querySelectorAll('[data-item-cfg-id="2001"] .bag-item-icon')).toHaveLength(1);
    f.mount.dataset.artSkin = "off";
    f.mount.querySelector<HTMLButtonElement>('[data-action="refresh-bag"]')!.click();
    await vi.waitFor(() => expect(f.list.mock.calls.length).toBeGreaterThanOrEqual(2));
    await vi.waitFor(() => expect(f.mount.querySelector(".bag-item-icon")).toBeNull());
    expect(f.mount.querySelector('[data-item-cfg-id="2001"] .bag-stack-name')?.textContent).toBe("谷袋·初备");
  });
});
