import { afterEach, expect, it, vi } from "vitest";
import { QueuePanels } from "./QueuePanels";
import { skinPrimaryButtons } from "@/engine/artButtonSkin";
import type { AssetLoader } from "@/engine/AssetLoader";

const panels: QueuePanels[] = [];
afterEach(() => { panels.splice(0).forEach((p) => p.detach()); document.body.innerHTML = ""; vi.useRealTimers(); });
const flush = () => new Promise((r) => setTimeout(r, 0));
function setup() {
  let generation = 1;
  let session: any = { serverId: 1, player: { player_id: 1 }, cityId: 1,
    buildings: [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: Date.now() + 30000 }],
    bag: [{ item_cfg_id: 2003, quantity: 2 }], wallet: {}, cityTroops: [] };
  const quests: any[] = [{ quest_cfg_id: 1032, state: 2, progress_current: 0, progress_target: 2 }];
  const gateway = { getSessionGeneration: () => generation, useConsumable: vi.fn(),
    listPlayerBag: vi.fn(), getCityState: vi.fn().mockImplementation(async () => ({ buildings: session.buildings })) };
  const img = document.createElement("img"); img.src = "/cached.png";
  const assets = { getImageForAsset: vi.fn(() => ({ img, meta: { id: "item.icon.2003.v1", kind: "icon" }, scale: 1 })),
    getButtonImage: vi.fn(() => undefined), getArtMeta: vi.fn(() => undefined) } as unknown as AssetLoader;
  const mount = document.createElement("div"); document.body.append(mount);
  const panel = new QueuePanels(mount, gateway as never, () => session, { farm: "农田" },
    vi.fn(), vi.fn(), vi.fn(), () => quests, vi.fn(), (root) => skinPrimaryButtons(root, assets));
  panels.push(panel); panel.attach(); panel.open();
  const button = () => mount.querySelector<HTMLButtonElement>('[data-action="speedup-build"]')!;
  const row = () => button()?.parentElement!;
  return { session, quests, gateway, assets, mount, panel, button, row,
    relogin: () => generation++, replaceSession: (s: any) => { session = s; } };
}

it("keeps focused row/button/image connected on ticks and new unchanged building snapshots", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-12T12:00:00Z"));
  const s = setup(), row = s.row(), button = s.button(), image = button.querySelector("img");
  const label = row.textContent, progress = row.querySelector<HTMLElement>(".queue-row-progress-fill")?.style.width;
  button.focus();
  const observer = new MutationObserver(() => {});
  observer.observe(s.mount, { childList: true, subtree: true });
  vi.setSystemTime(Date.now() + 5000);
  s.session.buildings = s.session.buildings.map((b: any) => ({ ...b }));
  s.panel.tick(1);
  expect(s.row()).toBe(row); expect(s.button()).toBe(button);
  expect(button.querySelector("img")).toBe(image); expect(document.activeElement).toBe(button);
  expect(row.isConnected && button.isConnected && image!.isConnected).toBe(true);
  const removed = observer.takeRecords().flatMap((r) => Array.from(r.removedNodes));
  expect(removed).not.toContain(row); expect(removed).not.toContain(button); expect(removed).not.toContain(image);
  observer.disconnect();
  expect(row.textContent).not.toBe(label);
  expect(row.querySelector<HTMLElement>(".queue-row-progress-fill")?.style.width).not.toBe(progress);
  const add = vi.spyOn(button, "addEventListener");
  for (let i = 0; i < 3; i++) s.panel.tick(1);
  expect(add).not.toHaveBeenCalled();
  expect(button.dataset.artSkinned).toBe("1");
  row.focus(); s.panel.tick(1); expect(document.activeElement).toBe(row);
});

it("refreshes stock/title, quest progress/actions and row selection without replacing the speedup host", () => {
  const s = setup(), row = s.row(), button = s.button();
  expect(row.textContent).toContain("日课 0/2");
  s.quests[0].progress_current = 1; s.session.bag = [];
  s.panel.openAndHighlightBuildSlot("farm");
  expect(s.row()).toBe(row); expect(s.button()).toBe(button);
  expect(row.classList.contains("selected")).toBe(true);
  expect(row.textContent).toContain("日课 1/2");
  expect(button.disabled).toBe(true); expect(button.title).toContain("背包中无");
  button.click(); expect(s.gateway.useConsumable).not.toHaveBeenCalled();
  s.quests.splice(0); s.session.bag = [{ item_cfg_id: 2003, quantity: 1 }];
  s.panel.clearBuildSlotHighlight();
  expect(row.querySelector('[data-action="daily-build-next"]')).toBeNull();
  expect(row.classList.contains("selected")).toBe(false);
  expect(button.disabled).toBe(false); expect(button.title).toBe("");
  expect(s.button()).toBe(button);
});

it("updates busy and unknown-receipt guards on retained button, without repeat consumption", async () => {
  const s = setup(), button = s.button();
  let reject!: (e: Error) => void;
  s.gateway.useConsumable.mockReturnValue(new Promise((_, r) => { reject = r; }));
  button.click();
  expect(s.button()).toBe(button); expect(button.disabled).toBe(true);
  button.click(); expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1);
  reject(new Error("unknown receipt")); await flush();
  expect(s.button()).toBe(button); expect(button.disabled).toBe(true);
  s.panel.tick(1); button.click();
  expect(s.gateway.useConsumable).toHaveBeenCalledTimes(1);
});

it.each(["finish", "level", "cfg", "slot", "addition", "duplicate", "invalid", "unknown-cfg", "session", "actor", "relogin", "detach", "shape"])(
  "replaces rather than reusing across %s invalidation", (change) => {
    const s = setup(), row = s.row(), b = s.session.buildings[0];
    if (change === "finish") b.upgrade_finish_at_ms += 1000;
    if (change === "level") b.level++;
    if (change === "cfg") b.building_cfg_id = 3;
    if (change === "slot") b.slot_key = "lumber";
    if (change === "addition") s.session.buildings.push({ ...b, slot_key: "hall" });
    if (change === "duplicate") s.session.buildings.push({ ...b });
    if (change === "invalid") b.building_cfg_id = -1;
    if (change === "unknown-cfg") b.building_cfg_id = 999;
    if (change === "session") s.replaceSession({ ...s.session });
    if (change === "actor") s.session.player.player_id++;
    if (change === "relogin") s.relogin();
    if (change === "shape") s.button().remove();
    if (change === "detach") { s.panel.detach(); s.panel.attach(); s.panel.open(); }
    else s.panel.tick(1);
    expect(s.row()).not.toBe(row); expect(row.isConnected).toBe(false);
    expect(s.gateway.useConsumable).not.toHaveBeenCalled();
  },
);

it("rebuilds changed order, removal, completion and no-session state", () => {
  const s = setup(), first = s.session.buildings[0];
  s.session.buildings.push({ ...first, slot_key: "hall" }); s.panel.tick(1);
  let row = s.row();
  s.session.buildings.reverse(); s.panel.tick(1);
  expect(s.row()).not.toBe(row); expect(row.isConnected).toBe(false);
  row = s.row(); s.session.buildings.pop(); s.panel.tick(1);
  expect(s.row()).not.toBe(row);
  row = s.row(); s.session.buildings[0].upgrade_finish_at_ms = Date.now() - 1;
  s.panel.tick(1); expect(row.isConnected).toBe(false); expect(s.button()).toBeNull();
  s.replaceSession(null); s.panel.tick(1); expect(s.button()).toBeNull();
});

it("loading/error/recovery uses existing replacement behavior", async () => {
  const s = setup(), row = s.row();
  s.gateway.getCityState.mockRejectedValueOnce(new Error("offline"));
  s.mount.querySelector<HTMLButtonElement>('[data-action="refresh-queue"]')!.click();
  expect(row.isConnected).toBe(false); expect(s.button()).toBeNull();
  await flush(); expect(s.button()).toBeNull();
  s.mount.querySelector<HTMLButtonElement>('[data-action="retry-refresh-queue-build"]')!.click();
  await flush(); expect(s.button()).not.toBeNull(); expect(s.row()).not.toBe(row);
  const recovered = s.row(); s.panel.tick(1); expect(s.row()).toBe(recovered);
  expect(s.gateway.useConsumable).not.toHaveBeenCalled();
});

it("preserves skin-off/restoration and failed-image ownership across retained ticks", () => {
  const s = setup(), button = s.button(), image = button.querySelector("img")!;
  s.mount.dataset.artSkin = "off"; s.panel.tick(1);
  expect(button.querySelector("img")).toBe(image); expect(getComputedStyle(image).display).toBe("none");
  s.mount.dataset.artSkin = "on"; expect(getComputedStyle(image).display).not.toBe("none");
  image.dispatchEvent(new Event("error")); s.panel.tick(1);
  expect(s.button()).toBe(button); expect(button.querySelector("img")).toBeNull();
  vi.mocked(s.assets.getImageForAsset).mockReturnValue(undefined); s.panel.tick(1);
  expect(button.textContent).toBe("使用短促工符");
  expect(s.gateway.useConsumable).not.toHaveBeenCalled();
});

it("keeps completed-todo rows on the replacement path", () => {
  const s = setup(), row = s.row();
  s.panel.setBuildCompleteTodoSlots(["hall"]);
  expect(row.isConnected).toBe(false);
  const mixed = s.row(); s.panel.tick(1);
  expect(s.row()).not.toBe(mixed);
  expect(s.mount.querySelector(".queue-build-complete-todo")).not.toBeNull();
});
