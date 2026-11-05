import { afterEach, expect, it, vi } from "vitest";
import { MainCityScene } from "./MainCityScene";
import { getTypes } from "@/net/loadProto";
import { decodeGatewayResponse } from "@/net/decodeGatewayResponse";
import { previewUpgradeCost } from "@/net/previewUpgradeCost";
const clean: (() => void)[] = [];
afterEach(() => { clean.splice(0).forEach(f => f()); document.body.innerHTML = ""; sessionStorage.clear(); });
const flush = () => new Promise(r => setTimeout(r, 0));
function decode(kind: "StartBuildingUpgradeResponse" | "GetCityStateResponse", value: object) {
 const type = getTypes()[kind]; return decodeGatewayResponse(type, type.encode(type.fromObject(value)).finish());
}
async function setup(existingFarm = true) {
 const now=Date.now();
 const buildings: any[]=[{slot_key:"hall",building_cfg_id:1,level:2}, ...(existingFarm?[{slot_key:"farm",building_cfg_id:2,level:1}]:[])];
 const jobs: {slot:string; cfg:number; target:number; finish:number}[]=[];
 let wallet={food:10000,wood:10000,stone:10000,iron:10000};
 // Mirrors current server: one active build slot; GetCityState returns only existing
 // Building instances and only QueueActive finish values. Waiting jobs are omitted.
 const state=()=>decode("GetCityStateResponse", {wallet,buildings:buildings.map(b=>({...b,upgrade_finish_at_ms:jobs[0]?.slot===b.slot_key?jobs[0].finish:0})),garrison:{troops:[]}});
 const fallback=vi.fn(async()=>({}));
 const gateway=new Proxy({
  getSessionId:()=>"actor",getSessionGeneration:()=>1,getBoundServerId:()=>1,
  getCityState:vi.fn(async()=>state()),listPlayerCities:vi.fn(async()=>({cities:[{city_id:1,x:60,y:60}]})),
  startBuildingUpgrade:vi.fn(async(_city:number,slot:string,cfg:number)=>{
   const currentLevel=buildings.find(b=>b.slot_key===slot)?.level??0;
   const preview=previewUpgradeCost(slot,currentLevel,wallet)!;
   const finish=(jobs.at(-1)?.finish??now)+preview.timeSec*1000;jobs.push({slot,cfg,target:currentLevel+1,finish});
   wallet={food:wallet.food-preview.cost.food,wood:wallet.wood-preview.cost.wood,stone:wallet.stone-preview.cost.stone,iron:wallet.iron-preview.cost.iron};
   return decode("StartBuildingUpgradeResponse",{wallet,queue_id:jobs.length,finish_at_ms:finish,building:{slot_key:slot,building_cfg_id:cfg,level:buildings.find(b=>b.slot_key===slot)?.level??1,upgrade_finish_at_ms:finish}});
  }),
 },{get:(t,k)=>k in t?t[k as keyof typeof t]:fallback});
 const session:any={serverId:1,player:{player_id:1,level:1},cityId:1,cityName:"主城",cityX:60,cityY:60,wallet:{...wallet,gold:100},buildings:structuredClone(buildings),cityTroops:[],garrisonStatus:"ready",bag:[]};
 const assets=new Proxy({getTextureScale:()=>1,getDevicePixelRatio:()=>1},{get:(t,k)=>k in t?t[k as keyof typeof t]:()=>undefined});
 const frame=document.createElement("div");frame.id="layout-frame";
 const hud=document.createElement("div"),canvas=document.createElement("canvas");frame.append(hud,canvas);document.body.append(frame);
 const scene=new MainCityScene();clean.push(()=>scene.leave());
 const context:any={layoutFrame:frame,hud,canvas,gateway,assets,switchScene:vi.fn(),getViewport:()=>({scale:1,offsetX:0,offsetY:0})};
 await scene.enter(context,session);await flush();
 const open=(slot:string)=>frame.querySelector<HTMLButtonElement>(`[data-role="main-city-slot-overlay"] button[data-slot-key="${slot}"]`)!.click();
 const submit=()=>frame.querySelector<HTMLButtonElement>('[data-action="confirm-upgrade"]')!;
 const upgrade=async(slot:string)=>{open(slot);expect(submit().disabled).toBe(false);submit().click();await vi.waitFor(()=>expect((scene as any).buildSubmitState).toBe("idle"));await flush();};
 const complete=()=>{const job=jobs.shift()!;const b=buildings.find(b=>b.slot_key===job.slot);if(b)b.level=job.target;else buildings.push({slot_key:job.slot,building_cfg_id:job.cfg,level:job.target});};
 return{scene,frame,session,gateway,jobs,open,submit,upgrade,complete,context};
}
it("control: confirmed active existing building remains disabled after ordinary refresh",async()=>{
 const f=await setup();await f.upgrade("farm");expect(f.session.buildings.find((b:any)=>b.slot_key==="farm").upgrade_finish_at_ms).toBeGreaterThan(Date.now());expect(f.submit().disabled).toBe(true);
});
it("confirmed waiting building must remain blocked against duplicate paid upgrade",async()=>{
 const f=await setup();await f.upgrade("hall");await f.upgrade("farm");
 expect(f.gateway.startBuildingUpgrade).toHaveBeenCalledTimes(2);
 expect(f.submit().disabled).toBe(true);
});
it("confirmed first construction must remain blocked while omitted by city snapshot",async()=>{
 const f=await setup(false);await f.upgrade("farm");
 expect(f.gateway.startBuildingUpgrade).toHaveBeenCalledTimes(1);
 expect(f.submit().disabled).toBe(true);
});
it("repeat clicks and direct submission cannot duplicate the paid waiting target",async()=>{
 const f=await setup();await f.upgrade("hall");await f.upgrade("farm");
 expect(f.submit().disabled).toBe(true);f.submit().click();
 await (f.scene as any).startBuildingUpgrade("farm",2);
 expect(f.gateway.startBuildingUpgrade).toHaveBeenCalledTimes(2);
});

it("control: normal completion becomes authoritative through existing city reads, not receipt level",async()=>{
 const f=await setup(false);await f.upgrade("farm");
 // Server's pre-completion receipt says level1, but actual state still has no farm.
 expect(f.session.buildings.some((b:any)=>b.slot_key==="farm")).toBe(false);
 f.complete();await (f.scene as any).refreshState();
 expect(f.session.buildings.find((b:any)=>b.slot_key==="farm").level).toBe(1);
 f.open("farm");expect(f.submit().disabled).toBe(false);
 expect(f.frame.querySelector('[data-role="build-preview"]')?.textContent).toContain("Lv2");
});
it("queue refresh also must not unlock a confirmed new building after initial read failure",async()=>{
 const f=await setup(false);f.gateway.getCityState.mockRejectedValueOnce(new Error("temporary read failure"));await f.upgrade("farm");
 expect(f.submit().disabled).toBe(true); // Receipt survives failed first read.
 f.frame.querySelector<HTMLButtonElement>('[data-action="toggle-queue"]')!.click();
 f.frame.querySelector<HTMLButtonElement>('[data-action="refresh-queue"]')!.click();await flush();await flush();
 f.open("farm");expect(f.submit().disabled).toBe(true);
});
it("elapsed receipt deadline and incomplete or mismatched city reads do not unlock",async()=>{
 const f=await setup(false);await f.upgrade("farm");
 const clock=vi.spyOn(Date,"now").mockReturnValue(f.jobs[0].finish+60000);
 try {
  for(const buildings of [undefined,[],[{slot_key:"farm",building_cfg_id:99,level:10}],[{slot_key:"farm",building_cfg_id:2,level:0}]]) {
   f.gateway.getCityState.mockResolvedValueOnce({buildings} as any);
   await (f.scene as any).refreshState();f.open("farm");expect(f.submit().disabled).toBe(true);
  }
 } finally {clock.mockRestore();}
 expect(f.gateway.startBuildingUpgrade).toHaveBeenCalledTimes(1);
});
it("queue completion snapshot permits the next legitimate level without replay",async()=>{
 const f=await setup(false);await f.upgrade("farm");f.complete();
 f.frame.querySelector<HTMLButtonElement>('[data-action="toggle-queue"]')!.click();
 f.frame.querySelector<HTMLButtonElement>('[data-action="refresh-queue"]')!.click();await flush();await flush();
 f.open("farm");expect(f.submit().disabled).toBe(false);await f.upgrade("farm");
 expect(f.gateway.startBuildingUpgrade).toHaveBeenCalledTimes(2);expect(f.jobs[0].target).toBe(2);
});
it("omitted queue buildings cannot use the provisional local receipt level as completion",async()=>{
 const f=await setup(false);f.gateway.getCityState.mockRejectedValueOnce(new Error("read offline"));await f.upgrade("farm");
 expect(f.session.buildings.find((b:any)=>b.slot_key==="farm").level).toBe(1);
 f.gateway.getCityState.mockResolvedValueOnce({} as any);
 f.frame.querySelector<HTMLButtonElement>('[data-action="toggle-queue"]')!.click();
 f.frame.querySelector<HTMLButtonElement>('[data-action="refresh-queue"]')!.click();await flush();await flush();
 f.open("farm");expect(f.submit().disabled).toBe(true);
});
it.each(["player","city","generation"])("confirmed guards do not transfer across %s change",async(kind)=>{
 const f=await setup(false);await f.upgrade("farm");
 if(kind==="player")f.session.player.player_id=2;
 if(kind==="city")f.session.cityId=2;
 if(kind==="generation")f.gateway.getSessionGeneration=()=>2;
 f.open("farm");expect(f.submit().disabled).toBe(false);
});
it("a late successful old-actor receipt cannot install a guard for the new actor",async()=>{
 const f=await setup(false);let resolve!:(v:any)=>void;
 f.gateway.startBuildingUpgrade.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 f.open("farm");f.submit().click();f.session.player.player_id=2;
 resolve(decode("StartBuildingUpgradeResponse",{queue_id:1,finish_at_ms:Date.now()+10000,building:{slot_key:"farm",building_cfg_id:2,level:1}}));
 await flush();f.open("farm");expect((f.scene as any).isBuildPending("farm")).toBe(false);
 expect(f.session.buildings.some((b:any)=>b.slot_key==="farm")).toBe(false);
});
it("rejected submission does not create a confirmed receipt or automatically retry",async()=>{
 const f=await setup(false);f.gateway.startBuildingUpgrade.mockRejectedValueOnce(new Error("rejected"));
 f.open("farm");f.submit().click();await vi.waitFor(()=>expect((f.scene as any).buildSubmitState).toBe("error"));
 expect(f.submit().disabled).toBe(false);expect(f.gateway.startBuildingUpgrade).toHaveBeenCalledTimes(1);
});

it("same actor scene re-entry cannot inherit confirmed pending guards",async()=>{
 const f=await setup(false);await f.upgrade("farm");f.scene.leave();
 await f.scene.enter(f.context,f.session);await flush();f.open("farm");
 expect(f.submit().disabled).toBe(false);expect(f.gateway.startBuildingUpgrade).toHaveBeenCalledTimes(1);
});
