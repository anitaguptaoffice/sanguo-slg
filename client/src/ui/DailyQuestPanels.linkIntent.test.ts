import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DailyQuestPanels } from "./DailyQuestPanels";
import { QueuePanels } from "./QueuePanels";
import { DAILY_QUEST_FILTER_SESSION_KEY } from "@/net/dailyQuestListFilter";
const flush = () => new Promise(r => setTimeout(r, 0));
const row = (id: number, state: number) => ({quest_cfg_id:id, state, chain_id:400});
const rows = [row(1012,4),row(1013,4),row(1014,2),row(1015,3),row(1032,2)];
const panels: DailyQuestPanels[] = [];
const queues: QueuePanels[] = [];
const scroll = vi.fn();
beforeEach(() => { Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable:true, value:scroll }); scroll.mockClear(); });
afterEach(() => { panels.splice(0).forEach(p => p.detach()); queues.splice(0).forEach(p => p.detach()); document.body.innerHTML=""; sessionStorage.clear(); });
function deferred() { let resolve!: (x: unknown) => void; const promise = new Promise(r=>resolve=r);return {promise,resolve}; }
function setup() {
  const mount = document.createElement("div"); document.body.append(mount);
  const session: any = {serverId:1, cityId:1, player:{player_id:1}, wallet:{}, bag:[], buildings:[], cityTroops:[]};
  const gateway = {getBoundServerId:()=>1, listPlayerQuests:vi.fn().mockResolvedValue({quests:rows})};
  const snapshot = vi.fn();
  const panel = new DailyQuestPanels(mount,gateway as never,()=>session,p=>Object.assign(session,p),vi.fn(),undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,snapshot);
  panel.attach(); panels.push(panel);
  const filter = (f:string) => mount.querySelector<HTMLButtonElement>(`[data-filter="${f}"]`)!;
  const pick = (id:number) => mount.querySelector<HTMLElement>(`li[data-quest-cfg-id="${id}"]`)!;
  const selected = () => panel.getSelectedQuestRow()?.quest_cfg_id;
  return {mount,panel,gateway,snapshot,filter,pick,selected,session};
}
it.each(["focus", "todo", "center"])("%s deferred explicit target respects a later real filter click", async kind => {
  const s=setup(); s.panel.toggle(); await flush();
  const pending=deferred(); s.gateway.listPlayerQuests.mockReturnValueOnce(pending.promise);
  if(kind==="focus")s.panel.openAndFocusQuest(1014);
  if(kind==="todo")s.panel.openFromTodoBadge(1015,{listFilter:"claimable"});
  if(kind==="center")s.panel.openFromCenterTodoClaimable(1015);
  expect(s.gateway.listPlayerQuests).toHaveBeenCalledTimes(2);
  expect(s.filter("completed").disabled).toBe(false);
  s.filter("completed").click(); s.pick(1013).click();
  expect(s.selected()).toBe(1013); expect(s.gateway.listPlayerQuests).toHaveBeenCalledTimes(2);
  pending.resolve({quests:rows.map(r=>r.quest_cfg_id===1014?{...r,progress_current:7}:r)}); await flush();
  expect(s.snapshot.mock.calls.at(-1)?.[0].find((r:any)=>r.quest_cfg_id===1014)?.progress_current).toBe(7);
  expect(s.filter("completed").getAttribute("aria-pressed")).toBe("true");
  expect(s.selected()).toBe(1013);
  expect(sessionStorage.getItem(DAILY_QUEST_FILTER_SESSION_KEY)).toBe("completed");
});
it.each(["focus", "todo", "center"])("%s deferred explicit target respects a later real row click", async kind => {
  const s=setup(); s.panel.toggle(); await flush();
  const pending=deferred(); s.gateway.listPlayerQuests.mockReturnValueOnce(pending.promise);
  if(kind==="focus")s.panel.openAndFocusQuest(1014);
  if(kind==="todo")s.panel.openFromTodoBadge(1015);
  if(kind==="center")s.panel.openFromCenterTodoClaimable(1015);
  s.pick(1013).click(); expect(s.selected()).toBe(1013);
  pending.resolve({quests:rows}); await flush(); expect(s.selected()).toBe(1013);
});
it("unchanged explicit focus still reveals its target through an incompatible filter", async()=>{
  const s=setup();s.panel.toggle();await flush();s.filter("completed").click();
  const pending=deferred();s.gateway.listPlayerQuests.mockReturnValueOnce(pending.promise);s.panel.openAndFocusQuest(1014);
  pending.resolve({quests:rows});await flush();expect(s.selected()).toBe(1014);expect(s.filter("all").getAttribute("aria-pressed")).toBe("true");
});
it("background recruit refresh preserves a newer daily choice made while pending",async()=>{
  const s=setup();s.panel.toggle();await flush();
  const pending=deferred();s.gateway.listPlayerQuests.mockReturnValueOnce(pending.promise);const job=s.panel.refreshChainList(1015);
  s.filter("completed").click();s.pick(1013).click();pending.resolve({quests:rows});await job;
  expect(s.filter("completed").getAttribute("aria-pressed")).toBe("true");expect(s.selected()).toBe(1013);
});

it("queue build-next real DOM route retains a later completed selection",async()=>{
  const s=setup();s.panel.toggle();await flush();
  s.session.buildings=[{slot_key:"farm",building_cfg_id:2,level:1,upgrade_finish_at_ms:Date.now()+60000}];
  const queue=new QueuePanels(s.mount,s.gateway as never,()=>s.session,{farm:"农田"},vi.fn(),vi.fn(),vi.fn(),()=>s.panel.getRowsSnapshot(),id=>s.panel.openAndFocusQuest(id));
  queues.push(queue);queue.attach();queue.open();
  const pending=deferred();s.gateway.listPlayerQuests.mockReturnValueOnce(pending.promise);
  const next=queue.getRoot().querySelector<HTMLButtonElement>('[data-action="daily-build-next"][data-quest-cfg-id="1032"]')!;
  expect(next).not.toBeNull();expect(next.disabled).toBe(false);next.click();expect(s.panel.isOpen()).toBe(true);expect(queue.isOpen()).toBe(false);
  s.filter("completed").click();s.pick(1013).click();expect(s.selected()).toBe(1013);scroll.mockClear();
  pending.resolve({quests:rows});await flush();
  expect(s.gateway.listPlayerQuests).toHaveBeenCalledTimes(2);
  expect(s.filter("completed").getAttribute("aria-pressed")).toBe("true");expect(s.selected()).toBe(1013);expect(scroll).not.toHaveBeenCalled();
});

it.each(["close", "peer", "reopen"])("late focus does not scroll after %s while data remains current", async mode => {
  const s=setup();s.panel.toggle();await flush();const pending=deferred();
  s.gateway.listPlayerQuests.mockReturnValueOnce(pending.promise);s.panel.openAndFocusQuest(1014);
  if(mode==="peer") { const other=document.createElement("div");other.className="content-panel";s.mount.append(other);const {openCenterPanel}=await import("./centerPanelForeground");openCenterPanel(other); }
  else { s.panel.toggle(); if(mode==="reopen") {const second=deferred();s.gateway.listPlayerQuests.mockReturnValueOnce(second.promise);s.panel.toggle();pending.resolve({quests:rows});await flush();scroll.mockClear();second.resolve({quests:rows});await flush();expect(s.selected()).not.toBe(1014);return;} }
  scroll.mockClear();pending.resolve({quests:rows.map(r=>({...r,progress_current:9}))});await flush();
  expect(scroll).not.toHaveBeenCalled();expect(s.snapshot.mock.calls.at(-1)?.[0][0].progress_current).toBe(9);
});
it("superseded badge override is cleared using authoritative counts",async()=>{
  const s=setup();s.panel.toggle();await flush();const pending=deferred();s.gateway.listPlayerQuests.mockReturnValueOnce(pending.promise);
  s.panel.openFromTodoBadge(1015,{claimableCount:99});s.filter("completed").click();s.pick(1013).click();
  pending.resolve({quests:rows});await flush();
  expect(s.mount.querySelector('[data-role="daily-claimable-count-badge"]')?.getAttribute("data-filter-badge-count")).toBe("1");
  expect(s.selected()).toBe(1013);
});
it("failed focused read does not run a successful scroll continuation",async()=>{
  const s=setup();s.panel.toggle();await flush();s.gateway.listPlayerQuests.mockRejectedValueOnce(new Error("offline"));
  s.panel.openAndFocusQuest(1014);scroll.mockClear();await flush();
  expect(scroll).not.toHaveBeenCalled();expect(s.panel.getRoot().textContent).toContain("offline");
});
it("a newer microtask selection after snapshot publication prevents old scroll",async()=>{
  const s=setup();s.panel.toggle();await flush();
  s.snapshot.mockImplementationOnce(()=>queueMicrotask(()=>s.pick(1013).click()));
  s.panel.openAndFocusQuest(1014);scroll.mockClear();await flush();
  expect(s.selected()).toBe(1013);expect(scroll).not.toHaveBeenCalled();
});
