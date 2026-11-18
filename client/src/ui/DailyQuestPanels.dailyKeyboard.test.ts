import { afterEach, expect, it, vi } from "vitest";
import type { MainCitySession } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
import { getProtoRoot } from "@/net/loadProto";
import { DailyQuestPanels } from "./DailyQuestPanels";

const first = { quest_cfg_id: 1012, chain_id: 400, quest_code: "daily_first", state: 2 };
const second = { quest_cfg_id: 1033, chain_id: 400, quest_code: "daily_march_1", state: 1 };

function wireList(quests = [first, second]) {
  const type = getProtoRoot().lookupType("sanguo.quest.v1.ListPlayerQuestsResponse");
  return type.toObject(type.decode(type.encode({ quests }).finish()), { longs: Number });
}

function setup() {
  const mount = document.createElement("div");
  const outside = document.createElement("button");
  document.body.append(mount, outside);
  const session = { serverId: 1, cityId: 2, player: { player_id: 3 } } as MainCitySession;
  const snapshot = wireList();
  const gateway = {
    getBoundServerId: () => 1,
    listPlayerQuests: vi.fn().mockResolvedValue(snapshot),
    acceptQuest: vi.fn(),
    claimQuestReward: vi.fn(),
  };
  const openReport = vi.fn();
  const panel = new DailyQuestPanels(
    mount, gateway as unknown as GatewayPort, () => session, vi.fn(), vi.fn(),
    undefined, undefined, undefined, openReport,
  );
  panel.attach();
  panel.toggle();
  const select = <T extends HTMLElement>(selector: string) => mount.querySelector<T>(selector)!;
  const row = (id: number) => select(`li[data-quest-cfg-id="${id}"]`);
  const title = (id: number) => select<HTMLButtonElement>(`li[data-quest-cfg-id="${id}"] button.daily-quest-row-main`);
  return { panel, gateway, openReport, outside, snapshot, select, row, title };
}

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
});

it("selects the matching protobuf row with a native title and keeps pointer and cross-link behavior", async () => {
  const s = setup();
  await s.panel.refreshChainList();
  const secondTitle = s.title(1033);
  expect(secondTitle.type).toBe("button");
  secondTitle.focus();
  secondTitle.click();
  expect(s.select('[data-role="daily-detail"]').textContent).toContain("#1033");
  expect(s.title(1033).getAttribute("aria-pressed")).toBe("true");
  expect(s.title(1012).getAttribute("aria-pressed")).toBe("false");
  expect(document.activeElement).toBe(s.title(1033));

  s.row(1012).click();
  expect(s.panel.getSelectedQuestRow()?.quest_cfg_id).toBe(1012);
  s.select('[data-action="daily-cross-battle-report"]').click();
  expect(s.openReport).toHaveBeenCalledOnce();
  expect(s.panel.getSelectedQuestRow()?.quest_cfg_id).toBe(1012);
  expect(s.gateway.acceptQuest).not.toHaveBeenCalled();
  expect(s.gateway.claimQuestReward).not.toHaveBeenCalled();
});

it("restores focus during refresh without changing selection or overriding external focus", async () => {
  const s = setup();
  await s.panel.refreshChainList();
  s.title(1033).focus();
  s.title(1033).click();
  let resolve!: (value: unknown) => void;
  s.gateway.listPlayerQuests.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
  const pending = s.panel.refreshChainList();
  expect(document.activeElement).toBe(s.title(1033));
  s.outside.focus();
  resolve(s.snapshot);
  await pending;
  expect(document.activeElement).toBe(s.outside);
  expect(s.panel.getSelectedQuestRow()?.quest_cfg_id).toBe(1033);
});

it.each(["removed", "empty", "error", "hidden", "detached"])("does not lose or steal focus after a %s refresh", async (mode) => {
  const s = setup();
  await s.panel.refreshChainList();
  s.title(1033).focus();
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  s.gateway.listPlayerQuests.mockReturnValueOnce(new Promise((done, fail) => { resolve = done; reject = fail; }));
  const pending = s.panel.refreshChainList();
  if (mode === "hidden") s.panel.getRoot().classList.add("hidden");
  if (mode === "detached") s.panel.detach();
  if (mode === "error") reject(new Error("offline"));
  else resolve(wireList(mode === "removed" ? [first] : []));
  await pending;
  const fallback = s.select('[data-action="daily-filter"][aria-pressed="true"]');
  expect(document.activeElement).toBe(mode === "hidden" || mode === "detached" ? document.body : fallback);
  expect(s.gateway.acceptQuest).not.toHaveBeenCalled();
  expect(s.gateway.claimQuestReward).not.toHaveBeenCalled();
});
