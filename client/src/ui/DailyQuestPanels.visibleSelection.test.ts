import { afterEach, expect, it, vi } from "vitest";
import { DailyQuestPanels } from "./DailyQuestPanels";
import { DAILY_QUEST_FILTER_SESSION_KEY } from "@/net/dailyQuestListFilter";
const flush=()=>new Promise(r=>setTimeout(r,0));
const row=(id:number,state:number,chain_id=400)=>({quest_cfg_id:id,state,chain_id});
const panels:DailyQuestPanels[]=[];
afterEach(()=>{panels.splice(0).forEach(p=>p.detach());sessionStorage.clear();});
function setup(rows=[row(1012,4),row(1014,3)], filter="all") {
  sessionStorage.setItem(DAILY_QUEST_FILTER_SESSION_KEY,filter);
  const mount=document.createElement("div"), session:any={serverId:1,cityId:1,player:{player_id:1},wallet:{},bag:[],buildings:[],cityTroops:[]};
  const gateway={getBoundServerId:()=>1,listPlayerQuests:vi.fn().mockResolvedValue({quests:rows}),acceptQuest:vi.fn().mockResolvedValue({}),claimQuestReward:vi.fn().mockResolvedValue({}),listPlayerBag:vi.fn().mockResolvedValue({items:[]}),getCityState:vi.fn().mockResolvedValue({wallet:{}})};
  const panel=new DailyQuestPanels(mount,gateway as never,()=>session,p=>Object.assign(session,p),vi.fn());panels.push(panel);panel.attach();
  const button=(a:string)=>mount.querySelector<HTMLButtonElement>(`[data-action="${a}"]`)!;
  const click=(a:string)=>button(a).click();
  const pick=(id:number)=>mount.querySelector<HTMLElement>(`li[data-quest-cfg-id="${id}"]`)!.click();
  const filterTo=(f:string)=>mount.querySelector<HTMLButtonElement>(`[data-filter="${f}"]`)!.click();
  const selected=()=>panel.getSelectedQuestRow()?.quest_cfg_id;
  const visible=()=>[...mount.querySelectorAll<HTMLElement>('li[data-quest-cfg-id]')].map(x=>Number(x.dataset.questCfgId));
  return {panel,mount,gateway,button,click,pick,filterTo,selected,visible};
}
it("remembered claimable filter claims its visible selection rather than completed default",async()=>{
  const s=setup(undefined,"claimable");s.panel.toggle();await flush();expect(s.visible()).toEqual([1014]);expect(s.selected()).toBe(1014);
  s.click("claim-daily");await flush();expect(s.gateway.claimQuestReward).toHaveBeenCalledExactlyOnceWith(1,1014);
});
it("filter change moves hidden selection to a visible row",async()=>{
  const s=setup();s.panel.toggle();await flush();s.pick(1012);s.filterTo("claimable");expect(s.selected()).toBe(1014);
  s.click("claim-daily");await flush();expect(s.gateway.claimQuestReward).toHaveBeenCalledWith(1,1014);
});
it("empty filtered view clears selection/detail and blocks hidden action even via synthetic click",async()=>{
  const s=setup();s.panel.toggle();await flush();s.filterTo("in_progress");expect(s.selected()).toBeUndefined();
  expect(s.button("accept-daily").disabled).toBe(true);expect(s.button("claim-daily").disabled).toBe(true);
  s.button("claim-daily").dispatchEvent(new MouseEvent("click",{bubbles:true}));s.button("accept-daily").dispatchEvent(new MouseEvent("click",{bubbles:true}));await flush();
  expect(s.gateway.claimQuestReward).not.toHaveBeenCalled();expect(s.gateway.acceptQuest).not.toHaveBeenCalled();
});
it("ordinary refresh preserves a still-visible user choice",async()=>{
  const s=setup([row(1012,3),row(1014,3)]);s.panel.toggle();await flush();s.pick(1014);s.click("refresh-daily");await flush();expect(s.selected()).toBe(1014);
});
it.each(["focus","todo","center"])("explicit %s deep link reveals its intended target",async kind=>{
  const s=setup([row(1012,2),row(1014,3)],"completed");
  if(kind==="focus")s.panel.openAndFocusQuest(1012);else if(kind==="todo")s.panel.openFromTodoBadge(1012);else s.panel.openFromCenterTodoClaimable(1014,{skipScroll:true});
  await flush();const id=kind==="center"?1014:1012;expect(s.selected()).toBe(id);expect(s.visible()).toContain(id);
});
it("chain switch uses visible rows under the retained filter",async()=>{
  const s=setup([row(1012,3),row(2100,2,401),row(2101,3,401)],"claimable");s.panel.toggle();await flush();
  s.mount.querySelector<HTMLButtonElement>('[data-daily-chain-id="401"]')!.click();expect(s.visible()).toEqual([2101]);expect(s.selected()).toBe(2101);
  s.click("claim-daily");await flush();expect(s.gateway.claimQuestReward).toHaveBeenCalledWith(1,2101);
});
it("claim completion selects the next visible claimable row",async()=>{
  const s=setup([row(1012,3),row(1014,3)],"claimable");s.panel.toggle();await flush();
  s.gateway.claimQuestReward.mockResolvedValueOnce({quest:row(1012,4)});s.gateway.listPlayerQuests.mockResolvedValue({quests:[row(1012,4),row(1014,3)]});
  s.click("claim-daily");await flush();await flush();expect(s.visible()).toEqual([1014]);expect(s.selected()).toBe(1014);expect(s.button("claim-daily").disabled).toBe(false);
});
it("loading and failed refresh cannot submit the old hidden selection",async()=>{
  const s=setup();s.panel.toggle();await flush();let reject!:(e:Error)=>void;
  s.gateway.listPlayerQuests.mockReturnValueOnce(new Promise((_,r)=>{reject=r;}));s.click("refresh-daily");expect(s.button("claim-daily").disabled).toBe(true);
  s.button("claim-daily").dispatchEvent(new MouseEvent("click",{bubbles:true}));expect(s.gateway.claimQuestReward).not.toHaveBeenCalled();
  reject(new Error("offline"));await flush();expect(s.selected()).toBeUndefined();expect(s.button("claim-daily").disabled).toBe(true);
});
it("mutation finally cannot reenable an empty filtered action",async()=>{
  const s=setup([row(1012,1)]);s.panel.toggle();await flush();let reject!:(e:Error)=>void;
  s.gateway.acceptQuest.mockReturnValueOnce(new Promise((_,r)=>{reject=r;}));s.click("accept-daily");s.filterTo("claimable");reject(new Error("denied"));await flush();
  expect(s.button("accept-daily").disabled).toBe(true);expect(s.selected()).toBeUndefined();
});
it.each([1,2,3,4])("single actions follow visible authoritative state %s",async state=>{
  const s=setup([row(1012,state)]);s.panel.toggle();await flush();
  expect(s.button("accept-daily").disabled).toBe(state!==1);expect(s.button("claim-daily").disabled).toBe(state!==3);
  if(state!==1)s.button("accept-daily").dispatchEvent(new MouseEvent("click",{bubbles:true}));
  if(state!==3)s.button("claim-daily").dispatchEvent(new MouseEvent("click",{bubbles:true}));await flush();
  expect(s.gateway.acceptQuest).not.toHaveBeenCalled();expect(s.gateway.claimQuestReward).not.toHaveBeenCalled();
});
