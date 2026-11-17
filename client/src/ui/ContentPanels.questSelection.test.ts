import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ContentPanels } from "./ContentPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
const cleanup: Array<() => void> = [];
const flush = () => new Promise(r => setTimeout(r, 0));
const rows = [{ quest_cfg_id: 1001, quest_code: "tutorial_hall_2", state: 4 },
  { quest_cfg_id: 1002, quest_code: "tutorial_recruit", state: 3, progress_current: 1, progress_target: 1 },
  { quest_cfg_id: 1003, quest_code: "tutorial_next", state: 1 }];
beforeEach(() => sessionStorage.clear());
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); document.body.innerHTML = ""; });
async function setup(quests: unknown[] = rows) {
  const mount = document.createElement("div"); document.body.append(mount);
  const gateway = { getBoundServerId: () => 1,
    listPlayerQuests: vi.fn(async () => ({ quests })),
    acceptQuest: vi.fn(async () => ({})),
    claimQuestReward: vi.fn(() => new Promise(() => {})),
  };
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: {}, bag: [], buildings: [] } as unknown as MainCitySession;
  const panel = new ContentPanels(mount, gateway as unknown as GatewayPort, () => session, vi.fn(), vi.fn());
  panel.attach(); panel.toggleQuest(); cleanup.push(() => panel.detach()); await flush();
  const input = mount.querySelector<HTMLInputElement>('[data-field="quest-id"]')!;
  const select = (id: number) => mount.querySelector<HTMLButtonElement>(`button[data-action="select-quest"][data-quest-id="${id}"]`);
  const action = (name: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!.click();
  return { panel, mount, gateway, input, select, action };
}
it("shows native selection controls and visible/accessibility selected state", async () => {
  const f = await setup(); const button = f.select(1002);
  expect(button).not.toBeNull(); expect(button!.type).toBe("button");
  expect(button!.getAttribute("aria-label")).toContain("1002"); expect(button!.getAttribute("aria-pressed")).toBe("false");
  button!.focus(); button!.click(); expect(document.activeElement).toBe(button);
  expect(f.input.value).toBe("1002"); expect(button!.getAttribute("aria-pressed")).toBe("true"); expect(button!.textContent).toContain("已选");
  expect(f.select(1001)!.getAttribute("aria-pressed")).toBe("false");
  expect(f.gateway.acceptQuest).not.toHaveBeenCalled(); expect(f.gateway.claimQuestReward).not.toHaveBeenCalled();
});
it("selecting a claimable row then explicit claim dispatches that ID", async () => {
  const f = await setup(); expect(f.select(1002)).not.toBeNull(); f.select(1002)!.click(); f.action("claim-quest");
  expect(f.gateway.claimQuestReward).toHaveBeenCalledExactlyOnceWith(1, 1002);
});
it("selecting a future/available row does not bypass server acceptance rules", async () => {
  const f = await setup(); expect(f.select(1003)).not.toBeNull(); f.select(1003)!.click();
  expect(f.gateway.acceptQuest).not.toHaveBeenCalled(); f.action("accept-quest"); await flush();
  expect(f.gateway.acceptQuest).toHaveBeenCalledExactlyOnceWith(1, 1003);
});
it.each([1001, 1002, 9999])("manual ID %i remains supported and synchronizes visible selection", async id => {
  const f = await setup(); f.input.value = String(id); f.input.dispatchEvent(new Event("change", { bubbles: true }));
  const selected = f.mount.querySelectorAll('[data-action="select-quest"][aria-pressed="true"]');
  expect(selected).toHaveLength(id === 9999 ? 0 : 1);
  if (id !== 9999) expect(selected[0].getAttribute("data-quest-id")).toBe(String(id));
  f.action("accept-quest"); await flush(); expect(f.gateway.acceptQuest).toHaveBeenCalledExactlyOnceWith(1, id);
});
it("refresh preserves manual/row selection but never marks a vanished row selected", async () => {
  const f = await setup(); expect(f.select(1002)).not.toBeNull(); f.select(1002)!.click(); f.action("refresh-quests"); await flush();
  expect(f.select(1002)!.getAttribute("aria-pressed")).toBe("true"); expect(f.input.value).toBe("1002");
  f.gateway.listPlayerQuests.mockResolvedValueOnce({ quests: [rows[0]] }); f.action("refresh-quests"); await flush();
  expect(f.input.value).toBe("1002"); expect(f.mount.querySelector('[data-action="select-quest"][aria-pressed="true"]')).toBeNull();
});
it("changing selection while claim is pending does not retarget or replay the submitted operation", async () => {
  const f = await setup(); expect(f.select(1002)).not.toBeNull(); f.select(1002)!.click(); f.action("claim-quest"); f.select(1003)!.click();
  expect(f.input.value).toBe("1003"); expect(f.gateway.claimQuestReward).toHaveBeenCalledExactlyOnceWith(1, 1002);
});
it("empty and malformed rows do not invent a selectable ID", async () => {
  const f = await setup([{}, { quest_cfg_id: 0 }, { quest_cfg_id: -1 }, { quest_cfg_id: 1.5 }]);
  expect(f.mount.querySelectorAll('[data-action="select-quest"]')).toHaveLength(0);
  f.gateway.listPlayerQuests.mockResolvedValueOnce({ quests: [] }); f.action("refresh-quests"); await flush(); expect(f.input.value).toBe("1001");
});

it("async refresh retains the focused surviving row rather than moving focus to body", async () => {
  const f = await setup(); f.select(1002)!.click(); f.select(1002)!.focus();
  f.action("refresh-quests"); await flush(); expect(document.activeElement).toBe(f.select(1002));
});
it("refresh never steals focus from another control or a hidden panel", async () => {
  const f = await setup(); f.input.focus(); f.action("refresh-quests"); await flush(); expect(document.activeElement).toBe(f.input);
  f.select(1002)!.focus(); f.mount.querySelector(".quest-panel")!.classList.add("hidden");
  f.action("refresh-quests"); await flush(); expect(document.activeElement).not.toBe(f.select(1002));
});
