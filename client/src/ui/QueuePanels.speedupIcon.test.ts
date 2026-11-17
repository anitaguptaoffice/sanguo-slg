import { afterEach, expect, it, vi } from "vitest";
import { BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID, QueuePanels } from "./QueuePanels";
import { skinPrimaryButtons } from "@/engine/artButtonSkin";
import type { AssetLoader } from "@/engine/AssetLoader";

const panels: QueuePanels[] = [];
afterEach(() => { panels.splice(0).forEach((p) => p.detach()); document.body.innerHTML = ""; });
const flush = () => new Promise((r) => setTimeout(r, 0));
function setup(quantity = 2, available = true) {
  const session: any = { serverId: 1, player: { player_id: 1 }, cityId: 1,
    buildings: [{ slot_key: "farm", level: 1, upgrade_finish_at_ms: Date.now() + 120000 }],
    bag: [{ item_cfg_id: BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID, quantity }], wallet: {}, cityTroops: [] };
  const gateway = { getSessionGeneration: () => 1, useConsumable: vi.fn(),
    getCityState: vi.fn().mockResolvedValue({ buildings: session.buildings }) };
  const img = document.createElement("img"); img.src = "/cached.png";
  const assets = { getImageForAsset: vi.fn(() => available
    ? { img, meta: { id: "item.icon.2003.v1", kind: "icon" }, scale: 1 } : undefined),
    getButtonImage: vi.fn(() => undefined), getArtMeta: vi.fn(() => undefined) } as unknown as AssetLoader;
  const mount = document.createElement("div"); document.body.append(mount);
  const reskin = (root: HTMLElement) => skinPrimaryButtons(root, assets);
  const panel = new QueuePanels(mount, gateway as never, () => session, { farm: "农田" },
    vi.fn(), vi.fn(), vi.fn(), undefined, undefined, reskin);
  panels.push(panel); panel.attach(); panel.open();
  const button = () => mount.querySelector<HTMLButtonElement>('[data-action="speedup-build"]')!;
  return { session, gateway, assets, mount, panel, button, reskin };
}

it.each([0, 2])("preserves mounted label, title, disabled and original item identity at stock %s", (quantity) => {
  const s = setup(quantity), btn = s.button();
  expect(btn.dataset.queueSpeedupItem).toBe(String(BUILD_QUEUE_SPEEDUP_ITEM_CFG_ID));
  expect(btn.textContent).toBe("使用短促工符");
  expect(btn.disabled).toBe(quantity === 0);
  expect(btn.title).toBe(quantity === 0 ? "背包中无短促工符（道具 2003）" : "");
  expect(btn.querySelectorAll("img")).toHaveLength(1);
  expect(s.gateway.useConsumable).not.toHaveBeenCalled();
});

it("survives actual refresh, off redraw, reopen and reskin without mutation", async () => {
  const s = setup();
  const old = s.button();
  s.mount.dataset.artSkin = "off";
  s.mount.querySelector<HTMLButtonElement>('[data-action="refresh-queue"]')!.click();
  await flush();
  expect(s.gateway.getCityState).toHaveBeenCalledTimes(1);
  expect(s.button()).not.toBe(old);
  const img = s.button().querySelector("img")!;
  expect(getComputedStyle(img).display).toBe("none");
  s.mount.dataset.artSkin = "on";
  expect(getComputedStyle(img).display).not.toBe("none");
  for (let i = 0; i < 4; i++) {
    s.reskin(s.panel.getRoot()); s.panel.toggle(); s.panel.open();
    expect(s.button().querySelectorAll("img")).toHaveLength(1);
    expect(s.button().textContent).toBe("使用短促工符");
  }
  expect(s.mount.querySelectorAll("img")).toHaveLength(1);
  expect(s.gateway.useConsumable).not.toHaveBeenCalled();
});

it("keeps mounted queue functional without cache and after DOM image error", () => {
  const s = setup(0, false);
  expect(s.button().querySelector("img")).toBeNull();
  s.panel.toggle(); s.panel.open();
  expect(s.button().disabled).toBe(true);
  const other = setup();
  other.button().querySelector("img")!.dispatchEvent(new Event("error"));
  other.reskin(other.panel.getRoot());
  expect(other.button().querySelector("img")).toBeNull();
  expect(other.button().textContent).toBe("使用短促工符");
  expect(other.gateway.useConsumable).not.toHaveBeenCalled();
});

it.each(["id", "kind", "source", "cache"])("falls back on mounted reskin with invalid %s", (field) => {
  const s = setup();
  const img = document.createElement("img"); img.src = "/wrong.png";
  const entry = { img, meta: { id: "item.icon.2003.v1", kind: "icon" }, scale: 1 as const };
  if (field === "id") entry.meta.id = "item.icon.2001.v1";
  if (field === "kind") entry.meta.kind = "panel";
  if (field === "source") img.setAttribute("src", "");
  vi.mocked(s.assets.getImageForAsset).mockReturnValue(
    field === "cache" ? undefined : entry as never,
  );
  s.reskin(s.panel.getRoot());
  expect(s.button().querySelector("img")).toBeNull();
  expect(s.button().textContent).toBe("使用短促工符");
  expect(s.button().disabled).toBe(false);
  s.panel.toggle(); s.panel.open();
  expect(s.button().querySelector("img")).toBeNull();
  expect(s.gateway.useConsumable).not.toHaveBeenCalled();
});
