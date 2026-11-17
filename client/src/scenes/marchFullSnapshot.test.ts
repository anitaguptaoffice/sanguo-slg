import { expect, it, vi } from "vitest";
import { MainCityScene } from "./MainCityScene";
it("publishes all 101 marches to the minimap and military snapshot", async () => {
  const rows = Array.from({ length: 101 }, (_, i) => ({ march_id: i + 1, phase: i === 100 ? 2 : 5 }));
  const gateway = { listMarches: vi.fn(async (_city, limit, offset) => ({ marches: rows.slice(offset, offset + limit), total: rows.length })) };
  const scene = new MainCityScene() as unknown as Record<string, any>;
  Object.assign(scene, { session: { cityId: 1 }, gateway, applyMarchesSnapshot: vi.fn(), marchList: { syncMinimapMarchFocusFromSnapshot: vi.fn() } });
  await scene.refreshMinimapMarches();
  expect(scene.applyMarchesSnapshot).toHaveBeenCalledWith(rows);
  expect(scene.marchList.syncMinimapMarchFocusFromSnapshot).toHaveBeenCalledWith(rows);
});

import { MarchArrivalPoll } from "@/net/marchArrivalPoll";
it("arrival tracking does not misreport the 21st future march as vanished", async () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ march_id: i + 1, phase: i === 20 ? 2 : 5, arrive_at_ms: Date.now() + 600000 }));
  const gateway = { listMarches: vi.fn(async (_city, limit, offset) => ({ marches: rows.slice(offset, offset + limit), total: rows.length })) };
  const scene = new MainCityScene() as unknown as Record<string, any>;
  Object.assign(scene, { gateway, session: { cityId: 1 } });
  const onCompletions = vi.fn();
  const poll = new MarchArrivalPoll({ getCityId: () => 1, listMarches: city => scene.readMarchesForArrival(city), onCompletions });
  poll.trackMarch(21, rows[20]); await poll.pollOnce();
  expect(onCompletions).not.toHaveBeenCalled(); expect(poll.needsPoll()).toBe(true);
  gateway.listMarches.mockRejectedValueOnce(new Error("offline")); await poll.pollOnce();
  expect(onCompletions).not.toHaveBeenCalled(); expect(poll.needsPoll()).toBe(true);
});
it("never publishes a partial minimap snapshot after a later-page failure", async () => {
  const gateway = { listMarches: vi.fn().mockResolvedValueOnce({ marches: [{ march_id: 1 }], total: 21 }).mockRejectedValueOnce(new Error("offline")) };
  const scene = new MainCityScene() as unknown as Record<string, any>;
  Object.assign(scene, { session: { cityId: 1 }, gateway, applyMarchesSnapshot: vi.fn(), marchList: { syncMinimapMarchFocusFromSnapshot: vi.fn() } });
  await scene.refreshMinimapMarches(); expect(scene.applyMarchesSnapshot).not.toHaveBeenCalled();
  expect(scene.marchList.syncMinimapMarchFocusFromSnapshot).not.toHaveBeenCalled();
});
